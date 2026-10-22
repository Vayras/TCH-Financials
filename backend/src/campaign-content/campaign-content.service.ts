import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { CampaignContentPolicy } from './campaign-content.policy';
import {
  blankBrief,
  CampaignActor,
  campaignId,
  invalid,
  object,
  validateBrief,
  version,
} from './campaign-content.model';

@Injectable()
export class CampaignContentService {
  private policy = new CampaignContentPolicy();
  constructor(@InjectDataSource() private readonly db: DataSource) {}
  private async locked<T>(
    actor: CampaignActor,
    id: string,
    action: 'edit' | 'share' | 'manage',
    fn: (m: EntityManager, row: any) => Promise<T>,
  ) {
    campaignId(id);
    return this.db.transaction(async (m) => {
      if (!(await m.query('SELECT id FROM tch_campaign WHERE id=$1 FOR UPDATE', [id])).length)
        throw new NotFoundException();
      await this.policy.requireAgency(m, actor, id, action);
      await m.query(
        'INSERT INTO tch_campaign_brief(campaign_id,draft) VALUES($1,$2::jsonb) ON CONFLICT DO NOTHING',
        [id, JSON.stringify(blankBrief())],
      );
      const [row] = await m.query(
        'SELECT * FROM tch_campaign_brief WHERE campaign_id=$1 FOR UPDATE',
        [id],
      );
      return fn(m, row);
    });
  }
  private async audit(m: EntityManager, actor: CampaignActor, id: string, action: string) {
    await m.query(
      `INSERT INTO tch_audit_log(request_id,actor_id,actor_email,actor_role,method,path,resource_id,field_names,response_status)
      VALUES($1,$2,'',$3,'POST',$4,$5,$6::jsonb,200)`,
      [
        randomUUID(),
        actor.id,
        actor.role,
        `/campaigns/${id}/brief/${action}`,
        id,
        JSON.stringify([action]),
      ],
    );
  }
  private async agency(m: EntityManager, actor: CampaignActor, id: string) {
    const capabilities = await this.policy.requireAgency(m, actor, id, 'read');
    const [campaign] = await m.query('SELECT id::text,name,brand FROM tch_campaign WHERE id=$1', [
      id,
    ]);
    const [row] = await m.query(
      `SELECT b.version,b.draft,b.updated_at,r.id AS shared_revision_id,r.draft_version AS shared_version,r.shared_at
      FROM tch_campaign_brief b LEFT JOIN tch_campaign_brief_revision r ON r.id=b.shared_revision_id WHERE b.campaign_id=$1`,
      [id],
    );
    const [count] = await m.query(
      'SELECT count(*)::int AS n FROM tch_campaign_brief_creator WHERE campaign_id=$1',
      [id],
    );
    return {
      campaign,
      version: 0,
      draft: blankBrief(),
      shared_version: null,
      shared_revision_id: null,
      shared_at: null,
      ...row,
      capabilities,
      recipient_count: count.n,
    };
  }
  getAgencyBrief(actor: CampaignActor, id: string) {
    return this.agency(this.db.manager, actor, id);
  }
  async saveDraft(actor: CampaignActor, id: string, body: unknown) {
    const b = object(body, ['version', 'content']),
      expected = version(b.version),
      content = validateBrief(b.content, 'draft');
    return this.locked(actor, id, 'edit', async (m, row) => {
      if (row.version !== expected)
        throw new ConflictException('This draft changed. Reload before saving.');
      const [equal] = await m.query(
        'SELECT draft=$2::jsonb AS same FROM tch_campaign_brief WHERE campaign_id=$1',
        [id, JSON.stringify(content)],
      );
      if (!equal.same)
        await m.query(
          'UPDATE tch_campaign_brief SET draft=$2::jsonb,version=version+1,updated_by=$3,updated_at=now() WHERE campaign_id=$1',
          [id, JSON.stringify(content), actor.id],
        );
      return this.agency(m, actor, id);
    });
  }
  async share(actor: CampaignActor, id: string, body: unknown) {
    const b = object(body, ['version']),
      expected = version(b.version);
    return this.locked(actor, id, 'share', async (m, row) => {
      if (row.version !== expected)
        throw new ConflictException('Save or reload the latest draft before sharing.');
      const content = validateBrief(row.draft, 'share');
      const [eligible] = await m.query(
        `SELECT 1 FROM tch_campaign_brief_creator a JOIN tch_profile p ON p.creator_id=a.creator_id AND p.role='creator' AND p.status='approved' WHERE a.campaign_id=$1 LIMIT 1`,
        [id],
      );
      if (!eligible)
        invalid('creator_ids', 'Assign at least one creator with an approved portal account.');
      await m.query(
        `INSERT INTO tch_campaign_brief_revision(id,campaign_id,draft_version,content,shared_by) VALUES($1,$2,$3,$4::jsonb,$5) ON CONFLICT(campaign_id,draft_version) DO NOTHING`,
        [randomUUID(), id, expected, JSON.stringify(content), actor.id],
      );
      const [revision] = await m.query(
        'SELECT id,draft_version,shared_at FROM tch_campaign_brief_revision WHERE campaign_id=$1 AND draft_version=$2',
        [id, expected],
      );
      if (row.shared_revision_id !== revision.id) {
        await m.query('UPDATE tch_campaign_brief SET shared_revision_id=$2 WHERE campaign_id=$1', [
          id,
          revision.id,
        ]);
        await this.audit(m, actor, id, 'share');
      }
      return revision;
    });
  }
  async getAssignments(actor: CampaignActor, id: string) {
    await this.policy.requireAgency(this.db.manager, actor, id, 'manage');
    return this.assignments(this.db.manager, id);
  }
  private async assignments(m: EntityManager, id: string) {
    const [row] = await m.query(
      'SELECT assignment_version FROM tch_campaign_brief WHERE campaign_id=$1',
      [id],
    );
    const members = await m.query(
      'SELECT a.user_id::text,a.can_publish,p.email,p.display_name FROM tch_campaign_brief_member a JOIN tch_profile p ON p.id=a.user_id WHERE campaign_id=$1 ORDER BY p.email',
      [id],
    );
    const creators = await m.query(
      'SELECT a.creator_id::text,c.name FROM tch_campaign_brief_creator a JOIN tch_creator c ON c.id=a.creator_id WHERE campaign_id=$1 ORDER BY c.name',
      [id],
    );
    return { version: row?.assignment_version ?? 0, members, creators };
  }
  async setAssignments(actor: CampaignActor, id: string, body: unknown) {
    const b = object(body, ['version', 'members', 'creator_ids']),
      expected = version(b.version);
    if (
      !Array.isArray(b.members) ||
      b.members.length > 100 ||
      !Array.isArray(b.creator_ids) ||
      b.creator_ids.length > 100
    )
      invalid('assignments', 'Choose up to 100 members and creators.');
    const members = b.members.map((v) => {
      const member = object(v, ['user_id', 'can_publish']);
      if (
        typeof member.user_id !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(member.user_id) ||
        typeof member.can_publish !== 'boolean'
      )
        invalid('members', 'Invalid member.');
      return { user_id: member.user_id, can_publish: member.can_publish };
    });
    const creators = b.creator_ids.map((v) => {
      if (typeof v !== 'string') invalid('creator_ids', 'Creator IDs must be strings.');
      return campaignId(v);
    });
    if (
      new Set(members.map((v) => v.user_id)).size !== members.length ||
      new Set(creators).size !== creators.length
    )
      invalid('assignments', 'Duplicate assignments.');
    return this.locked(actor, id, 'manage', async (m, row) => {
      if (row.assignment_version !== expected)
        throw new ConflictException('Assignments changed. Reload before saving.');
      for (const member of members)
        if (
          !(
            await m.query(
              "SELECT id FROM tch_profile WHERE id=$1 AND role='tch_member' AND status='approved'",
              [member.user_id],
            )
          ).length
        )
          invalid('members', 'Choose approved members only.');
      for (const creator of creators)
        if (
          !(
            await m.query(
              "SELECT id FROM tch_profile WHERE creator_id=$1 AND role='creator' AND status='approved' LIMIT 1",
              [creator],
            )
          ).length
        )
          invalid('creator_ids', 'Choose creators with approved portal accounts.');
      await m.query('DELETE FROM tch_campaign_brief_member WHERE campaign_id=$1', [id]);
      await m.query('DELETE FROM tch_campaign_brief_creator WHERE campaign_id=$1', [id]);
      for (const member of members)
        await m.query(
          'INSERT INTO tch_campaign_brief_member(campaign_id,user_id,can_publish,assigned_by) VALUES($1,$2,$3,$4)',
          [id, member.user_id, member.can_publish, actor.id],
        );
      for (const creator of creators)
        await m.query(
          'INSERT INTO tch_campaign_brief_creator(campaign_id,creator_id,assigned_by) VALUES($1,$2,$3)',
          [id, creator, actor.id],
        );
      await m.query(
        'UPDATE tch_campaign_brief SET assignment_version=assignment_version+1 WHERE campaign_id=$1',
        [id],
      );
      await this.audit(m, actor, id, 'assignments');
      return this.assignments(m, id);
    });
  }
  async assignmentOptions(
    actor: CampaignActor,
    id: string,
    search: string,
    page: number,
    pageSize: number,
  ) {
    await this.policy.requireAgency(this.db.manager, actor, id, 'manage');
    const term = `%${search.slice(0, 100)}%`,
      offset = (page - 1) * pageSize;
    const members = await this.db.query(
      "SELECT id::text AS user_id,email,display_name FROM tch_profile WHERE role='tch_member' AND status='approved' AND (email ILIKE $1 OR display_name ILIKE $1) ORDER BY email LIMIT $2 OFFSET $3",
      [term, pageSize + 1, offset],
    );
    const creators = await this.db.query(
      `SELECT c.id::text AS creator_id,c.name,jsonb_agg(jsonb_build_object('email',p.email,'user_id',p.id)) AS profiles FROM tch_creator c JOIN tch_profile p ON p.creator_id=c.id AND p.role='creator' AND p.status='approved' WHERE c.name ILIKE $1 OR p.email ILIKE $1 GROUP BY c.id,c.name ORDER BY c.name,c.id LIMIT $2 OFFSET $3`,
      [term, pageSize + 1, offset],
    );
    return {
      members: members.slice(0, pageSize),
      creators: creators.slice(0, pageSize),
      has_more: members.length > pageSize || creators.length > pageSize,
      page,
    };
  }
  async listVersions(actor: CampaignActor, id: string, page: number, pageSize: number) {
    await this.policy.requireAgency(this.db.manager, actor, id, 'read');
    return {
      items: await this.db.query(
        'SELECT id,draft_version,shared_at,shared_by FROM tch_campaign_brief_revision WHERE campaign_id=$1 ORDER BY draft_version DESC LIMIT $2 OFFSET $3',
        [id, pageSize, (page - 1) * pageSize],
      ),
      page,
    };
  }
  async getVersion(actor: CampaignActor, id: string, revisionId: string) {
    await this.policy.requireAgency(this.db.manager, actor, id, 'read');
    if (!/^[0-9a-f-]{36}$/i.test(revisionId)) throw new NotFoundException();
    const [row] = await this.db.query(
      'SELECT id,draft_version,shared_at,content FROM tch_campaign_brief_revision WHERE campaign_id=$1 AND id=$2',
      [id, revisionId],
    );
    if (!row) throw new NotFoundException();
    return row;
  }
  async listCreatorBriefs(actor: CampaignActor, page: number, pageSize: number) {
    const creator = await this.policy.requireCreator(this.db.manager, actor);
    const items = await this.db.query(
      `SELECT c.id::text,c.name,c.brand,r.draft_version AS shared_version,r.shared_at FROM tch_campaign_brief_creator a JOIN tch_campaign c ON c.id=a.campaign_id JOIN tch_campaign_brief b ON b.campaign_id=c.id JOIN tch_campaign_brief_revision r ON r.id=b.shared_revision_id WHERE a.creator_id=$1 ORDER BY r.shared_at DESC,c.id LIMIT $2 OFFSET $3`,
      [creator, pageSize + 1, (page - 1) * pageSize],
    );
    return { items: items.slice(0, pageSize), has_more: items.length > pageSize, page };
  }
  async creatorHome(actor: CampaignActor) {
    const creator = await this.policy.requireCreator(this.db.manager, actor);
    const items = await this.db.query(
      `SELECT c.id::text,c.name,c.brand,r.shared_at,r.content->'deliverables' AS deliverables,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'state',x.state,'title',cr.content->>'title'))
      FROM tch_content_concept x LEFT JOIN tch_content_concept_revision cr ON cr.id=x.current_revision
      WHERE x.campaign_id=c.id AND x.creator_id=$1),'[]'::jsonb) AS concepts
      FROM tch_campaign_brief_creator a JOIN tch_campaign c ON c.id=a.campaign_id
      JOIN tch_campaign_brief b ON b.campaign_id=c.id JOIN tch_campaign_brief_revision r ON r.id=b.shared_revision_id
      WHERE a.creator_id=$1 ORDER BY r.shared_at DESC,c.id LIMIT 51`,
      [creator],
    );
    return { items: items.slice(0, 50), has_more: items.length > 50 };
  }
  async creatorNotifications(actor: CampaignActor, cursor?: string) {
    const creator = await this.policy.requireCreator(this.db.manager, actor);
    await this.db.query(
      `INSERT INTO tch_creator_notification_read(user_id,last_seen_at)
      VALUES($1,now()-interval '7 days') ON CONFLICT DO NOTHING`,
      [actor.id],
    );
    let after: { at: string; id: string } | null = null;
    if (cursor) {
      try {
        const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (
          typeof parsed.at !== 'string' ||
          !Number.isFinite(Date.parse(parsed.at)) ||
          typeof parsed.id !== 'string' ||
          !parsed.id
        )
          throw new Error();
        after = { at: parsed.at, id: parsed.id };
      } catch {
        invalid('cursor', 'Invalid notification cursor.');
      }
    }
    const result = await this.db.query(
      `WITH events AS (
        SELECT ('brief:'||r.id::text) AS id,'campaign' AS type,c.id::text AS campaign_id,c.name AS campaign_name,c.brand,
          NULL::text AS concept_id,NULL::text AS concept_title,NULL::text AS decision,NULL::text AS message,
          NULL::text AS quantity,NULL::text AS format,NULL::text AS due_date,r.shared_at AS occurred_at
        FROM tch_campaign_brief_creator a JOIN tch_campaign c ON c.id=a.campaign_id
        JOIN tch_campaign_brief_revision r ON r.campaign_id=c.id WHERE a.creator_id=$1 AND r.shared_at IS NOT NULL
        UNION ALL
        SELECT ('review:'||v.id::text),'review',c.id::text,c.name,c.brand,x.id::text,cr.content->>'title',v.decision,v.message,
          NULL,NULL,NULL,v.created_at
        FROM tch_content_concept_review v JOIN tch_content_concept x ON x.id=v.concept_id
        JOIN tch_campaign c ON c.id=x.campaign_id JOIN tch_content_concept_revision cr ON cr.id=v.revision_id
        WHERE x.creator_id=$1
        UNION ALL
        SELECT ('message:'||f.id::text),'message',c.id::text,c.name,c.brand,x.id::text,cr.content->>'title',NULL,f.message,
          NULL,NULL,NULL,f.created_at
        FROM tch_content_concept_feedback f JOIN tch_content_concept x ON x.id=f.concept_id
        JOIN tch_campaign c ON c.id=x.campaign_id JOIN tch_content_concept_revision cr ON cr.id=f.revision_id
        WHERE x.creator_id=$1 AND f.author_id<>$2 AND f.visibility='shared' AND cr.submitted_at IS NOT NULL
        UNION ALL
        SELECT ('deadline:'||c.id::text||':'||(d->>'id')),'deadline',c.id::text,c.name,c.brand,NULL,NULL,NULL,NULL,
          d->>'quantity',d->>'format',d->>'due_date',((d->>'due_date')::date-7)::timestamptz
        FROM tch_campaign_brief_creator a JOIN tch_campaign c ON c.id=a.campaign_id
        JOIN tch_campaign_brief b ON b.campaign_id=c.id JOIN tch_campaign_brief_revision r ON r.id=b.shared_revision_id
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.content->'deliverables','[]'::jsonb)) d
        WHERE a.creator_id=$1 AND (d->>'due_date')::date BETWEEN CURRENT_DATE AND CURRENT_DATE+7
      ), state AS (SELECT last_seen_at FROM tch_creator_notification_read WHERE user_id=$2), counts AS (
        SELECT (SELECT count(*)::int FROM events e WHERE e.occurred_at>s.last_seen_at) AS unread_count,
          COALESCE((SELECT max(occurred_at) FROM events),s.last_seen_at) AS as_of FROM state s
      ), page AS (
        SELECT e.*,(e.occurred_at>s.last_seen_at) AS unread FROM events e CROSS JOIN state s
        WHERE ($3::timestamptz IS NULL OR (e.occurred_at,e.id)<($3::timestamptz,$4::text))
        ORDER BY e.occurred_at DESC,e.id DESC LIMIT 51
      )
      SELECT page.*,counts.unread_count,counts.as_of FROM counts LEFT JOIN page ON true ORDER BY page.occurred_at DESC NULLS LAST,page.id DESC NULLS LAST`,
      [creator, actor.id, after?.at ?? null, after?.id ?? null],
    );
    const rows = result.filter((row: any) => row.id);
    const items = rows.map((row: any) => {
      const campaignId = String(row.campaign_id),
        conceptId = row.concept_id ? String(row.concept_id) : undefined;
      const href = conceptId
        ? `/creator-portal/campaigns/${campaignId}/brief?view=feedback&concept=${conceptId}`
        : `/creator-portal/campaigns/${campaignId}/brief`;
      const title =
        row.type === 'campaign'
          ? 'Campaign brief updated'
          : row.type === 'review'
            ? row.decision === 'changes_requested'
              ? 'Changes requested'
              : 'Concept approved'
            : row.type === 'message'
              ? 'New concept discussion message'
              : 'Deliverable due soon';
      const detail =
        row.type === 'campaign'
          ? `${row.brand} · ${row.campaign_name}`
          : row.type === 'deadline'
            ? `${row.campaign_name} · ${row.quantity} ${row.format} · due ${row.due_date}`
            : `${row.campaign_name} · ${row.concept_title || 'Concept'}${row.message ? ` · ${row.message}` : ''}`;
      return {
        id: row.id,
        type: row.type,
        title,
        detail,
        href,
        occurred_at: row.occurred_at,
        unread: row.unread,
      };
    });
    const hasMore = items.length > 50,
      visible = items.slice(0, 50),
      last = visible.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(JSON.stringify({ at: last.occurred_at, id: last.id })).toString('base64url')
        : null;
    return {
      items: visible,
      unread_count: result[0]?.unread_count ?? 0,
      as_of: result[0]?.as_of ?? new Date().toISOString(),
      has_more: hasMore,
      next_cursor: nextCursor,
    };
  }
  async markCreatorNotificationsSeen(actor: CampaignActor, through: unknown) {
    const creator = await this.policy.requireCreator(this.db.manager, actor);
    if (typeof through !== 'string' || !Number.isFinite(Date.parse(through)))
      invalid('through', 'A valid notification timestamp is required.');
    await this.db.query(
      `INSERT INTO tch_creator_notification_read(user_id,last_seen_at)
      VALUES($1,LEAST($2::timestamptz,now()))
      ON CONFLICT(user_id) DO UPDATE SET last_seen_at=GREATEST(tch_creator_notification_read.last_seen_at,LEAST($2::timestamptz,now()))`,
      [actor.id, through],
    );
    return { ok: true };
  }
  async getCreatorBrief(actor: CampaignActor, id: string) {
    campaignId(id);
    const creator = await this.policy.requireCreator(this.db.manager, actor);
    const [row] = await this.db.query(
      `SELECT c.id::text,c.name,c.brand,r.id AS shared_revision_id,r.draft_version AS shared_version,r.shared_at,r.content FROM tch_campaign_brief_creator a JOIN tch_campaign c ON c.id=a.campaign_id JOIN tch_campaign_brief b ON b.campaign_id=c.id JOIN tch_campaign_brief_revision r ON r.id=b.shared_revision_id WHERE a.creator_id=$1 AND c.id=$2`,
      [creator, id],
    );
    if (!row) throw new NotFoundException();
    return row;
  }

