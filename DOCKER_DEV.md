# TCH Financials — isolated Docker development setup

This stack is intentionally separate from production. It uses a local Docker
PostgreSQL database, local Docker media storage, mock local authentication, and
hard-coded development-only credentials.

## Safety boundary

- The Compose file does not read the repository `.env` file.
- `DATABASE_URL` is fixed to the Docker service `db` and database
  `tch_financials_dev`.
- The migration container refuses to run unless both `APP_ENV=development` and
  the exact expected local database URL are present.
- Supabase and Resend credentials are explicitly blank inside the containers.
- TypeORM `synchronize` remains disabled. The normal migration chain creates
  the local schema.
- Production data is not copied into this setup.

Do not add production credentials to `docker-compose.dev.yml`.

## Requirements

- Docker Desktop or Docker Engine with Compose
- Ports 5050, 8000 and 5433 available on localhost

The local database is published on `127.0.0.1:5433`, not the usual host port
5432, to reduce collisions with an existing PostgreSQL installation.

## Start

From the repository root:

```bash
npm run docker:dev
```

The first start builds the images, creates an empty local database, runs every
TypeORM migration, and starts:

- Frontend: http://localhost:5050
- Backend: http://localhost:8000/api
- PostgreSQL: localhost:5433

Supabase auth is deliberately disabled locally. The existing backend and
frontend development behavior supplies development-only identities, so no real
login credentials are required. Use the **Development account** selector in the
bottom-right corner of the browser to switch between:

- Dev Admin (`admin.dev@tch.local`)
- Dev Accounts (`accounts.dev@tch.local`)
- Dev Creator (`creator.dev@tch.local`)

The selector and its request header are active only when Supabase is
unconfigured and the backend is explicitly running with `APP_ENV=development`.
The backend refuses the header in production. The Docker migration step seeds
these local identities idempotently after migrations, including after a dev
environment reset.

## Run in the background

```bash
docker compose -f docker-compose.dev.yml up --build -d
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs -f
```

## Stop without deleting local data

```bash
npm run docker:dev:down
```

The PostgreSQL and media named volumes remain available for the next start.

## Reset only the Docker development environment

```bash
npm run docker:dev:reset
```

This deletes the named volumes belonging to the `tch-financials-dev` Compose
project, including only its local Docker database and local uploaded files. It
does not connect to or alter production. Docker will create a fresh empty dev
database on the next start.

## Useful checks

```bash
# Service state
docker compose -f docker-compose.dev.yml ps

# Backend API
curl http://localhost:8000/api/overview

# Frontend
curl -I http://localhost:5050

# Migration status
docker compose -f docker-compose.dev.yml run --rm migrate npm run migration:show

# Local database shell
docker compose -f docker-compose.dev.yml exec db \
  psql -U tch_dev -d tch_financials_dev
```

## Bringing production-shaped data into development later

Do not point this application at production. First create and verify a
production backup, then restore a sanitized copy into a separate staging
environment. Real creator documents and personally identifiable information
should not be copied into ordinary development containers.
