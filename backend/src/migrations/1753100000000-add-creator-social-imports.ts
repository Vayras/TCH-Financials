import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreatorSocialImports1753100000000 implements MigrationInterface {
  name = 'AddCreatorSocialImports1753100000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE tch_creator_social_account (
      id uuid PRIMARY KEY, creator_id bigint NOT NULL REFERENCES tch_creator(id) ON DELETE CASCADE,
      platform varchar(20) NOT NULL DEFAULT 'instagram' CHECK (platform = 'instagram'),
      username varchar(30) NOT NULL, profile_url text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (creator_id, platform, username)
    )`);
    await q.query(`CREATE TABLE tch_creator_social_import (
      id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES tch_creator_social_account(id) ON DELETE CASCADE,
      requested_by uuid NOT NULL, idempotency_key uuid NOT NULL, dataset_id varchar(100) NOT NULL,
      state varchar(20) NOT NULL DEFAULT 'queued'
        CHECK (state IN ('queued','triggering','collecting','succeeded','failed','needs_review')),
      provider_snapshot_id varchar(100), error_code varchar(100),
      attempts int NOT NULL DEFAULT 0, lease_token uuid, lease_until timestamptz,
      next_attempt_at timestamptz NOT NULL DEFAULT now(),
      requested_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
      UNIQUE(account_id, idempotency_key)
    )`);
    await q.query(`CREATE UNIQUE INDEX idx_social_one_active ON tch_creator_social_import(account_id)
      WHERE state IN ('queued','triggering','collecting','needs_review')`);
    await q.query(`CREATE INDEX idx_social_jobs_due ON tch_creator_social_import(next_attempt_at)
      WHERE state IN ('queued','collecting')`);
    await q.query(`CREATE INDEX idx_social_jobs_requested ON tch_creator_social_import(requested_at DESC)`);
    await q.query(`CREATE INDEX idx_social_account_jobs ON tch_creator_social_import(account_id, requested_at DESC)`);
    await q.query(`CREATE TABLE tch_creator_social_snapshot (
      id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES tch_creator_social_account(id) ON DELETE CASCADE,
      import_id uuid NOT NULL UNIQUE REFERENCES tch_creator_social_import(id) ON DELETE CASCADE,
      source varchar(30) NOT NULL DEFAULT 'brightdata', schema_version int NOT NULL,
      collected_at timestamptz NOT NULL DEFAULT now(), provider_collected_at timestamptz,
      profile jsonb NOT NULL CHECK (jsonb_typeof(profile) = 'object'),
      posts jsonb NOT NULL CHECK (jsonb_typeof(posts) = 'array' AND jsonb_array_length(posts) <= 50),
      coverage jsonb NOT NULL CHECK (jsonb_typeof(coverage) = 'object')
    )`);
    await q.query(`CREATE INDEX idx_social_latest_snapshot ON tch_creator_social_snapshot(account_id, collected_at DESC, id DESC)`);
    // No browser/Supabase REST policies: this data is accessible only through the authorized backend.
    for (const table of ['tch_creator_social_account', 'tch_creator_social_import', 'tch_creator_social_snapshot']) {
      await q.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q.query(`REVOKE ALL ON ${table} FROM PUBLIC`);
      await q.query(`DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON ${table} FROM anon; END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON ${table} FROM authenticated; END IF;
      END $$`);
    }
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE tch_creator_social_snapshot');
    await q.query('DROP TABLE tch_creator_social_import');
    await q.query('DROP TABLE tch_creator_social_account');
  }
}
