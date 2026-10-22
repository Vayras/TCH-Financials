import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { instagramIdentity } from './instagram-normalizer';
import { socialConfig } from './social.config';

export type SocialActor = { id?: string; role?: string; creatorId?: string | null };
export function creatorScope(actor: SocialActor | undefined): string {
  if (
    actor?.role !== 'creator' ||
    !actor.id ||
    !actor.creatorId ||
    !/^[1-9]\d*$/.test(actor.creatorId)
  ) {
    throw new ForbiddenException('An approved creator account is required.');
  }
  return actor.creatorId;
}
export function uuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new BadRequestException('A valid UUID is required.');
  }
  return value.toLowerCase();
}

// Explicit projections prevent provider job IDs, leases and requester IDs leaking into API responses.
export const JOB_FIELDS = 'id, account_id, state, error_code, requested_at, finished_at';

@Injectable()
export class CreatorSocialService {
  constructor(private readonly db: DataSource) {}

  importStatus() {
    return { paused: socialConfig.paused };
  }

  assertImportsAvailable() {
    if (socialConfig.paused) {
      throw new ServiceUnavailableException(
        'Instagram imports are temporarily paused while we update the integration. Your saved content and published kit are still available.',
      );
    }
  }

  async connect(actor: SocialActor, input: unknown) {
    const creatorId = creatorScope(actor);
    this.assertImportsAvailable();
    const identity = instagramIdentity(input);
    return this.db.transaction(async (manager) => {
      // Serialize account creation per creator, including the limit check.
      const owners = await manager.query('SELECT id FROM tch_creator WHERE id = $1 FOR UPDATE', [
        creatorId,
      ]);
      if (!owners.length) throw new NotFoundException('Creator not found.');
      const existing = await manager.query(
        'SELECT * FROM tch_creator_social_account WHERE creator_id = $1 AND username = $2',
        [creatorId, identity.username],
      );
      if (existing.length) return existing[0];
      const [{ count }] = await manager.query(
        'SELECT count(*)::int AS count FROM tch_creator_social_account WHERE creator_id = $1',
        [creatorId],
      );
      if (count >= 3)
        throw new ConflictException('The Instagram account limit is three per creator.');
      const [row] = await manager.query(
        `INSERT INTO tch_creator_social_account(id, creator_id, username, profile_url)
        VALUES ($1,$2,$3,$4) RETURNING *`,
        [randomUUID(), creatorId, identity.username, identity.profile_url],
      );
      return row;
    });
  }

  async list(actor: SocialActor) {
    const creatorId = creatorScope(actor);
    return this.db.query(
      `SELECT a.*, s.id AS snapshot_id, s.collected_at, s.profile, s.coverage,
      j.id AS latest_job_id, j.state AS latest_job_state, j.error_code AS latest_error_code,
      j.stage AS latest_job_stage, j.purpose AS latest_job_purpose
      FROM tch_creator_social_account a
      LEFT JOIN LATERAL (SELECT id, collected_at, profile, coverage FROM tch_creator_social_snapshot
        WHERE account_id = a.id ORDER BY collected_at DESC, id DESC LIMIT 1) s ON true
      LEFT JOIN LATERAL (SELECT id, state, error_code, stage, purpose FROM tch_creator_social_import
        WHERE account_id = a.id ORDER BY requested_at DESC, id DESC LIMIT 1) j ON true
      WHERE a.creator_id = $1 ORDER BY a.created_at, a.id`,
      [creatorId],
    );
  }

  async snapshot(actor: SocialActor, accountId: string, snapshotId?: string) {
    const creatorId = creatorScope(actor);
    const [row] = await this.db.query(
      `SELECT s.* FROM tch_creator_social_snapshot s
      JOIN tch_creator_social_account a ON a.id = s.account_id
      WHERE a.creator_id = $1 AND a.id = $2 AND ($3::uuid IS NULL OR s.id = $3::uuid)
      ORDER BY s.collected_at DESC, s.id DESC LIMIT 1`,
      [creatorId, uuid(accountId), snapshotId ? uuid(snapshotId) : null],
    );
    if (!row) throw new NotFoundException('No saved snapshot found.');
    return row;
  }

  async job(actor: SocialActor, accountId: string, jobId: string) {
    const creatorId = creatorScope(actor);
    const [row] = await this.db.query(
      `SELECT ${JOB_FIELDS.split(', ')
        .map((f) => `j.${f}`)
        .join(', ')}
      FROM tch_creator_social_import j JOIN tch_creator_social_account a ON a.id = j.account_id
      WHERE a.creator_id = $1 AND a.id = $2 AND j.id = $3`,
      [creatorId, uuid(accountId), uuid(jobId)],
    );
    if (!row) throw new NotFoundException('Import not found.');
    return row;
  }

