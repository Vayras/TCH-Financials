import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateCreatorSocialToTrioSphere1792000000000 implements MigrationInterface {
  name = 'MigrateCreatorSocialToTrioSphere1792000000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE tch_creator_social_import SET state = 'failed', error_code = 'provider_migrated',
      finished_at = now(), lease_token = NULL, lease_until = NULL
      WHERE state IN ('queued','triggering','collecting','needs_review')`);
    await q.query(
      `ALTER TABLE tch_creator_social_snapshot ALTER COLUMN source SET DEFAULT 'triosphere'`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE tch_creator_social_snapshot ALTER COLUMN source SET DEFAULT 'brightdata'`,
    );
  }
}
