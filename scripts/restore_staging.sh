#!/usr/bin/env bash
# Destructive only to the hard-coded local staging database and .staging/media.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXPECTED_CONFIRMATION="tch_financials_staging"
STAGING_ADMIN_URL="postgresql://tch_staging:tch_staging_only@127.0.0.1:5434/postgres"
STAGING_DATABASE_URL="postgresql://tch_staging:tch_staging_only@127.0.0.1:5434/tch_financials_staging"

[ "$#" -ge 1 ] || { echo "Usage: CONFIRM_STAGING_RESTORE=tch_financials_staging $0 DATABASE.dump [MEDIA.tar.gz]" >&2; exit 1; }
[ "${CONFIRM_STAGING_RESTORE:-}" = "$EXPECTED_CONFIRMATION" ] || {
  echo "[restore] REFUSED: set CONFIRM_STAGING_RESTORE=$EXPECTED_CONFIRMATION." >&2
  exit 1
}
"$REPO_ROOT/scripts/verify_backup.sh" "$@"
echo "[restore] Recreating only local staging database on 127.0.0.1:5434."
psql "$STAGING_ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS tch_financials_staging WITH (FORCE)"
psql "$STAGING_ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE tch_financials_staging"
pg_restore --exit-on-error --no-owner --no-acl --dbname="$STAGING_DATABASE_URL" "$1"

if [ "$#" -ge 2 ]; then
  staging_media="$REPO_ROOT/.staging/media"
  mkdir -p "$REPO_ROOT/.staging"
  rm -rf "$staging_media"
  mkdir -p "$staging_media"
  tar -xzf "$2" -C "$staging_media"
  echo "[restore] Media restored under $staging_media."
fi
echo "[restore] Staging restore completed."
