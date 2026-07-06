# TCH Financials — Production Deployment (VPS)

How to run the app on a single Linux VPS (Ubuntu/Debian assumed). Two Node
processes behind nginx, with the database and auth hosted on Supabase:

```
Internet ──► nginx :443 (TLS)
              ├── /api/*    ──► NestJS backend   127.0.0.1:8000  (also /media/*)
              └── everything else ──► Next.js frontend 127.0.0.1:5050
                                          │
Supabase (managed) ◄──────────────────────┘
  ├── Postgres  (backend connects via the session pooler)
  └── Auth      (frontend logs in; backend verifies JWTs via JWKS)
```

- **Frontend**: Next.js 15 (`frontend/`), serves the UI on port 5050.
- **Backend**: NestJS + TypeORM (`backend/`), serves the REST API on port 8000
  under `/api/`, uploaded creator documents under `/media/`, and owns database
  migrations.
- **Database/Auth**: Supabase. Nothing DB-related runs on the VPS itself.

---

## 1. Prerequisites

```bash
# Node.js 22 LTS (anything >= 20 works)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git postgresql-client   # psql/pg_dump for backups

# app user + directories
sudo useradd --system --create-home --shell /usr/sbin/nologin tch
sudo mkdir -p /opt/tch /var/lib/tch/media /var/lib/tch/backups
sudo chown -R tch:tch /opt/tch /var/lib/tch
```

## 2. Get the code and configure the environment

```bash
sudo -u tch git clone <your-repo-url> /opt/tch/app
cd /opt/tch/app
```

Create `/opt/tch/app/.env` (the backend reads it via dotenv; Next.js reads the
`NEXT_PUBLIC_*` values **at build time**):

```ini
# --- Database (Supabase) -----------------------------------------------------
# Use the SESSION POOLER host (aws-1-<region>.pooler.supabase.com:5432).
# The direct db.<ref>.supabase.co host is IPv6-only and unreachable from most
# VPSes. TLS to the pooler is handled in code — no extra config needed.
DATABASE_URL=postgresql://postgres.<project-ref>:<db-password>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres

# --- Supabase Auth -----------------------------------------------------------
# Setting SUPABASE_URL turns API auth ON: every request must carry a valid
# Supabase JWT (verified against the project JWKS, audience "authenticated").
# Leave it unset ONLY for bare local development — never in production.
SUPABASE_URL=https://<project-ref>.supabase.co

# Frontend auth client (baked into the build)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key>

# --- Backend -----------------------------------------------------------------
PORT=8000
MEDIA_ROOT=/var/lib/tch/media
```

> **Rotate the committed credentials.** The repo's git history contains a
> real `.env` (DB password + anon key). Before going live: reset the database
> password and rotate the anon key in the Supabase dashboard, use the new
> values here, and make sure `.env` stays gitignored.

Notes:

- `NEXT_PUBLIC_*` values are compiled into the frontend bundle. If you change
  them, rebuild the frontend.
- `NEXT_PUBLIC_API_BASE` is **not** needed: the frontend calls same-origin
  `/api/`, which nginx routes to the backend below. (The Next dev-time proxy
  in `next.config.ts` honours `API_PROXY_TARGET`, default `http://localhost:8000`.)

## 3. Build

```bash
cd /opt/tch/app

# Backend
cd backend && npm ci && npm run build && cd ..

# Frontend (needs the NEXT_PUBLIC_* vars from ../.env at build time)
cd frontend && npm ci \
  && export $(grep -E '^NEXT_PUBLIC_' ../.env | xargs) \
  && npm run build && cd ..
```

## 4. Database migrations

Migrations are owned by TypeORM in `backend/src/migrations/` and are safe to
re-run (already-applied migrations are skipped):

```bash
cd /opt/tch/app/backend && npm run migration:run
```

Run this once at first deploy and again after any deploy that adds a migration.

## 5. Run as systemd services

`/etc/systemd/system/tch-backend.service`:

