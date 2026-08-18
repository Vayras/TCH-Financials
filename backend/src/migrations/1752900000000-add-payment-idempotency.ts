import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds concurrency-safe duplicate prevention without touching legacy rows. */
export class AddPaymentIdempotency1752900000000 implements MigrationInterface {
  name = 'AddPaymentIdempotency1752900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $guard$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_payment_business_key')
           AND NOT EXISTS (
             SELECT 1 FROM tch_payment_transaction
             GROUP BY transaction_date, lower(vendor_name), lower(utr_or_ref), debit_amount, credit_amount
             HAVING COUNT(*) > 1
           ) THEN
          CREATE UNIQUE INDEX uq_payment_business_key ON tch_payment_transaction (
            transaction_date, lower(vendor_name), lower(utr_or_ref), debit_amount, credit_amount
          );
        END IF;
      END
      $guard$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_payment_business_key`);
  }
}