  private async enqueueRefresh(
    manager: { query: (sql: string, params?: unknown[]) => Promise<any[]> },
    actor: SocialActor,
    creatorId: string,
    id: string,
    idempotencyKey: string,
    purpose: 'profile' | 'kit',
  ) {
    // A short global admission lock makes the daily cap correct across API replicas.
    // Never hold it while contacting the provider.
    await manager.query('SELECT pg_advisory_xact_lock(1753100000)');
    const [account] = await manager.query(
      'SELECT id FROM tch_creator_social_account WHERE id = $1 AND creator_id = $2 FOR UPDATE',
      [id, creatorId],
    );
    if (!account) throw new NotFoundException('Social account not found.');
    const [previous] = await manager.query(
      `SELECT ${JOB_FIELDS}, purpose FROM tch_creator_social_import WHERE account_id = $1 AND idempotency_key = $2`,
      [id, idempotencyKey],
    );
    if (previous) {
      if (previous.purpose !== purpose)
        throw new ConflictException('This request has already been used for another action.');
      return previous;
    }
    if (!socialConfig.enabled || !socialConfig.apiToken) {
      throw new ServiceUnavailableException('Social imports are not enabled or configured.');
    }
    const [saved] = await manager.query(
      `SELECT * FROM tch_creator_social_snapshot WHERE account_id = $1 ORDER BY collected_at DESC, id DESC LIMIT 1`,
      [id],
    );
    const [active] = await manager.query(
      `SELECT id, state FROM tch_creator_social_import WHERE account_id = $1
        AND state IN ('queued','triggering','collecting','needs_review')`,
      [id],
    );
    if (active)
      throw new ConflictException({
        detail: 'An import is already active or requires review.',
        job_id: active.id,
        state: active.state,
      });
    const [{ total: dailyTotal }] = await manager.query(
      `SELECT COALESCE(sum(request_units),0)::int AS total
        FROM tch_creator_social_import
        WHERE requested_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`,
      [],
    );
    if (dailyTotal + 1 > socialConfig.globalDailyLimit) {
      throw new HttpException('Daily import limit reached. Try again after midnight UTC.', 429);
    }
    const [{ total: hourlyTotal }] = await manager.query(
      `SELECT COALESCE(sum(request_units),0)::int AS total
        FROM tch_creator_social_import WHERE requested_at >= now() - interval '1 hour'`,
      [],
    );
    if (hourlyTotal >= socialConfig.globalHourlyLimit)
      throw new HttpException('Social import hourly limit reached. Try again later.', 429);
    const [row] = await manager.query(
      `INSERT INTO tch_creator_social_import
        (id,account_id,requested_by,idempotency_key,dataset_id,purpose,stage,post_limit,prepared_data,request_units)
        VALUES ($1,$2,$3,$4,$5,$6,'profile',12,$7::jsonb,1) RETURNING ${JOB_FIELDS}`,
      [
        randomUUID(),
        id,
        actor.id,
        idempotencyKey,
        'triosphere-profile-lookup',
        purpose,
        saved
          ? JSON.stringify({ profile: saved.profile, posts: saved.posts, coverage: saved.coverage })
          : null,
      ],
    );
    return row;
  }

  async refresh(
    actor: SocialActor,
    accountId: string,
    key: unknown,
    purpose: 'profile' | 'kit' = 'profile',
  ) {
    const creatorId = creatorScope(actor);
    this.assertImportsAvailable();
    const id = uuid(accountId),
      idempotencyKey = uuid(key);
    return this.db.transaction((manager) =>
      this.enqueueRefresh(manager, actor, creatorId, id, idempotencyKey, purpose),
    );
  }

  async createKit(actor: SocialActor, input: unknown, key: unknown) {
    const creatorId = creatorScope(actor);
    this.assertImportsAvailable();
    const identity = instagramIdentity(input),
      idempotencyKey = uuid(key);
    return this.db.transaction(async (manager) => {
      const owners = await manager.query('SELECT id FROM tch_creator WHERE id=$1 FOR UPDATE', [
        creatorId,
      ]);
      if (!owners.length) throw new NotFoundException('Creator not found.');
      let [account] = await manager.query(
        'SELECT id FROM tch_creator_social_account WHERE creator_id=$1 AND username=$2 FOR UPDATE',
        [creatorId, identity.username],
      );
      if (!account) {
        const [{ count }] = await manager.query(
          'SELECT count(*)::int AS count FROM tch_creator_social_account WHERE creator_id=$1',
          [creatorId],
        );
        if (count >= 3)
          throw new ConflictException('The Instagram account limit is three per creator.');
        [account] = await manager.query(
          `INSERT INTO tch_creator_social_account(id,creator_id,username,profile_url)
          VALUES($1,$2,$3,$4) RETURNING id`,
          [randomUUID(), creatorId, identity.username, identity.profile_url],
        );
      }
      return this.enqueueRefresh(manager, actor, creatorId, account.id, idempotencyKey, 'kit');
    });
  }
}