```ini
[Unit]
Description=TCH Financials API (NestJS)
After=network-online.target
Wants=network-online.target

[Service]
User=tch
WorkingDirectory=/opt/tch/app/backend
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=3
# .env is read from the repo root by the app itself; PORT/MEDIA_ROOT come from it.

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/tch-frontend.service`:

```ini
[Unit]
Description=TCH Financials UI (Next.js)
After=network-online.target tch-backend.service
Wants=network-online.target

[Service]
User=tch
WorkingDirectory=/opt/tch/app/frontend
ExecStart=/usr/bin/npx next start -p 5050 -H 127.0.0.1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tch-backend tch-frontend
sudo systemctl status tch-backend tch-frontend
```

> The frontend unit binds `127.0.0.1` explicitly (the package.json `start`
> script binds 0.0.0.0, which you don't want on a public VPS). The backend
> binds all interfaces — keep port 8000 closed in the firewall (step 7).

## 6. nginx reverse proxy + TLS

`/etc/nginx/sites-available/tch`:

```nginx
server {
    server_name financials.example.com;
    listen 80;

    client_max_body_size 25m;   # creator-document uploads

    # API and uploaded documents go straight to the backend.
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    location /media/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }

    # Everything else is the Next.js app.
    location / {
        proxy_pass http://127.0.0.1:5050;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/tch /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# TLS
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d financials.example.com
```

API paths end in a trailing slash (`/api/creators/`) — both nginx and the
backend handle that as-is; no rewrite rules needed.

## 7. Firewall

```bash
sudo apt-get install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable          # 5050/8000 stay unreachable from outside
```

## 8. Backups

Supabase keeps its own database backups, but the repo ships a `pg_dump` script
for an independent copy (`scripts/db_backup.sh` — dumps to `backups/`, keeps
the newest 28):

```bash
# as the tch user's crontab (sudo -u tch crontab -e) — every 6 hours
0 */6 * * * cd /opt/tch/app && BACKUP_DIR=/var/lib/tch/backups ./scripts/db_backup.sh >> /var/log/tch-backup.log 2>&1
```

Also back up `/var/lib/tch/media` (uploaded creator documents) — e.g. include
it in whatever file backup / snapshot the VPS provider offers. The database
only stores paths; the files themselves live on disk.

## 9. Deploying updates

```bash
cd /opt/tch/app
sudo -u tch git pull

cd backend  && sudo -u tch npm ci && sudo -u tch npm run build && sudo -u tch npm run migration:run && cd ..
cd frontend && sudo -u tch npm ci \
  && sudo -u tch bash -c 'export $(grep -E "^NEXT_PUBLIC_" ../.env | xargs) && npm run build' && cd ..

sudo systemctl restart tch-backend tch-frontend
```

(Migrations run before the backend restart; TypeORM skips ones already applied.)

## 10. Smoke test

```bash
# Backend up and auth enforced (expect 401 when SUPABASE_URL is set):
curl -i https://financials.example.com/api/creators/

# Frontend up:
curl -sI https://financials.example.com/ | head -1

# Full check: log in via the browser, add a creator (documents are required),
# add a deal with an E-Invoice No, and confirm the Overview chart fills in.
```

## Quick reference

| Thing | Where |
|---|---|
| Env file | `/opt/tch/app/.env` (repo root — read by backend at runtime, frontend at build) |
| Backend service | `systemctl {status,restart} tch-backend` · logs: `journalctl -u tch-backend -f` |
| Frontend service | `systemctl {status,restart} tch-frontend` · logs: `journalctl -u tch-frontend -f` |
| Run migrations | `cd /opt/tch/app/backend && npm run migration:run` |
| Uploaded documents | `/var/lib/tch/media` (`MEDIA_ROOT`) |
| DB backups | `/var/lib/tch/backups` via `scripts/db_backup.sh` cron |
| Ports | nginx 80/443 public · frontend 5050 and backend 8000 localhost-only |
