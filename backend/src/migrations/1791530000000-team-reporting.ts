import { MigrationInterface, QueryRunner } from 'typeorm';
export class TeamReporting1791530000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE tch_commercialdeal ADD COLUMN responsible_member_id uuid REFERENCES tch_profile(id) ON DELETE SET NULL;
      CREATE INDEX ON tch_commercialdeal(responsible_member_id,confirmation_date);
      CREATE TABLE tch_team_weekly_note(member_id uuid REFERENCES tch_profile(id) ON DELETE CASCADE,week_ending date NOT NULL,note text NOT NULL DEFAULT '',version integer NOT NULL DEFAULT 1,PRIMARY KEY(member_id,week_ending));`);
  }
  async down(q: QueryRunner) { await q.query('DROP TABLE tch_team_weekly_note; ALTER TABLE tch_commercialdeal DROP COLUMN responsible_member_id'); }
}
