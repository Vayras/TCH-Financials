# TCH Financials

A web-based Management Information System (MIS) for TCH FY 26-27. Built with SvelteKit on the frontend and Django REST Framework on the backend.

## Architecture

- **Frontend**: SvelteKit (Svelte 5 + TypeScript + Tailwind CSS v4), runs on port 5000
- **Backend**: Django 6 + Django REST Framework, runs on port 8000
- **Database**: Replit's built-in PostgreSQL (env vars: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)

## Project Structure

```
backend/          Django project
  config/         Settings, URLs, WSGI
  tch/            Core app: models, views, serializers, aggregation
  manage.py
  requirements.txt

frontend/         SvelteKit app
  src/
    lib/          API client (api.ts), shared UI components
    routes/       Page routes: overview, commercial, creators, contracting, exclusives, employees
  vite.config.ts  Port 5000, host 0.0.0.0, allowedHosts: true
  package.json

data/
  source.xlsx     Excel seed file for initial data import
```

## Workflows

- **Start application** — `cd frontend && npm run dev` (port 5000, webview)
- **Backend API** — `cd backend && python manage.py runserver localhost:8000` (port 8000, console)

## Key Commands

```bash
# Run migrations
cd backend && python manage.py migrate

# Seed database from Excel
cd backend && python manage.py import_excel ../data/source.xlsx --wipe

# Install frontend deps
cd frontend && npm install
```

## API Endpoints

- `GET /api/overview/?fy=2026` — Current overview with billing by bucket
- `GET /api/exclusives/quarterly/?fy=2026` — Quarterly exclusive creator report
- CRUD: `/api/creators/`, `/api/contracting/`, `/api/deals/`, `/api/employee-reports/`

## Environment Variables

All set via Replit secrets:
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — PostgreSQL connection
- `DATABASE_URL` — Full connection string

## Configuration Notes

- Django `ALLOWED_HOSTS = ['*']` and `CORS_ALLOW_ALL_ORIGINS = True` for Replit proxy compatibility
- Vite `server.host = '0.0.0.0'`, `server.allowedHosts = true` for Replit iframe preview
- Frontend API base: `VITE_API_BASE` env var (defaults to `http://127.0.0.1:8000/api`)
