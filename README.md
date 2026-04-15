# TCH Financials

Svelte + Django rebuild of the TCH MIS FY 26-27 workbook.

## What's automated

**Commercial Tracking is the single source of truth.** Add a deal and
every derived view recomputes on the next GET:

- **Current Overview** — Total Billing by bucket (Current Exclusives / Dropping /
  Friends / Non-TCH) × month / quarter, plus EMW Billing, EMW %, Profits, Profit Ratio.
- **Exclusives (Quarterly)** — per-exclusive creator deal counts / invoiced amounts
  / creator fees / top brands, grouped by FY quarter.

Agency Fee (INR) and Creator Fee auto-derive from Total Fee × % on save.

## Stack

| Layer    | Tech                                             |
|----------|--------------------------------------------------|
| DB       | PostgreSQL 17 (local, DB `tch_financials`)       |
| Backend  | Django 6 + Django REST Framework + CORS          |
| Frontend | SvelteKit (Svelte 5) + TypeScript + Tailwind v4  |
| UI kit   | `bits-ui` primitives, B&W theme only — no emoji  |

## Layout

```
backend/          Django project (config/) + app (tch/)
  tch/models.py           Creator, ContractingCompliance, CommercialDeal, EmployeeWeeklyReport
  tch/aggregation.py      Derives Current Overview + Quarterly Exclusives
  tch/views.py            DRF viewsets + overview endpoints
  tch/management/commands/import_excel.py   One-shot xlsx → DB loader
frontend/         SvelteKit app
  src/lib/api.ts              Typed API client
  src/lib/components/ui/*     B&W primitives (Button, Input, Select, Dialog, …)
  src/routes/+page.svelte     Current Overview (auto-derived)
  src/routes/commercial/      Commercial Tracking table + Add/Edit dialog
  src/routes/creators/        Creator Pipeline
  src/routes/contracting/     Contracting & Compliance
  src/routes/exclusives/      Quarterly derived view
  src/routes/employees/       Employee-Talent weekly reports
data/
  source.xlsx     Original workbook used for seeding
```

## Setup (once)

Postgres needs to be running locally, and a DB named `tch_financials`
needs to exist (owned by your login user). If you used the bundled
Homebrew Postgres:

```bash
brew services start postgresql@17
createdb tch_financials   # one-time
```

## Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py import_excel ../data/source.xlsx --wipe   # seed from xlsx
python manage.py createsuperuser                           # optional, for /admin
python manage.py runserver 127.0.0.1:8000
```

API surface:

- `GET /api/overview/?fy=2026`
- `GET /api/exclusives/quarterly/?fy=2026`
- CRUD: `/api/creators/`, `/api/contracting/`, `/api/deals/`, `/api/employee-reports/`

## Frontend

Requires Node ≥ 22.12 (use `nvm use 22`).

```bash
cd frontend
npm install          # already done
npm run dev          # http://localhost:5173
```

Set `VITE_API_BASE` in a `.env.local` if the backend is not on 127.0.0.1:8000.

## Re-importing

`import_excel --wipe` truncates the derived-source tables before re-seeding, so
it is safe to re-run. Without `--wipe` it `update_or_create`s creators and
appends deals.
