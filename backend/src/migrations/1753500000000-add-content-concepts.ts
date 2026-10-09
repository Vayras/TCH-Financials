import {MigrationInterface,QueryRunner} from 'typeorm';
export class AddContentConcepts1753500000000 implements MigrationInterface {
 async up(q:QueryRunner){
  await q.query(`CREATE TABLE tch_content_concept (
   id uuid PRIMARY KEY,campaign_id bigint NOT NULL REFERENCES tch_campaign_brief(campaign_id) ON DELETE RESTRICT,
   creator_id bigint NOT NULL REFERENCES tch_creator(id) ON DELETE RESTRICT,
   state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','submitted','changes_requested','approved')),
   version integer NOT NULL DEFAULT 1 CHECK(version>0),current_revision uuid,submitted_revision uuid,approved_revision uuid,
   created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,campaign_id))`);
  await q.query(`CREATE TABLE tch_content_concept_revision (
   id uuid PRIMARY KEY,concept_id uuid NOT NULL,campaign_id bigint NOT NULL,brief_revision_id uuid NOT NULL,
   content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),created_by uuid NOT NULL REFERENCES tch_profile(id),
   created_at timestamptz NOT NULL DEFAULT now(),submitted_at timestamptz,
   FOREIGN KEY(concept_id,campaign_id) REFERENCES tch_content_concept(id,campaign_id) ON DELETE RESTRICT,
   FOREIGN KEY(campaign_id,brief_revision_id) REFERENCES tch_campaign_brief_revision(campaign_id,id),UNIQUE(concept_id,id))`);
  for(const column of ['current_revision','submitted_revision','approved_revision']) await q.query(`ALTER TABLE tch_content_concept ADD FOREIGN KEY(id,${column}) REFERENCES tch_content_concept_revision(concept_id,id)`);
  await q.query(`CREATE TABLE tch_content_concept_review (
   id uuid PRIMARY KEY,concept_id uuid NOT NULL,revision_id uuid NOT NULL UNIQUE,
   decision text NOT NULL CHECK(decision IN ('approved','changes_requested')),message text NOT NULL,
   author_id uuid NOT NULL REFERENCES tch_profile(id),created_at timestamptz NOT NULL DEFAULT now(),
   FOREIGN KEY(concept_id,revision_id) REFERENCES tch_content_concept_revision(concept_id,id))`);
  await q.query(`CREATE TABLE tch_content_concept_feedback (
   id uuid PRIMARY KEY,concept_id uuid NOT NULL,revision_id uuid NOT NULL,section text NOT NULL,
   message text NOT NULL,visibility text NOT NULL CHECK(visibility IN ('shared','internal')),
   author_id uuid NOT NULL REFERENCES tch_profile(id),created_at timestamptz NOT NULL DEFAULT now(),
   FOREIGN KEY(concept_id,revision_id) REFERENCES tch_content_concept_revision(concept_id,id))`);
  await q.query('CREATE INDEX ON tch_content_concept(campaign_id,creator_id,updated_at DESC)');
  await q.query('CREATE INDEX ON tch_content_concept_revision(concept_id,created_at DESC)');
  await q.query('CREATE INDEX ON tch_content_concept_feedback(concept_id,created_at)');
  for(const table of ['tch_content_concept','tch_content_concept_revision','tch_content_concept_review','tch_content_concept_feedback']){
   await q.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
   await q.query(`REVOKE ALL ON ${table} FROM PUBLIC`);
   await q.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON ${table} FROM anon; END IF; IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON ${table} FROM authenticated; END IF; END $$`);
  }
 }
 async down(q:QueryRunner){
  const [row]=await q.query('SELECT count(*)::int AS n FROM tch_content_concept');
  if(row.n)throw new Error('Concept history exists; disable the feature instead of dropping data.');
  await q.query('DROP TABLE tch_content_concept_feedback,tch_content_concept_review');
  await q.query('ALTER TABLE tch_content_concept DROP COLUMN current_revision,DROP COLUMN submitted_revision,DROP COLUMN approved_revision');
  await q.query('DROP TABLE tch_content_concept_revision');await q.query('DROP TABLE tch_content_concept');
 }
}
