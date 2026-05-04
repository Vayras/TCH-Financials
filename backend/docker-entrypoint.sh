#!/usr/bin/env bash
set -e

echo "[entrypoint] Waiting for Postgres at ${PGHOST:-db}:${PGPORT:-5432}..."
until pg_isready -h "${PGHOST:-db}" -p "${PGPORT:-5432}" -U "${PGUSER:-tch}" >/dev/null 2>&1; do
  sleep 1
done
echo "[entrypoint] Postgres is ready."

echo "[entrypoint] Running migrations..."
python manage.py migrate --noinput

SEED_MARKER="/app/.seeded"
SEED_FILE="${SEED_FILE:-/data/source.xlsx}"
if [ ! -f "$SEED_MARKER" ] && [ -f "$SEED_FILE" ]; then
  echo "[entrypoint] First boot detected — seeding from $SEED_FILE..."
  python manage.py import_excel "$SEED_FILE" --wipe
  touch "$SEED_MARKER"
  echo "[entrypoint] Seed complete."
else
  echo "[entrypoint] Skipping seed (marker present or seed file missing)."
fi

exec "$@"
