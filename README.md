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
| DB       | PostgreSQL 17 — Supabase                                    |
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind v4 (:5050)    |

## Layout

```
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

The frontend reads its Supabase credentials from `frontend/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

## Production

Build and serve with npm (Node ≥ 22.12):

```bash
npm run build               # installs frontend deps + next build
npm run start               # http://localhost:5050
```

> Port 5050 (not 5000) because macOS AirPlay Receiver squats on :5000.

`NEXT_PUBLIC_*` values are inlined into the client bundle at build time, so
rebuild after changing `frontend/.env.local`.

### Backups

Supabase Pro has daily automatic backups. On the free tier, snapshot manually:

```bash
export DATABASE_URL=postgresql://...   # same pooler URI
./scripts/db_backup.sh                 # → backups/tch_<timestamp>.sql.gz (keeps last 28)
```

## Local development

Node ≥ 22.12. From the repo root:

```bash
npm run install:frontend
npm run dev                       # http://localhost:5050
```

(or run the same scripts from inside `frontend/`). `npm run typecheck` runs
`tsc --noEmit`, `npm run lint` runs `next lint`.

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
