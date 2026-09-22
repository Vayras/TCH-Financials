import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddCampaignBriefs1753400000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE tch_campaign_brief (
      campaign_id bigint PRIMARY KEY REFERENCES tch_campaign(id) ON DELETE RESTRICT,
      draft jsonb NOT NULL CHECK(jsonb_typeof(draft)='object'), version integer NOT NULL DEFAULT 0 CHECK(version>=0),
      assignment_version integer NOT NULL DEFAULT 0 CHECK(assignment_version>=0), shared_revision_id uuid,
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES tch_profile(id) ON DELETE RESTRICT)`);
    await q.query(`CREATE TABLE tch_campaign_brief_revision (
      id uuid PRIMARY KEY, campaign_id bigint NOT NULL REFERENCES tch_campaign_brief(campaign_id) ON DELETE RESTRICT,
      draft_version integer NOT NULL, content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),
      shared_at timestamptz NOT NULL DEFAULT now(), shared_by uuid NOT NULL REFERENCES tch_profile(id) ON DELETE RESTRICT,
      UNIQUE(campaign_id,draft_version), UNIQUE(campaign_id,id))`);
    await q.query(`ALTER TABLE tch_campaign_brief ADD FOREIGN KEY(campaign_id,shared_revision_id) REFERENCES tch_campaign_brief_revision(campaign_id,id)`);
    await q.query(`CREATE TABLE tch_campaign_brief_member (
      campaign_id bigint NOT NULL REFERENCES tch_campaign_brief(campaign_id) ON DELETE RESTRICT,
      user_id uuid NOT NULL REFERENCES tch_profile(id) ON DELETE RESTRICT, can_publish boolean NOT NULL DEFAULT false,
      assigned_at timestamptz NOT NULL DEFAULT now(), assigned_by uuid NOT NULL REFERENCES tch_profile(id) ON DELETE RESTRICT,
      PRIMARY KEY(campaign_id,user_id))`);
    await q.query(`CREATE TABLE tch_campaign_brief_creator (
      campaign_id bigint NOT NULL REFERENCES tch_campaign_brief(campaign_id) ON DELETE RESTRICT,
      creator_id bigint NOT NULL REFERENCES tch_creator(id) ON DELETE RESTRICT,
      assigned_at timestamptz NOT NULL DEFAULT now(), assigned_by uuid NOT NULL REFERENCES tch_profile(id) ON DELETE RESTRICT,
      PRIMARY KEY(campaign_id,creator_id))`);
    await q.query('CREATE INDEX ON tch_campaign_brief_member(user_id,campaign_id)');
    await q.query('CREATE INDEX ON tch_campaign_brief_creator(creator_id,campaign_id)');
    for (const table of ['tch_campaign_brief','tch_campaign_brief_revision','tch_campaign_brief_member','tch_campaign_brief_creator']) {
      await q.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q.query(`REVOKE ALL ON ${table} FROM PUBLIC`);
      await q.query(`DO $$ BEGIN
        IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON ${table} FROM anon; END IF;
        IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON ${table} FROM authenticated; END IF;
      END $$`);
    }
  }
  async down(q: QueryRunner) {
    const [row] = await q.query('SELECT count(*)::int AS n FROM tch_campaign_brief_revision');
    if (row.n) throw new Error('Shared brief history exists; disable the feature instead of deleting revisions.');
    await q.query('DROP TABLE tch_campaign_brief_creator, tch_campaign_brief_member');
    await q.query('ALTER TABLE tch_campaign_brief DROP COLUMN shared_revision_id');
    await q.query('DROP TABLE tch_campaign_brief_revision');
    await q.query('DROP TABLE tch_campaign_brief');
  }
}
