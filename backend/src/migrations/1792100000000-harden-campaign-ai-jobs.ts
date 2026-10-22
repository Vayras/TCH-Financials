import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenCampaignAiJobs1792100000000 implements MigrationInterface {
  name = 'HardenCampaignAiJobs1792100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE tch_campaign_ai_job ADD COLUMN request_key uuid');
    await queryRunner.query(`WITH active AS (
      SELECT id,row_number() OVER (PARTITION BY campaign_id,creator_id ORDER BY created_at DESC,id DESC) AS position
      FROM tch_campaign_ai_job WHERE status IN ('pending','processing')
    ) UPDATE tch_campaign_ai_job j SET status='failed',error_message='Superseded during AI job migration.',updated_at=now()
      FROM active WHERE j.id=active.id AND (active.position>1 OR j.updated_at<now()-interval '5 minutes')`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_campaign_ai_request_key
      ON tch_campaign_ai_job(campaign_id, creator_id, request_key) WHERE request_key IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_campaign_ai_active_creator_campaign
      ON tch_campaign_ai_job(campaign_id, creator_id) WHERE status IN ('pending','processing')`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX uq_campaign_ai_active_creator_campaign');
    await queryRunner.query('DROP INDEX uq_campaign_ai_request_key');
    await queryRunner.query('ALTER TABLE tch_campaign_ai_job DROP COLUMN request_key');
  }
}
