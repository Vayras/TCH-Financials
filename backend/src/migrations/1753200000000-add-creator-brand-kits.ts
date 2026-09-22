import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreatorBrandKits1753200000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE tch_creator_brand_kit (
      creator_id bigint PRIMARY KEY REFERENCES tch_creator(id) ON DELETE CASCADE,
      slug varchar(80) NOT NULL UNIQUE, version int NOT NULL DEFAULT 0,
      draft jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(draft) = 'object'),
      published_revision uuid, updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE tch_creator_brand_kit_revision (
      id uuid PRIMARY KEY, creator_id bigint NOT NULL REFERENCES tch_creator_brand_kit(creator_id) ON DELETE CASCADE,
      draft_version int NOT NULL, content jsonb NOT NULL CHECK (jsonb_typeof(content) = 'object'),
      published_at timestamptz NOT NULL DEFAULT now(), UNIQUE(creator_id, draft_version), UNIQUE(creator_id,id)
    )`);
    await q.query(`ALTER TABLE tch_creator_brand_kit ADD CONSTRAINT fk_brand_kit_publication
      FOREIGN KEY (creator_id,published_revision) REFERENCES tch_creator_brand_kit_revision(creator_id,id)`);
    for (const table of ['tch_creator_brand_kit','tch_creator_brand_kit_revision']) {
      await q.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q.query(`REVOKE ALL ON ${table} FROM PUBLIC`);
      await q.query(`DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON ${table} FROM anon; END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON ${table} FROM authenticated; END IF;
      END $$`);
    }
  }
  async down(q: QueryRunner) {
    await q.query('ALTER TABLE tch_creator_brand_kit DROP CONSTRAINT fk_brand_kit_publication');
    await q.query('DROP TABLE tch_creator_brand_kit_revision');
    await q.query('DROP TABLE tch_creator_brand_kit');
  }
}
