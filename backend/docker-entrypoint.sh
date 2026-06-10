#!/usr/bin/env bash
set -e

echo "[entrypoint] Waiting for the database..."
until python - <<'PY' >/dev/null 2>&1
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.db import connection
connection.ensure_connection()
PY
do
  sleep 1
done
echo "[entrypoint] Database is ready."

echo "[entrypoint] Running migrations..."
python manage.py migrate --noinput

# Seed ONLY when the database holds no business data. The seed decision is
# made against the database itself — never a marker file. (A marker in the
# container filesystem is lost on every rebuild, which used to re-trigger a
# destructive `import_excel --wipe` and erase all data entered via the UI.)
SEED_FILE="${SEED_FILE:-/data/source.xlsx}"
HAS_DATA=$(python - <<'PY'
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from tch.models import CommercialDeal, Creator
print(1 if (CommercialDeal.objects.exists() or Creator.objects.exists()) else 0)
PY
)
if [ "$HAS_DATA" = "0" ] && [ -f "$SEED_FILE" ]; then
  echo "[entrypoint] Empty database detected — seeding from $SEED_FILE..."
  python manage.py import_excel "$SEED_FILE"
  echo "[entrypoint] Seed complete."
else
  echo "[entrypoint] Skipping seed (database already has data, or seed file missing)."
fi

exec "$@"
