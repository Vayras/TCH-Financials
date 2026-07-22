import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDealBillingPeriod1752100000000 implements MigrationInterface {
  name = 'AddDealBillingPeriod1752100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tch_commercialdeal
        ADD COLUMN billing_period date,
        ADD COLUMN billing_fy_start integer,
        ADD COLUMN billing_month smallint CHECK (billing_month BETWEEN 1 AND 12)
    `);
    await queryRunner.query(`
      UPDATE tch_commercialdeal
      SET billing_period = date_trunc('month', COALESCE(e_invoice_date, confirmation_date))::date,
          billing_fy_start = CASE
            WHEN EXTRACT(MONTH FROM COALESCE(e_invoice_date, confirmation_date)) >= 4
              THEN EXTRACT(YEAR FROM COALESCE(e_invoice_date, confirmation_date))::integer
            ELSE EXTRACT(YEAR FROM COALESCE(e_invoice_date, confirmation_date))::integer - 1
          END,
          billing_month = EXTRACT(MONTH FROM COALESCE(e_invoice_date, confirmation_date))::smallint
      WHERE COALESCE(e_invoice_date, confirmation_date) IS NOT NULL
    `);
    await queryRunner.query(`CREATE INDEX idx_commercialdeal_billing_fy_period ON tch_commercialdeal (billing_fy_start, billing_period, id)`);
    await queryRunner.query(`CREATE INDEX idx_commercialdeal_direction ON tch_commercialdeal (direction)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_commercialdeal_direction`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_commercialdeal_billing_fy_period`);
    await queryRunner.query(`
      ALTER TABLE tch_commercialdeal
        DROP COLUMN billing_month,
        DROP COLUMN billing_fy_start,
        DROP COLUMN billing_period
    `);
  }
}
