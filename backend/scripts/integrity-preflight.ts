import { AppDataSource } from '../src/data-source';

const checks: Array<{ key: string; description: string; sql: string }> = [
  { key: 'deal_negative_money', description: 'Deals with negative financial amounts', sql: `SELECT COUNT(*)::int AS count FROM tch_commercialdeal WHERE total_fee < 0 OR agency_fee_inr < 0 OR creator_fee < 0 OR client_invoice_amount < 0 OR client_payment_received_amount < 0 OR creator_invoice_amount < 0` },
  { key: 'deal_invalid_pct', description: 'Deals with agency percentage outside 0..1', sql: `SELECT COUNT(*)::int AS count FROM tch_commercialdeal WHERE agency_fee_pct < 0 OR agency_fee_pct > 1` },
  { key: 'deal_invalid_enum', description: 'Deals with invalid direction or Y/N flags', sql: `SELECT COUNT(*)::int AS count FROM tch_commercialdeal WHERE direction NOT IN ('Inbound','Outbound','MarkUp') OR campaign_over NOT IN ('','Y','N') OR invoice_received NOT IN ('','Y','N') OR payment_cleared NOT IN ('','Y','N') OR payment_received NOT IN ('','Y','N')` },
  { key: 'duplicate_shares', description: 'Duplicate creator assignments on a deal', sql: `SELECT COUNT(*)::int AS count FROM (SELECT deal_id, creator_id FROM tch_dealcreatorshare WHERE creator_id IS NOT NULL GROUP BY deal_id, creator_id HAVING COUNT(*) > 1) duplicates` },
  { key: 'orphan_invoice_assignment', description: 'Creator invoices whose creator is not assigned to the deal', sql: `SELECT COUNT(*)::int AS count FROM tch_creatorinvoice invoice JOIN tch_commercialdeal deal ON deal.id = invoice.deal_id WHERE invoice.creator_id IS DISTINCT FROM deal.creator_id AND NOT EXISTS (SELECT 1 FROM tch_dealcreatorshare share WHERE share.deal_id = invoice.deal_id AND share.creator_id = invoice.creator_id)` },
  { key: 'invalid_payments', description: 'Payments without exactly one positive debit/credit', sql: `SELECT COUNT(*)::int AS count FROM tch_payment_transaction WHERE debit_amount < 0 OR credit_amount < 0 OR NOT ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0))` },
  { key: 'duplicate_payments', description: 'Likely duplicate payment rows', sql: `SELECT COUNT(*)::int AS count FROM (SELECT transaction_date, lower(vendor_name), lower(utr_or_ref), debit_amount, credit_amount FROM tch_payment_transaction GROUP BY transaction_date, lower(vendor_name), lower(utr_or_ref), debit_amount, credit_amount HAVING COUNT(*) > 1) duplicates` },
  { key: 'invalid_tds', description: 'TDS rows with invalid values/status', sql: `SELECT COUNT(*)::int AS count FROM tch_tds_entry WHERE quarter NOT IN ('Q1','Q2','Q3','Q4') OR tds_rate < 0 OR tds_rate > 1 OR gross_amount < 0 OR tds_amount < 0 OR net_payable < 0 OR status NOT IN ('Pending','Remitted')` },
];

async function main() {
  const isRemote = !/@(localhost|127\.0\.0\.1|db)[:/]/.test(process.env.DATABASE_URL ?? '');
  if (isRemote && process.env.ALLOW_PRODUCTION_PREFLIGHT !== 'true') {
    throw new Error('Remote database refused. Set ALLOW_PRODUCTION_PREFLIGHT=true only for an approved read-only production audit.');
  }
  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query('SET TRANSACTION READ ONLY');
    let failures = 0;
    for (const check of checks) {
      const [{ count }] = await runner.query(check.sql);
      const numericCount = Number(count);
      if (numericCount > 0) failures += 1;
      process.stdout.write(`${numericCount > 0 ? 'FAIL' : 'PASS'} ${check.key}: ${numericCount} — ${check.description}\n`);
    }
    await runner.rollbackTransaction();
    process.exitCode = failures ? 2 : 0;
  } finally {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    await runner.release();
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

