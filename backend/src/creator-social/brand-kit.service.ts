import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { creatorScope, SocialActor } from './creator-social.service';
import { blankDraft, expectedVersion, KitDraft, publicContent, validateDraft } from './brand-kit.model';

@Injectable()
export class BrandKitService {
  constructor(private readonly db: DataSource) {}

  async get(actor: SocialActor) {
    const [row] = await this.db.query(`SELECT k.*, r.draft_version AS published_draft_version, r.published_at
      FROM tch_creator_brand_kit k LEFT JOIN tch_creator_brand_kit_revision r ON r.id = k.published_revision
      WHERE k.creator_id = $1`, [creatorScope(actor)]);
    if (row) return { ...row, saved_snapshots: await this.observations(this.db.manager, creatorScope(actor), validateDraft(row.draft)) };
    return { version: 0, draft: blankDraft(), slug: null, published_revision: null, published_at: null, published_draft_version: null, saved_snapshots: [] };
  }

  private async observations(manager: EntityManager, owner: string, draft: KitDraft) {
    if (!draft.snapshot_ids.length) return [];
    const rows = await manager.query(`SELECT s.*, a.username, a.profile_url FROM tch_creator_social_snapshot s
      JOIN tch_creator_social_account a ON a.id = s.account_id
      WHERE a.creator_id = $1 AND s.id = ANY($2::uuid[])`, [owner, draft.snapshot_ids]);
    if (rows.length !== draft.snapshot_ids.length) throw new BadRequestException('A selected snapshot is unavailable.');
    if (new Set(rows.map((r: { account_id: string }) => r.account_id)).size !== rows.length) throw new BadRequestException('Choose one snapshot per social account.');
    return draft.snapshot_ids.map(id => rows.find((r: { id: string }) => r.id === id));
  }

  async save(actor: SocialActor, body: { version?: unknown; draft?: unknown }) {
    const owner = creatorScope(actor), version = expectedVersion(body?.version), draft = validateDraft(body?.draft);
    await this.db.transaction(async manager => {
      await manager.query(`INSERT INTO tch_creator_brand_kit(creator_id,slug) VALUES ($1,$2) ON CONFLICT (creator_id) DO NOTHING`, [owner, `creator-${randomUUID().replace(/-/g,'').slice(0,16)}`]);
      const [current] = await manager.query('SELECT * FROM tch_creator_brand_kit WHERE creator_id = $1 FOR UPDATE', [owner]);
      if (current.version !== version) throw new ConflictException('This draft changed in another tab. Reload before saving.');
      publicContent(draft, await this.observations(manager, owner, draft));
      await manager.query('UPDATE tch_creator_brand_kit SET draft = $2::jsonb, version = version + 1, updated_at = now() WHERE creator_id = $1', [owner, JSON.stringify(draft)]);
    });
    return this.get(actor);
  }

  async publish(actor: SocialActor, value: unknown) {
    const owner = creatorScope(actor), version = expectedVersion(value);
    await this.db.transaction(async manager => {
      const [kit] = await manager.query('SELECT * FROM tch_creator_brand_kit WHERE creator_id = $1 FOR UPDATE', [owner]);
      if (!kit || kit.version !== version) throw new ConflictException('Save your latest draft before publishing.');
      const draft = validateDraft(kit.draft);
      if (!draft.profile.display_name || !draft.profile.biography || !draft.snapshot_ids.length) throw new BadRequestException('Add a name, biography and imported social account before publishing.');
      const content = publicContent(draft, await this.observations(manager, owner, draft));
      const [revision] = await manager.query(`INSERT INTO tch_creator_brand_kit_revision(id,creator_id,draft_version,content)
        VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (creator_id,draft_version) DO UPDATE SET draft_version = EXCLUDED.draft_version RETURNING id`, [randomUUID(), owner, version, JSON.stringify(content)]);
      await manager.query('UPDATE tch_creator_brand_kit SET published_revision = $2 WHERE creator_id = $1', [owner, revision.id]);
    });
    return this.get(actor);
  }

  async unpublish(actor: SocialActor, value: unknown) {
    const rows = await this.db.query(`WITH changed AS (UPDATE tch_creator_brand_kit SET published_revision = NULL
      WHERE creator_id = $1 AND version = $2 RETURNING creator_id) SELECT * FROM changed`, [creatorScope(actor), expectedVersion(value)]);
    if (!rows.length) throw new ConflictException('Reload the latest draft before unpublishing.');
    return this.get(actor);
  }

  async published(slug: string) {
    if (!/^creator-[a-f0-9]{16}$/.test(slug)) throw new NotFoundException('Brand kit unavailable.');
    const [row] = await this.db.query(`SELECT k.slug, r.id AS revision, r.published_at, r.content
      FROM tch_creator_brand_kit k JOIN tch_creator_brand_kit_revision r ON r.id = k.published_revision
      WHERE k.slug = $1`, [slug]);
    if (!row) throw new NotFoundException('Brand kit unavailable.');
    return row;
  }
}
