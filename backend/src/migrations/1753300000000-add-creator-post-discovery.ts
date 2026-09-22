import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreatorPostDiscovery1753300000000 implements MigrationInterface {
  name = 'AddCreatorPostDiscovery1753300000000';
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE tch_creator_social_import
      ADD COLUMN purpose varchar(20) NOT NULL DEFAULT 'profile' CHECK (purpose IN ('profile','kit','update','more')),
      ADD COLUMN stage varchar(20) NOT NULL DEFAULT 'profile' CHECK (stage IN ('profile','posts')),
      ADD COLUMN posts_dataset_id varchar(100),
      ADD COLUMN post_limit int NOT NULL DEFAULT 30 CHECK (post_limit BETWEEN 1 AND 30),
      ADD COLUMN end_date varchar(10),
      ADD COLUMN prepared_data jsonb,
      ADD COLUMN request_units int NOT NULL DEFAULT 1 CHECK (request_units BETWEEN 1 AND 2)`);
    await q.query(`ALTER TABLE tch_creator_social_snapshot DROP CONSTRAINT tch_creator_social_snapshot_posts_check`);
    await q.query(`ALTER TABLE tch_creator_social_snapshot ADD CONSTRAINT tch_creator_social_snapshot_posts_check
      CHECK (jsonb_typeof(posts) = 'array' AND jsonb_array_length(posts) <= 300)`);
  }
  async down(q: QueryRunner) {
    // Refuse rollback if larger libraries exist instead of silently truncating saved content.
    await q.query(`ALTER TABLE tch_creator_social_snapshot DROP CONSTRAINT tch_creator_social_snapshot_posts_check`);
    await q.query(`ALTER TABLE tch_creator_social_snapshot ADD CONSTRAINT tch_creator_social_snapshot_posts_check
      CHECK (jsonb_typeof(posts) = 'array' AND jsonb_array_length(posts) <= 50)`);
    await q.query(`ALTER TABLE tch_creator_social_import DROP COLUMN purpose, DROP COLUMN stage,
      DROP COLUMN posts_dataset_id, DROP COLUMN post_limit, DROP COLUMN end_date,
      DROP COLUMN prepared_data, DROP COLUMN request_units`);
  }
}
