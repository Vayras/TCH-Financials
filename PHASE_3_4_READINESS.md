# Phase 3 and 4 — staging, testing, and production readiness

The local/synthetic portion of Phases 3 and 4 is complete. Production has not
been accessed and no production backup, restore, migration, or deployment has
been performed.

## Implemented controls

- Atomic PostgreSQL custom-format backups, validated with `pg_restore --list`.
- SHA-256 checksum sidecars for database and media archives.
- Atomic media archives validated with `tar -tzf`.
- No automatic backup deletion or retention pruning.
- A hard-locked staging database on `127.0.0.1:5434` with its own Docker volume.
- A restore script that refuses to run without the exact staging confirmation
  and cannot accept an arbitrary target URL.
- Read-only financial integrity checks on restored databases.
- Critical HTTP checks for health, headers, CORS, role boundaries, invalid
  financial writes, and non-public media.
- A fail-closed static production configuration preflight.
- A database-aware `GET /api/health` endpoint for monitoring.

## Rehearsal commands

```bash
npm run docker:staging

# Source credentials must be supplied explicitly. This reads but never writes
# the source database.
DATABASE_URL=postgresql://... BACKUP_DIR=/secure/backups ./scripts/db_backup.sh
MEDIA_ROOT=/var/lib/tch/media BACKUP_DIR=/secure/backups ./scripts/media_backup.sh

./scripts/verify_backup.sh /secure/backups/tch_db_<timestamp>.dump \
  /secure/backups/tch_media_<timestamp>.tar.gz

CONFIRM_STAGING_RESTORE=tch_financials_staging \
  ./scripts/restore_staging.sh /secure/backups/tch_db_<timestamp>.dump \
  /secure/backups/tch_media_<timestamp>.tar.gz

cd backend
APP_ENV=development \
DATABASE_URL=postgresql://tch_staging:tch_staging_only@127.0.0.1:5434/tch_financials_staging \
npm run integrity:preflight
```

Never put production credentials in either Docker Compose file. A real backup
must be stored encrypted outside the repository and copied off the application
host before deployment.

## Deployment go/no-go checklist

Every item must be recorded as PASS:

1. Named deployment owner and maintenance window.
2. Exact release commit/tag recorded and previous release still available.
3. Production configuration preflight passes.
4. Fresh database and media backups exist with valid SHA-256 checksums.
5. Both backups have been restored together into isolated staging.
6. Source/restored counts match for migrations, creators, campaigns, deals,
   invoices, payments, TDS entries, and media files.
7. Restored staging passes integrity preflight and migrations.
8. Automated tests, builds, dependency audits, and critical smoke checks pass.
9. Manual role matrix passes for Super Admin, Accounts, TCH Member, Creator,
   pending, rejected, and unauthenticated users.
10. Financial totals are recorded before deployment for post-deploy comparison.
11. Rollback operator has access to the previous release and service manager.
12. No unresolved preflight failures or skipped database constraints.

## Rollback runbook

Prefer application rollback because Phase 1/2 migrations are additive and the
older application can continue to read the existing tables.

1. Stop deployment and record the observed failure/time.
2. Put the site in maintenance mode if writes could be unsafe.
3. Switch the application checkout/symlink to the recorded previous release.
4. Run `npm ci` and build that exact release if immutable artifacts are not
   already retained.
5. Restart backend/frontend, then verify `/api/health`, authentication, and
   read-only financial totals.
6. Do not run TypeORM `migration:revert` during an incident unless a reviewed
   migration-specific plan explicitly requires it.
7. Restore the database/media backup only for confirmed data corruption, with
   business-owner approval, because restore replaces newer production writes.

## Still requiring explicit production authorization

- Read-only production integrity preflight.
- Production database and media backup creation.
- Copying sensitive backups to approved encrypted storage.
- Restoring production-shaped data into access-controlled staging.
- Manual role/UAT checks using real Supabase authentication.
- Production migration, deployment, monitoring, and reconciliation.

