import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { BrightDataClient, ProviderFailure } from './brightdata.client';
import { InvalidSocialPayload, normalizeInstagram } from './instagram-normalizer';
import { socialConfig } from './social.config';
import { normalizeInstagramPosts, mergePostLibrary } from './instagram-posts-normalizer';
import { blankDraft } from './brand-kit.model';

type Job = {
  id: string; account_id: string; state: string; dataset_id: string;
  provider_snapshot_id: string | null; attempts: number; lease_token: string;
  username: string; profile_url: string;
  purpose?: string; stage?: string; posts_dataset_id?: string; post_limit?: number; end_date?: string;
  prepared_data?: ReturnType<typeof normalizeInstagram>;
};

@Injectable()
export class SocialImportProcessor {
  constructor(private readonly db: DataSource, private readonly provider: BrightDataClient) {}

  async runOnce(): Promise<boolean> {
    if (!socialConfig.enabled) return false;
    // Dispatch may have been accepted before a crash. Never blindly resend a POST.
    await this.db.query(`UPDATE tch_creator_social_import SET state = 'needs_review',
      error_code = 'dispatch_outcome_unknown', lease_token = NULL, lease_until = NULL
      WHERE state = 'triggering' AND lease_until < now()`);
    const token = randomUUID();
    const job: Job | undefined = await this.db.transaction(async manager => {
      const [row] = await manager.query(`SELECT j.*, a.username, a.profile_url
        FROM tch_creator_social_import j JOIN tch_creator_social_account a ON a.id = j.account_id
        WHERE j.state IN ('queued','collecting') AND j.next_attempt_at <= now()
          AND (j.lease_until IS NULL OR j.lease_until < now())
        ORDER BY j.next_attempt_at, j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1`);
      if (!row) return undefined;
      await manager.query(`UPDATE tch_creator_social_import SET
        state = CASE WHEN state = 'queued' THEN 'triggering' ELSE state END,
        lease_token = $2, lease_until = now() + interval '2 minutes', attempts = attempts + 1 WHERE id = $1`, [row.id, token]);
      return { ...row, lease_token: token, attempts: row.attempts + 1 };
    });
    if (!job) return false;
    if (job.state === 'queued') {
      try {
        const snapshotId = job.stage === 'posts'
          ? await this.provider.discoverPosts(job.profile_url, job.dataset_id, job.post_limit ?? 30, job.end_date)
          : await this.provider.trigger(job.profile_url, job.dataset_id);
        await this.db.query(`UPDATE tch_creator_social_import SET state = 'collecting', provider_snapshot_id = $3,
          attempts = 0, lease_until = NULL, lease_token = NULL, next_attempt_at = now() + interval '15 seconds'
          WHERE id = $1 AND lease_token = $2`, [job.id, token, snapshotId]);
      } catch {
        await this.finish(job, 'needs_review', 'dispatch_outcome_unknown');
      }
      return true;
    }
    try {
      if (!job.provider_snapshot_id) throw new InvalidSocialPayload('missing_provider_snapshot');
      const status = await this.provider.progress(job.provider_snapshot_id, job.dataset_id);
      if (status === 'failed' || status === 'canceled') throw new InvalidSocialPayload('provider_collection_failed');
      if (status !== 'ready') throw new ProviderFailure('provider_not_ready', true);
      const payload = await this.provider.download(job.provider_snapshot_id);
      let normalized: ReturnType<typeof normalizeInstagram>;
      if (job.stage === 'posts') {
        if (!job.prepared_data?.profile) throw new InvalidSocialPayload('missing_profile_data');
        const incoming = normalizeInstagramPosts(payload, job.username, job.post_limit ?? 30);
        const previousPosts = job.prepared_data.posts ?? [];
        const posts = mergePostLibrary(previousPosts, incoming);
        const freshIds = new Set(previousPosts.map(p => p.platform_post_id));
        normalized = { ...job.prepared_data, schema_version: 2, posts, coverage: {
          ...job.prepared_data.coverage, stored_posts: posts.length, returned_posts: incoming.length,
          newest_post_at: posts[0]?.published_at ?? null, oldest_post_at: posts.at(-1)?.published_at ?? null,
          ...{ metrics_collected_at: new Date().toISOString(), new_posts: incoming.filter(p => !freshIds.has(p.platform_post_id)).length,
            last_action: job.purpose, profile_collected_at: (job.prepared_data.coverage as any).profile_collected_at ?? null },
        } };
      } else {
        normalized = normalizeInstagram(payload, job.username);
      }
      await this.db.transaction(async manager => {
        const [owned] = await manager.query('SELECT id FROM tch_creator_social_import WHERE id = $1 AND lease_token = $2 FOR UPDATE', [job.id, token]);
        if (!owned) return;
        const [previous] = await manager.query(`SELECT profile->>'platform_account_id' AS platform_id
          FROM tch_creator_social_snapshot WHERE account_id = $1 ORDER BY collected_at DESC, id DESC LIMIT 1`, [job.account_id]);
        if (previous && previous.platform_id !== normalized.profile.platform_account_id) throw new InvalidSocialPayload('platform_identity_changed');
        if (job.stage !== 'posts' && ['kit','update'].includes(job.purpose ?? '')) {
          // Persist the completed stage before dispatching the next one. A crash can never re-trigger the profile request.
          const prepared = { ...normalized, posts: mergePostLibrary(normalized.posts, job.prepared_data?.posts ?? []),
            coverage: { ...normalized.coverage, profile_collected_at: new Date().toISOString() } };
          await manager.query(`UPDATE tch_creator_social_import SET state = 'queued', stage = 'posts', dataset_id = posts_dataset_id,
            provider_snapshot_id = NULL, prepared_data = $3::jsonb, attempts = 0, next_attempt_at = now(),
            lease_token = NULL, lease_until = NULL, error_code = NULL WHERE id = $1 AND lease_token = $2`,
          [job.id, token, JSON.stringify(prepared)]);
          return;
        }
        const savedId = randomUUID();
        await manager.query(`INSERT INTO tch_creator_social_snapshot(id,account_id,import_id,schema_version,profile,posts,coverage)
          VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb) ON CONFLICT (import_id) DO NOTHING`,
        [savedId, job.account_id, job.id, normalized.schema_version, JSON.stringify(normalized.profile), JSON.stringify(normalized.posts), JSON.stringify(normalized.coverage)]);
        if (job.purpose === 'kit') {
          const draft = blankDraft();
          draft.profile.display_name = (normalized.profile.display_name ?? job.username).slice(0,120);
          draft.profile.biography = normalized.profile.biography ?? '';
          draft.snapshot_ids = [savedId];
          draft.featured_posts = normalized.posts.slice(0,3).map(p => ({ snapshot_id: savedId, post_id: p.platform_post_id }));
          await manager.query(`INSERT INTO tch_creator_brand_kit(creator_id,slug,version,draft)
            SELECT creator_id,$2,1,$3::jsonb FROM tch_creator_social_account WHERE id = $1
            ON CONFLICT (creator_id) DO NOTHING`, [job.account_id, `creator-${randomUUID().replace(/-/g,'').slice(0,16)}`, JSON.stringify(draft)]);
        }
        await manager.query(`UPDATE tch_creator_social_import SET state = 'succeeded', finished_at = now(),
          lease_token = NULL, lease_until = NULL, error_code = NULL WHERE id = $1 AND lease_token = $2`, [job.id, token]);
      });
    } catch (error) {
      if (error instanceof InvalidSocialPayload) await this.finish(job, 'failed', error.code);
      else if (error instanceof ProviderFailure && !error.retryable) await this.finish(job, 'failed', error.code);
      else if (job.attempts >= 20) await this.finish(job, 'needs_review', 'polling_exhausted');
      else {
        const delay = Math.min(300, 15 * 2 ** Math.min(job.attempts - 1, 5));
        await this.db.query(`UPDATE tch_creator_social_import SET lease_token = NULL, lease_until = NULL,
          next_attempt_at = now() + ($3 * interval '1 second'), error_code = 'waiting_for_provider'
          WHERE id = $1 AND lease_token = $2`, [job.id, token, delay]);
      }
    }
    return true;
  }

  private finish(job: Job, state: 'failed' | 'needs_review', code: string) {
    return this.db.query(`UPDATE tch_creator_social_import SET state = $3::text, error_code = $4,
      finished_at = CASE WHEN $3::text = 'failed' THEN now() ELSE NULL END, lease_token = NULL, lease_until = NULL
      WHERE id = $1 AND lease_token = $2`, [job.id, job.lease_token, state, code]);
  }
}
