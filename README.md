# TCH Financials

Next.js + Django rebuild of the TCH MIS workbook. **Campaign-based**: campaigns
are first-class records; deals belong to a campaign, and creators appear as a
supporting dimension on each campaign.

## What's automated

**Campaign Tracking (`/commercial`) is the single source of truth.** Add a deal
and every derived view recomputes on the next GET:

- **Current Overview (`/`)** — billing per campaign × month / quarter, campaign
  status counts (Active / Over), plus EMW Billing, EMW %, Profits, Profit Ratio.
- **Entity Summary** — billing / profit per billing entity, with the campaigns
  and creators billed under each.
- **Alerts** — overdue invoices / payments (campaign-first), inactive creators,
  dormant / hot brands, renewals, seasonal moments.

A deal's fiscal year and month come from its **E-Invoice No**
(`TCH/2526/Dec01` → Dec, FY 25-26). Agency Fee (INR) and Creator Fee
auto-derive from Total Fee × % on save. A campaign's status flips to **Over**
automatically once every deal on it is marked `campaign_over = Y`.

## Stack

| Layer    | Tech                                                        |
|----------|-------------------------------------------------------------|
| DB       | PostgreSQL 17 — Supabase in production, docker locally      |
| Backend  | Django 6 + Django REST Framework (gunicorn on :8000)        |
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind v4 + MUI (:5000) |

## Layout

```
backend/              Django project (config/) + app (tch/)
  tch/models.py             Campaign, Creator, CommercialDeal, DealCreatorShare, …
  tch/aggregation.py        Derives Overview / Entity Summary / Alerts (campaign-centric)
  tch/serializers.py        Deal API accepts campaign by name; resolves/creates the FK
  tch/views.py              DRF viewsets + aggregation endpoints
  tch/management/commands/import_excel.py   One-shot xlsx → DB loader
  docker-entrypoint.sh      migrate + seed-only-if-DB-empty (never wipes)
frontend/             Next.js app
  lib/api.ts                Typed API client + types
  app/page.tsx              Current Overview (per-campaign billing)
  app/commercial/           Campaign Tracking — deal CRUD, campaign picker
  app/creators/             Creator Pipeline
  app/entity-summary/       Billing Entity Summary
  app/alerts/               Alerts & health signals
  app/employees/            Employee weekly reports
data/source.xlsx      Workbook used for first-boot seeding
scripts/db_backup.sh  pg_dump snapshot of $DATABASE_URL → backups/
```

## Configuration

Copy `.env.example` to `.env` at the repo root. The one variable that matters:

```bash
# Hosted Postgres (production). When set, it overrides the local PG* vars.
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Supabase notes:

- Use the **session pooler** URI (port 5432) from *Project Settings → Database*,
  username `postgres.<project-ref>`, and keep `sslmode=require`.
- Do **not** use the direct host `db.<project-ref>.supabase.co` — it is
  IPv6-only and unreachable from most networks.
- Do **not** use the transaction pooler (port 6543) with Django.

When `DATABASE_URL` is unset, the backend falls back to the local docker
Postgres (`POSTGRES_*` vars in `.env`, host port 5434).

## Production

Production runs the docker stack against Supabase:

```bash
cp .env.example .env        # set DATABASE_URL to the Supabase pooler URI
docker compose up -d --build
```

- Frontend: http://localhost:5050 · Backend API: http://localhost:8000/api/
- On boot the backend runs migrations, then seeds from `data/source.xlsx`
  **only if the database is completely empty**. A database with data is never
  touched — there is no automatic wipe path.
- The bundled `db` service is ignored while `DATABASE_URL` is set; you can
  remove it from `docker-compose.yml` if you are fully on Supabase.

### Backups

Supabase Pro has daily automatic backups. On the free tier, snapshot manually:

```bash
export DATABASE_URL=postgresql://...   # same pooler URI
./scripts/db_backup.sh                 # → backups/tch_<timestamp>.sql.gz (keeps last 28)
```

## Local development

### Option A — docker (mirrors production)

Leave `DATABASE_URL` unset (or empty) in `.env` and run:

```bash
docker compose up -d --build
```

This uses the bundled Postgres 17 container with a persistent `pgdata` volume
and seeds from `data/source.xlsx` on the first (empty-DB) boot.

### Option B — bare metal (fast iteration)

Backend (Python 3.12+):

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate          # targets DATABASE_URL from ../.env if set,
                                  # else PG*/DB_* vars (local Postgres)
python manage.py runserver 127.0.0.1:8000
```

Frontend (Node ≥ 22.12):

```bash
cd frontend
npm install
npm run dev                       # http://localhost:5000
```

The dev server proxies `/api/*` to the backend (`API_PROXY_TARGET`, default
`http://localhost:8000`), so no frontend env vars are needed when Django runs
on :8000. `npm run typecheck` runs `tsc --noEmit`.

> Heads-up: `python-decouple` reads `.env` from the repo root — if it contains
> the Supabase `DATABASE_URL`, bare-metal manage.py commands hit **Supabase**.
> To target a local DB instead, prefix commands with `DATABASE_URL=''` and the
> `PGHOST/PGPORT/...` vars you want.

## API surface

- `GET /api/overview/?fy=2025` — per-campaign billing matrix + totals
- `GET /api/entity-summary/?fy=2025&entity=&quarter=&month=`
- `GET /api/alerts/`
- CRUD: `/api/campaigns/`, `/api/deals/` (`?campaign=<id>` filter),
  `/api/creators/`, `/api/contracting/`, `/api/employee-reports/`,
  `/api/creator-documents/`, `/api/social-snapshots/`, `/api/event-invites/`

Deals are written with `campaign` as a **name string** — the backend matches it
to an existing campaign (case-insensitively) or creates one on first use, and
reads back `campaign`, `campaign_id`, and `campaign_status`.

## Importing / re-importing

```bash
python manage.py import_excel data/source.xlsx          # upsert creators, append deals
python manage.py import_excel data/source.xlsx --wipe   # DESTRUCTIVE: truncate, then re-seed
```

`--wipe` deletes all campaigns, deals, creators, contracting rows, employee
reports and drop-offs first. It is never run automatically — only pass it when
you intentionally want a from-scratch re-seed.
