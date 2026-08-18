# Phase 2 — data integrity and financial correctness

Phase 2 is implemented and verified in the isolated Docker development stack.
Nothing in this phase has been run against production.

## What is protected

- Invalid, negative, non-finite, or over-precision money is rejected instead
  of being silently converted to zero.
- Dates must be real calendar dates in `YYYY-MM-DD` format.
- Deal directions, Y/N flags, payment statuses, payment cycles, TDS quarters,
  and TDS statuses use explicit allow-lists.
- Creator IDs, deal IDs, and creator/deal assignments are checked before
  financial records are written.
- Duplicate split creators, duplicate creator invoices, and likely duplicate
  payment transactions are rejected.
- A payment must contain exactly one positive debit or credit amount.
- Spreadsheet payments are validated before a database transaction writes the
  accepted rows, preventing half-finished imports after a database error.
- PostgreSQL check constraints provide a second enforcement layer beneath the
  API.

## Non-destructive migration behavior

Migrations `1752800000000-add-financial-integrity-guards.ts` and
`1752900000000-add-payment-idempotency.ts` contain no `UPDATE`, `DELETE`,
`TRUNCATE`, or table recreation. Each constraint/index is added only when all
existing rows satisfy it. If legacy data violates a guard, that guard is
skipped rather than changing data or failing the deployment.

Skipping a guard is safe for existing data but must be treated as a rollout
blocker: review the read-only preflight output and agree on remediation before
production traffic uses the Phase 2 code.

## Read-only preflight

Local Docker:

```bash
docker compose -f docker-compose.dev.yml exec backend npm run integrity:preflight
```

The script starts a read-only database transaction and reports counts only. It
refuses remote databases by default. A production execution requires the
explicit `ALLOW_PRODUCTION_PREFLIGHT=true` opt-in and separate authorization.

## Required production rollout gates

Do not deploy Phase 1 or Phase 2 until every gate is complete:

1. Create timestamped database and media backups.
2. Verify backup checksums and retain a copy outside the application host.
3. Restore both backups into a separate staging environment.
4. Run the integrity preflight against that restored copy and review every
   non-zero count; never auto-delete or auto-correct financial records.
5. Apply migrations to staging and confirm all expected constraints exist.
6. Run role, creator-isolation, upload/download, deal, payment, and TDS smoke
   tests on staging.
7. Record the application rollback version. Database rollback is not normally
   needed because this migration is additive; its `down` only drops the new
   guards and does not modify rows.
8. Schedule production deployment, repeat backup/preflight immediately before
   migration, deploy, and run read-only post-deploy verification.

Production backup, restore, remediation, migration, and deployment are not
part of the completed local Phase 2 work and require explicit authorization.
