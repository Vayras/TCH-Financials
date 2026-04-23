#!/usr/bin/env bash
# TCH Financials — Production startup
# Starts Django (gunicorn, port 8000) then SvelteKit Node (port 5000).
set -e

echo "[start] Launching Django API on :8000…"
cd backend
gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 2 \
  --timeout 60 \
  --access-logfile - \
  --error-logfile - &
DJANGO_PID=$!
cd ..

echo "[start] Django PID: $DJANGO_PID"
echo "[start] Launching SvelteKit on :5000…"

export HOST=0.0.0.0
export PORT=5000
exec node frontend/build/index.js
