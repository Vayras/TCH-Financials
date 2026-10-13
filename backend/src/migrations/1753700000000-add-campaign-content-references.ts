import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaignContentReferences1753700000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE tch_campaign_content_reference (
      id uuid PRIMARY KEY,
      campaign_id bigint NOT NULL REFERENCES tch_campaign(id) ON DELETE CASCADE,
      creator_id bigint NOT NULL REFERENCES tch_creator(id) ON DELETE CASCADE,
      snapshot_id uuid NOT NULL REFERENCES tch_creator_social_snapshot(id) ON DELETE CASCADE,
      post_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(campaign_id, creator_id, snapshot_id, post_id)
    )`);
    await q.query('CREATE INDEX idx_campaign_content_reference_owner ON tch_campaign_content_reference(campaign_id, creator_id, created_at DESC)');
  }
  async down(q: QueryRunner) { await q.query('DROP TABLE tch_campaign_content_reference'); }
}
