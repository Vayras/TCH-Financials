#!/usr/bin/env bash
# TCH Financials — PostgreSQL snapshot script
# Usage: ./scripts/db_backup.sh
# Dumps the database to backups/<timestamp>.sql.gz and keeps the last 28 files (7 days at 4x/day).

set -euo pipefail

BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
OUTFILE="$BACKUP_DIR/tch_${TIMESTAMP}.sql.gz"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backup] ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

echo "[backup] Starting snapshot → $OUTFILE"
pg_dump "$DATABASE_URL" | gzip > "$OUTFILE"
SIZE=$(du -sh "$OUTFILE" | cut -f1)
echo "[backup] Done. Size: $SIZE"

# Keep only the 28 most recent backups (7 days × 4 per day)
KEEP=28
EXISTING=$(ls -1t "$BACKUP_DIR"/tch_*.sql.gz 2>/dev/null | wc -l)
if [ "$EXISTING" -gt "$KEEP" ]; then
  REMOVE=$(( EXISTING - KEEP ))
  ls -1t "$BACKUP_DIR"/tch_*.sql.gz | tail -"$REMOVE" | xargs rm -f
  echo "[backup] Pruned $REMOVE old snapshot(s). Keeping $KEEP most recent."
fi

echo "[backup] Backups in store: $(ls -1 "$BACKUP_DIR"/tch_*.sql.gz 2>/dev/null | wc -l)"
