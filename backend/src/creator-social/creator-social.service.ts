import {
  BadRequestException, ConflictException, ForbiddenException, HttpException,
  Injectable, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { instagramIdentity } from './instagram-normalizer';
import { socialConfig } from './social.config';
import { discoveryEndDate, MAX_LIBRARY_POSTS } from './instagram-posts-normalizer';

export type SocialActor = { id?: string; role?: string; creatorId?: string | null };
export function creatorScope(actor: SocialActor | undefined): string {
  if (actor?.role !== 'creator' || !actor.id || !actor.creatorId || !/^[1-9]\d*$/.test(actor.creatorId)) {
    throw new ForbiddenException('An approved creator account is required.');
  }
  return actor.creatorId;
}
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new BadRequestException('A valid UUID is required.');
  }
  return value.toLowerCase();
}

// Explicit projections prevent provider job IDs, leases and requester IDs leaking into API responses.
export const JOB_FIELDS = 'id, account_id, state, error_code, requested_at, finished_at';

@Injectable()
export class CreatorSocialService {
  constructor(private readonly db: DataSource) {}

  async connect(actor: SocialActor, input: unknown) {
    const creatorId = creatorScope(actor);
    const identity = instagramIdentity(input);
    return this.db.transaction(async manager => {
      // Serialize account creation per creator, including the limit check.
      const owners = await manager.query('SELECT id FROM tch_creator WHERE id = $1 FOR UPDATE', [creatorId]);
      if (!owners.length) throw new NotFoundException('Creator not found.');
      const existing = await manager.query('SELECT * FROM tch_creator_social_account WHERE creator_id = $1 AND username = $2', [creatorId, identity.username]);
      if (existing.length) return existing[0];
      const [{ count }] = await manager.query('SELECT count(*)::int AS count FROM tch_creator_social_account WHERE creator_id = $1', [creatorId]);
      if (count >= 3) throw new ConflictException('The Instagram account limit is three per creator.');
      const [row] = await manager.query(`INSERT INTO tch_creator_social_account(id, creator_id, username, profile_url)
        VALUES ($1,$2,$3,$4) RETURNING *`, [randomUUID(), creatorId, identity.username, identity.profile_url]);
      return row;
    });
  }

  async list(actor: SocialActor) {
    const creatorId = creatorScope(actor);
    return this.db.query(`SELECT a.*, s.id AS snapshot_id, s.collected_at, s.profile, s.coverage,
      j.id AS latest_job_id, j.state AS latest_job_state, j.error_code AS latest_error_code,
      j.stage AS latest_job_stage, j.purpose AS latest_job_purpose
      FROM tch_creator_social_account a
      LEFT JOIN LATERAL (SELECT id, collected_at, profile, coverage FROM tch_creator_social_snapshot
        WHERE account_id = a.id ORDER BY collected_at DESC, id DESC LIMIT 1) s ON true
      LEFT JOIN LATERAL (SELECT id, state, error_code, stage, purpose FROM tch_creator_social_import
        WHERE account_id = a.id ORDER BY requested_at DESC, id DESC LIMIT 1) j ON true
      WHERE a.creator_id = $1 ORDER BY a.created_at, a.id`, [creatorId]);
  }

  async snapshot(actor: SocialActor, accountId: string, snapshotId?: string) {
    const creatorId = creatorScope(actor);
    const [row] = await this.db.query(`SELECT s.* FROM tch_creator_social_snapshot s
      JOIN tch_creator_social_account a ON a.id = s.account_id
      WHERE a.creator_id = $1 AND a.id = $2 AND ($3::uuid IS NULL OR s.id = $3::uuid)
      ORDER BY s.collected_at DESC, s.id DESC LIMIT 1`, [creatorId, uuid(accountId), snapshotId ? uuid(snapshotId) : null]);
    if (!row) throw new NotFoundException('No saved snapshot found.');
    return row;
  }

  async job(actor: SocialActor, accountId: string, jobId: string) {
    const creatorId = creatorScope(actor);
    const [row] = await this.db.query(`SELECT ${JOB_FIELDS.split(', ').map(f => `j.${f}`).join(', ')}
      FROM tch_creator_social_import j JOIN tch_creator_social_account a ON a.id = j.account_id
      WHERE a.creator_id = $1 AND a.id = $2 AND j.id = $3`, [creatorId, uuid(accountId), uuid(jobId)]);
    if (!row) throw new NotFoundException('Import not found.');
    return row;
  }

