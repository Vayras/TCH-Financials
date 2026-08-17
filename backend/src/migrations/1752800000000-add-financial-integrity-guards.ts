import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 integrity guards are deliberately conditional. A production deploy
 * must never rewrite or delete legacy financial data, and a dirty legacy row
 * must not make the migration fail. Each constraint is installed only when
 * every existing row already satisfies it; otherwise the preflight report
 * identifies the remediation needed and the API validation remains active.
 */
export class AddFinancialIntegrityGuards1752800000000 implements MigrationInterface {
  name = 'AddFinancialIntegrityGuards1752800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const guards: Array<[string, string, string]> = [
      ['tch_commercialdeal', 'ck_deal_nonnegative_money', `
        total_fee >= 0 AND agency_fee_inr >= 0 AND creator_fee >= 0 AND
        client_invoice_amount >= 0 AND client_payment_received_amount >= 0 AND
        creator_invoice_amount >= 0`],
      ['tch_commercialdeal', 'ck_deal_agency_pct', 'agency_fee_pct >= 0 AND agency_fee_pct <= 1'],
      ['tch_commercialdeal', 'ck_deal_direction', `direction IN ('Inbound', 'Outbound', 'MarkUp')`],
      ['tch_commercialdeal', 'ck_deal_flags', `
        campaign_over IN ('', 'Y', 'N') AND invoice_received IN ('', 'Y', 'N') AND
        payment_cleared IN ('', 'Y', 'N') AND payment_received IN ('', 'Y', 'N')`],
      ['tch_dealcreatorshare', 'ck_share_nonnegative_money', `
        total_fee >= 0 AND agency_fee_inr >= 0 AND creator_fee >= 0 AND
        agency_fee_pct >= 0 AND agency_fee_pct <= 1`],
      ['tch_creatorinvoice', 'ck_creatorinvoice_nonnegative_amount', 'invoice_amount >= 0'],
      ['tch_payment_transaction', 'ck_payment_one_sided_positive', `
        debit_amount >= 0 AND credit_amount >= 0 AND
        ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0))`],
      ['tch_tds_entry', 'ck_tds_values', `
        quarter IN ('Q1', 'Q2', 'Q3', 'Q4') AND tds_rate >= 0 AND tds_rate <= 1 AND
        gross_amount >= 0 AND tds_amount >= 0 AND net_payable >= 0 AND
        status IN ('Pending', 'Remitted')`],
    ];

    for (const [table, name, expression] of guards) {
      await queryRunner.query(`
        DO $guard$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}')
             AND NOT EXISTS (SELECT 1 FROM ${table} WHERE NOT (${expression})) THEN
            ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${expression}) NOT VALID;
            ALTER TABLE ${table} VALIDATE CONSTRAINT ${name};
          END IF;
        END
        $guard$;
      `);
    }

    // Prevent duplicate split creators only when no legacy duplicates exist.
    await queryRunner.query(`
      DO $guard$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_share_deal_creator')
           AND NOT EXISTS (
             SELECT 1 FROM tch_dealcreatorshare WHERE creator_id IS NOT NULL
             GROUP BY deal_id, creator_id HAVING COUNT(*) > 1
           ) THEN
          CREATE UNIQUE INDEX uq_share_deal_creator
            ON tch_dealcreatorshare (deal_id, creator_id) WHERE creator_id IS NOT NULL;
        END IF;
      END
      $guard$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_share_deal_creator`);
    for (const [table, name] of [
      ['tch_commercialdeal', 'ck_deal_nonnegative_money'],
      ['tch_commercialdeal', 'ck_deal_agency_pct'],
      ['tch_commercialdeal', 'ck_deal_direction'],
      ['tch_commercialdeal', 'ck_deal_flags'],
      ['tch_dealcreatorshare', 'ck_share_nonnegative_money'],
      ['tch_creatorinvoice', 'ck_creatorinvoice_nonnegative_amount'],
      ['tch_payment_transaction', 'ck_payment_one_sided_positive'],
      ['tch_tds_entry', 'ck_tds_values'],
    ]) {
      await queryRunner.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${name}`);
    }
  }
}