  async listCreatorReferences(actor: CampaignActor, id: string) {
    campaignId(id);
    const creator = await this.policy.requireCreator(this.db.manager, actor);
    const assigned = await this.db.query(
      'SELECT 1 FROM tch_campaign_brief_creator WHERE campaign_id=$1 AND creator_id=$2',
      [id, creator],
    );
    if (!assigned.length) throw new NotFoundException();
    return {
      items: await this.db.query(
        `SELECT r.id,r.snapshot_id,r.post_id,r.created_at,s.posts
      FROM tch_campaign_content_reference r JOIN tch_creator_social_snapshot s ON s.id=r.snapshot_id
      WHERE r.campaign_id=$1 AND r.creator_id=$2 ORDER BY r.created_at DESC`,
        [id, creator],
      ),
    };
  }

  async addCreatorReference(actor: CampaignActor, id: string, body: unknown) {
    campaignId(id);
    const creator = await this.policy.requireCreator(this.db.manager, actor);
    const row = object(body, ['snapshot_id', 'post_id']);
    if (
      typeof row.snapshot_id !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(row.snapshot_id) ||
      typeof row.post_id !== 'string' ||
      !row.post_id
    )
      invalid('reference', 'A valid post is required.');
    const assigned = await this.db.query(
      'SELECT 1 FROM tch_campaign_brief_creator WHERE campaign_id=$1 AND creator_id=$2',
      [id, creator],
    );
    if (!assigned.length) throw new NotFoundException();
    const valid = await this.db.query(
      `SELECT 1 FROM tch_creator_social_snapshot s JOIN tch_creator_social_account a ON a.id=s.account_id WHERE s.id=$1 AND a.creator_id=$2 AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.posts) p WHERE p->>'platform_post_id'=$3)`,
      [row.snapshot_id, creator, row.post_id],
    );
    if (!valid.length) throw new ForbiddenException('Post is not part of your saved creator data.');
    await this.db.query(
      `INSERT INTO tch_campaign_content_reference(id,campaign_id,creator_id,snapshot_id,post_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [randomUUID(), id, creator, row.snapshot_id, row.post_id],
    );
    return this.listCreatorReferences(actor, id);
  }

  async removeCreatorReference(actor: CampaignActor, id: string, referenceId: string) {
    campaignId(id);
    const creator = await this.policy.requireCreator(this.db.manager, actor);
    if (!/^[0-9a-f-]{36}$/i.test(referenceId)) throw new NotFoundException();
    const result = await this.db.query(
      'DELETE FROM tch_campaign_content_reference WHERE id=$1 AND campaign_id=$2 AND creator_id=$3 RETURNING id',
      [referenceId, id, creator],
    );
    if (!result.length) throw new NotFoundException();
    return { ok: true };
  }
}