  async refresh(actor: SocialActor, accountId: string, key: unknown, purpose: 'profile' | 'kit' | 'update' | 'more' = 'profile') {
    const creatorId = creatorScope(actor);
    const id = uuid(accountId);
    const idempotencyKey = uuid(key);
    return this.db.transaction(async manager => {
      // A short global admission lock makes the daily cap correct across API replicas.
      // Never hold it while contacting the provider.
      await manager.query('SELECT pg_advisory_xact_lock(1753100000)');
      const [account] = await manager.query('SELECT id FROM tch_creator_social_account WHERE id = $1 AND creator_id = $2 FOR UPDATE', [id, creatorId]);
      if (!account) throw new NotFoundException('Social account not found.');
      const [previous] = await manager.query(`SELECT ${JOB_FIELDS}, purpose FROM tch_creator_social_import WHERE account_id = $1 AND idempotency_key = $2`, [id, idempotencyKey]);
      if (previous) {
        if (previous.purpose !== purpose) throw new ConflictException('This request has already been used for another action.');
        return previous;
      }
      if (!socialConfig.enabled || !socialConfig.apiKey || !/^[a-zA-Z0-9_-]{1,100}$/.test(socialConfig.datasetId)) {
        throw new ServiceUnavailableException('Social imports are not enabled or configured.');
      }
      if (purpose !== 'profile' && !/^[a-zA-Z0-9_-]{1,100}$/.test(socialConfig.postsDatasetId)) {
        throw new ServiceUnavailableException('Content insights are temporarily unavailable. Please try again later.');
      }
      const [saved] = await manager.query(`SELECT * FROM tch_creator_social_snapshot WHERE account_id = $1 ORDER BY collected_at DESC, id DESC LIMIT 1`, [id]);
      if (purpose === 'more' && !saved) throw new BadRequestException('Create your kit before adding more posts.');
      if (purpose === 'more' && saved.posts.length >= MAX_LIBRARY_POSTS) throw new ConflictException('Your library has reached 300 posts. You can still update insights.');
      const endDate = purpose === 'more' ? discoveryEndDate(saved.posts) : null;
      if (purpose === 'more' && !endDate) throw new ConflictException('No older posts are available to load.');
      const units = purpose === 'profile' || purpose === 'more' ? 1 : 2;
      const [active] = await manager.query(`SELECT id, state FROM tch_creator_social_import WHERE account_id = $1
        AND state IN ('queued','triggering','collecting','needs_review')`, [id]);
      if (active) throw new ConflictException({ detail: 'An import is already active or requires review.', job_id: active.id, state: active.state });
      const [recent] = await manager.query(`SELECT requested_at + ($2 * interval '1 second') AS next_refresh_at
        FROM tch_creator_social_import WHERE account_id = $1 AND requested_at > now() - ($2 * interval '1 second')
        ORDER BY requested_at DESC LIMIT 1`, [id, socialConfig.cooldownSeconds]);
      if (recent) throw new HttpException({ detail: 'Refresh cooldown is active.', next_refresh_at: recent.next_refresh_at }, 429);
      const [usage] = await manager.query(`SELECT COALESCE(sum(request_units),0)::int AS total,
        COALESCE(sum(request_units) FILTER (WHERE a.creator_id = $1),0)::int AS creator_total
        FROM tch_creator_social_import j JOIN tch_creator_social_account a ON a.id = j.account_id
        WHERE j.requested_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`, [creatorId]);
      if (usage.total + units > socialConfig.globalDailyLimit || usage.creator_total + units > socialConfig.creatorDailyLimit) {
        throw new HttpException('Daily import limit reached. Try again after midnight UTC.', 429);
      }
      const [row] = await manager.query(`INSERT INTO tch_creator_social_import
        (id,account_id,requested_by,idempotency_key,dataset_id,purpose,stage,posts_dataset_id,post_limit,end_date,prepared_data,request_units)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12) RETURNING ${JOB_FIELDS}`,
      [randomUUID(), id, actor.id, idempotencyKey, purpose === 'more' ? socialConfig.postsDatasetId : socialConfig.datasetId,
        purpose, purpose === 'more' ? 'posts' : 'profile', socialConfig.postsDatasetId || null,
        purpose === 'more' ? Math.min(30,MAX_LIBRARY_POSTS-saved.posts.length) : 30, endDate,
        saved ? JSON.stringify({ profile: saved.profile, posts: saved.posts, coverage: saved.coverage }) : null, units]);
      return row;
    });
  }

  // Operators recover ambiguous dispatches using a known provider snapshot ID; never trigger again.
  async reconcile(jobId: string, snapshotId: unknown) {
    if (typeof snapshotId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(snapshotId)) throw new BadRequestException('Provide the existing Bright Data snapshot ID.');
    const [row] = await this.db.query(`WITH updated AS (UPDATE tch_creator_social_import SET provider_snapshot_id = $2,
      state = 'collecting', attempts = 0, next_attempt_at = now(), lease_until = NULL,
      lease_token = NULL, error_code = NULL, finished_at = NULL
      WHERE id = $1 AND state = 'needs_review' RETURNING ${JOB_FIELDS}) SELECT * FROM updated`, [uuid(jobId), snapshotId]);
    if (!row) throw new ConflictException('Import does not require reconciliation.');
    return row;
  }
}
