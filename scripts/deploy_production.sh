#!/usr/bin/env bash
# Guarded production deploy. Must run on the configured production host.
set -euo pipefail

release_sha="${1:-}"
previous_sha="${2:-}"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
backup_dir="${BACKUP_DIR:-/var/lib/tch/backups}"
media_root="${MEDIA_ROOT:-/var/lib/tch/media}"
lock_file="${TCH_DEPLOY_LOCK:-/var/lib/tch/deploy.lock}"

[ "$release_sha" != "" ] && [ "$previous_sha" != "" ] || {
  echo "[deploy] Release and rollback SHAs are required." >&2
  exit 1
}
exec 9>"$lock_file"
flock -n 9 || { echo "[deploy] Another deployment is active." >&2; exit 1; }
cd "$repo_root"
[ "$(git rev-parse HEAD)" = "$release_sha" ] || { echo "[deploy] Checkout does not match release SHA." >&2; exit 1; }

set -a
# shellcheck disable=SC1091
. ./.env
if [ -f frontend/.env.local ]; then
  # shellcheck disable=SC1091
  . ./frontend/.env.local
fi
set +a
export APP_ENV=production BACKUP_DIR="$backup_dir" MEDIA_ROOT="$media_root"
[ "$APP_ENV" = "production" ] || {
  echo "[deploy] APP_ENV must be production." >&2
  exit 1
}

echo "[deploy] Running fail-closed production configuration preflight."
(cd backend && npm ci && npm run production:preflight)

echo "[deploy] Creating fresh database and media backups before any migration."
./scripts/db_backup.sh
./scripts/media_backup.sh
database_backup="$(find "$backup_dir" -maxdepth 1 -type f -name 'tch_db_*.dump' -print | sort | tail -1)"
media_backup="$(find "$backup_dir" -maxdepth 1 -type f -name 'tch_media_*.tar.gz' -print | sort | tail -1)"
./scripts/verify_backup.sh "$database_backup" "$media_backup"

echo "[deploy] Verifying the production migration ledger before allowing migrations."
psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 <<'SQL'
DO $migration_guard$
DECLARE
  domain_tables_exist boolean;
  migration_table_exists boolean;
  initial_migration_recorded boolean := false;
BEGIN
  domain_tables_exist :=
    to_regclass('public.tch_creator') IS NOT NULL OR
    to_regclass('public.tch_campaign') IS NOT NULL OR
    to_regclass('public.tch_commercialdeal') IS NOT NULL;
  migration_table_exists := to_regclass('public.migrations') IS NOT NULL;

  IF migration_table_exists THEN
    SELECT EXISTS (
      SELECT 1 FROM public.migrations
      WHERE name = 'InitialSchema1751800000000'
         OR timestamp = 1751800000000
    ) INTO initial_migration_recorded;
  END IF;

  IF domain_tables_exist AND NOT initial_migration_recorded THEN
    RAISE EXCEPTION USING MESSAGE =
      'Deployment refused: domain tables exist but the initial TypeORM migration is not recorded. Baseline the migration ledger manually after schema verification; do not run the destructive initial migration.';
  END IF;
END
$migration_guard$;
SQL

echo "[deploy] Building release before changing the database or services."
(cd backend && npm run typecheck && npm test && npm run build)
(cd frontend && npm ci && npm run typecheck && npm run build)

echo "[deploy] Capturing pre-deploy financial counts."
mkdir -p "$backup_dir/release-manifests"
psql "$DATABASE_URL" -Atc "SELECT 'creators',COUNT(*) FROM tch_creator UNION ALL SELECT 'campaigns',COUNT(*) FROM tch_campaign UNION ALL SELECT 'deals',COUNT(*) FROM tch_commercialdeal UNION ALL SELECT 'invoices',COUNT(*) FROM tch_creatorinvoice UNION ALL SELECT 'payments',COUNT(*) FROM tch_payment_transaction UNION ALL SELECT 'tds',COUNT(*) FROM tch_tds_entry ORDER BY 1" > "$backup_dir/release-manifests/$release_sha.before-counts"

echo "[deploy] Running additive migrations and restarting services."
(cd backend && APP_ENV=production npx typeorm-ts-node-commonjs -d src/data-source.ts migration:run)
sudo systemctl restart tch-backend tch-frontend
curl --fail --silent --show-error --retry 12 --retry-delay 2 http://127.0.0.1:8000/api/health >/dev/null

psql "$DATABASE_URL" -Atc "SELECT 'creators',COUNT(*) FROM tch_creator UNION ALL SELECT 'campaigns',COUNT(*) FROM tch_campaign UNION ALL SELECT 'deals',COUNT(*) FROM tch_commercialdeal UNION ALL SELECT 'invoices',COUNT(*) FROM tch_creatorinvoice UNION ALL SELECT 'payments',COUNT(*) FROM tch_payment_transaction UNION ALL SELECT 'tds',COUNT(*) FROM tch_tds_entry ORDER BY 1" > "$backup_dir/release-manifests/$release_sha.after-counts"
diff -u "$backup_dir/release-manifests/$release_sha.before-counts" "$backup_dir/release-manifests/$release_sha.after-counts"
echo "[deploy] Health and financial count reconciliation passed. Rollback SHA: $previous_sha"
