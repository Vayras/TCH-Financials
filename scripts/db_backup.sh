#!/usr/bin/env bash
# Atomic, verifiable PostgreSQL backup. Never modifies the source database.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
mkdir -p "$BACKUP_DIR"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_ROOT/.env"
  set +a
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backup] ERROR: DATABASE_URL is not set." >&2
  exit 1
fi
for command_name in pg_dump pg_restore; do
  command -v "$command_name" >/dev/null || { echo "[backup] ERROR: $command_name is required." >&2; exit 1; }
done

timestamp="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
outfile="$BACKUP_DIR/tch_db_${timestamp}.dump"
tmpfile="$(mktemp "$BACKUP_DIR/.tch_db_${timestamp}.XXXXXX")"
trap 'rm -f "$tmpfile"' EXIT

echo "[backup] Creating consistent custom-format database snapshot."
pg_dump --format=custom --compress=9 --no-owner --no-acl --file="$tmpfile" "$DATABASE_URL"
pg_restore --list "$tmpfile" >/dev/null
mv "$tmpfile" "$outfile"
trap - EXIT

if command -v sha256sum >/dev/null; then
  (cd "$BACKUP_DIR" && sha256sum "$(basename "$outfile")" > "$(basename "$outfile").sha256")
else
  (cd "$BACKUP_DIR" && shasum -a 256 "$(basename "$outfile")" > "$(basename "$outfile").sha256")
fi
chmod 600 "$outfile" "$outfile.sha256"
echo "[backup] Verified: $outfile"
echo "[backup] Checksum: $outfile.sha256"
echo "[backup] Automatic pruning is disabled; retention must use a reviewed storage policy."
