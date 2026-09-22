import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaignAiIdeas1753600000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE tch_campaign_ai_job (
      id uuid PRIMARY KEY,
      campaign_id bigint NOT NULL REFERENCES tch_campaign_brief(campaign_id) ON DELETE RESTRICT,
      brief_revision_id uuid NOT NULL,
      creator_id bigint NOT NULL REFERENCES tch_creator(id) ON DELETE RESTRICT,
      status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
      error_message text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY(campaign_id, brief_revision_id) REFERENCES tch_campaign_brief_revision(campaign_id, id)
    )`);

    await q.query(`CREATE TABLE tch_campaign_ai_idea (
      id uuid PRIMARY KEY,
      job_id uuid NOT NULL REFERENCES tch_campaign_ai_job(id) ON DELETE CASCADE,
      campaign_id bigint NOT NULL,
      creator_id bigint NOT NULL,
      title text NOT NULL,
      hook text NOT NULL,
      outline text NOT NULL,
      script_draft text NOT NULL,
      cta text NOT NULL,
      rationale text NOT NULL,
      is_expanded boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query('CREATE INDEX ON tch_campaign_ai_job(campaign_id, creator_id, created_at DESC)');
    await q.query('CREATE INDEX ON tch_campaign_ai_idea(job_id, created_at)');

    for (const table of ['tch_campaign_ai_job', 'tch_campaign_ai_idea']) {
      await q.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q.query(`REVOKE ALL ON ${table} FROM PUBLIC`);
      await q.query(
        `DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON ${table} FROM anon; END IF; IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON ${table} FROM authenticated; END IF; END $$`
      );
    }
  }

  async down(q: QueryRunner) {
    await q.query('DROP TABLE tch_campaign_ai_idea');
    await q.query('DROP TABLE tch_campaign_ai_job');
  }
}
