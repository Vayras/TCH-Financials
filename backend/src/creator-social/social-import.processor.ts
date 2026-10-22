import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { TrioSphereClient, ProviderFailure } from './triosphere.client';
import { InvalidSocialPayload, normalizeTrioSphere } from './instagram-normalizer';
import { socialConfig } from './social.config';
import { blankDraft } from './brand-kit.model';

type Job = {
  id: string;
  account_id: string;
  attempts: number;
  lease_token: string;
  username: string;
  prepared_data?: { posts?: unknown[] } | null;
  purpose?: string;
};

@Injectable()
export class SocialImportProcessor {
  constructor(
    private readonly db: DataSource,
    private readonly provider: TrioSphereClient,
  ) {}

  async runOnce(): Promise<boolean> {
    if (!socialConfig.enabled) return false;
    const token = randomUUID();
    const job: Job | undefined = await this.db.transaction(async (manager) => {
      const [row] = await manager.query(`SELECT j.*, a.username FROM tch_creator_social_import j
        JOIN tch_creator_social_account a ON a.id = j.account_id
        WHERE j.state IN ('queued','triggering') AND j.next_attempt_at <= now()
          AND (j.lease_until IS NULL OR j.lease_until < now())
        ORDER BY j.next_attempt_at, j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1`);
      if (!row) return undefined;
      await manager.query(
        `UPDATE tch_creator_social_import SET state = 'triggering', lease_token = $2,
        lease_until = now() + interval '2 minutes', attempts = attempts + 1 WHERE id = $1`,
        [row.id, token],
      );
      return { ...row, lease_token: token, attempts: row.attempts + 1 };
    });
    if (!job) return false;

    try {
      const normalized = normalizeTrioSphere(
        await this.provider.lookup(job.username),
        job.username,
      );
      if (!normalized.coverage.posts_available && job.prepared_data?.posts) {
        normalized.posts = job.prepared_data.posts as typeof normalized.posts;
        normalized.coverage.stored_posts = normalized.posts.length;
        const dated = normalized.posts
          .map((post) => post.published_at)
          .filter((value): value is string => !!value)
          .sort();
        normalized.coverage.oldest_post_at = dated[0] ?? null;
        normalized.coverage.newest_post_at = dated.at(-1) ?? null;
      }
      await this.db.transaction(async (manager) => {
        const [owned] = await manager.query(
          'SELECT id FROM tch_creator_social_import WHERE id = $1 AND lease_token = $2 FOR UPDATE',
          [job.id, token],
        );
        if (!owned) return;
        const [previous] = await manager.query(
          `SELECT profile->>'platform_account_id' AS platform_id
          FROM tch_creator_social_snapshot WHERE account_id = $1 ORDER BY collected_at DESC, id DESC LIMIT 1`,
          [job.account_id],
        );
        if (
          previous?.platform_id &&
          normalized.profile.platform_account_id &&
          previous.platform_id !== normalized.profile.platform_account_id
        ) {
          throw new InvalidSocialPayload('platform_identity_changed');
        }
        const snapshotId = randomUUID();
        await manager.query(
          `INSERT INTO tch_creator_social_snapshot(id,account_id,import_id,source,schema_version,profile,posts,coverage)
          VALUES ($1,$2,$3,'triosphere',$4,$5::jsonb,$6::jsonb,$7::jsonb) ON CONFLICT (import_id) DO NOTHING`,
          [
            snapshotId,
            job.account_id,
            job.id,
            normalized.schema_version,
            JSON.stringify(normalized.profile),
            JSON.stringify(normalized.posts),
            JSON.stringify(normalized.coverage),
          ],
        );
        if (job.purpose === 'kit') {
          const draft = blankDraft();
          draft.profile.display_name = (normalized.profile.display_name ?? job.username).slice(
            0,
            120,
          );
          draft.profile.biography = normalized.profile.biography ?? '';
          draft.snapshot_ids = [snapshotId];
          draft.featured_posts = normalized.posts
            .slice(0, 3)
            .map((post) => ({ snapshot_id: snapshotId, post_id: post.platform_post_id }));
          await manager.query(
            `INSERT INTO tch_creator_brand_kit(creator_id,slug,version,draft)
            SELECT creator_id,$2,1,$3::jsonb FROM tch_creator_social_account WHERE id = $1
            ON CONFLICT (creator_id) DO NOTHING`,
            [
              job.account_id,
              `creator-${randomUUID().replace(/-/g, '').slice(0, 16)}`,
              JSON.stringify(draft),
            ],
          );
        }
        await manager.query(
          `UPDATE tch_creator_social_import SET state = 'succeeded', finished_at = now(),
          lease_token = NULL, lease_until = NULL, error_code = NULL WHERE id = $1 AND lease_token = $2`,
          [job.id, token],
        );
      });
    } catch (error) {
      if (
        error instanceof InvalidSocialPayload ||
        (error instanceof ProviderFailure && !error.retryable)
      ) {
        await this.finish(job, 'failed', error.code);
      } else if (job.attempts >= 20) {
        await this.finish(job, 'failed', 'provider_retries_exhausted');
      } else {
        const retryAfter = error instanceof ProviderFailure ? error.retryAfterMs : undefined;
        const delay = retryAfter ?? Math.min(300_000, 15_000 * 2 ** Math.min(job.attempts - 1, 5));
        await this.db.query(
          `UPDATE tch_creator_social_import SET lease_token = NULL, lease_until = NULL,
          next_attempt_at = now() + ($3 * interval '1 millisecond'), error_code = $4
          WHERE id = $1 AND lease_token = $2`,
          [
            job.id,
            token,
            delay,
            error instanceof ProviderFailure ? error.code : 'provider_network_error',
          ],
        );
      }
    }
    return true;
  }

  private finish(job: Job, state: 'failed', code: string) {
    return this.db.query(
      `UPDATE tch_creator_social_import SET state = $3::text, error_code = $4,
      finished_at = now(), lease_token = NULL, lease_until = NULL WHERE id = $1 AND lease_token = $2`,
      [job.id, job.lease_token, state, code],
    );
  }
}
