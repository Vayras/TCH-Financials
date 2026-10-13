import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatorNotificationReadState1791900000000 implements MigrationInterface {
  name = 'CreatorNotificationReadState1791900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE tch_creator_notification_read (
      user_id uuid PRIMARY KEY REFERENCES tch_profile(id) ON DELETE CASCADE,
      last_seen_at timestamptz NOT NULL DEFAULT (now() - interval '7 days')
    )`);
    await queryRunner.query('ALTER TABLE tch_creator_notification_read ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('REVOKE ALL ON tch_creator_notification_read FROM PUBLIC');
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON tch_creator_notification_read FROM anon; END IF;
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON tch_creator_notification_read FROM authenticated; END IF;
    END $$`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE tch_creator_notification_read');
  }
}
