# TCH Financials

Financial operations, campaign tracking, and creator portal for The Creative Hook (TCH). Built with **Next.js 15 (App Router)**, **NestJS v11**, and **PostgreSQL 17 (Supabase)**.

---

## Overview & Core Capabilities

TCH Financials is designed around a **campaign-first architecture**: campaigns are the central operating unit, deals link to campaigns, and creators operate across campaigns, media kits, and financial workflows.

### 1. Operations & Financial Management
- **Campaign Tracking (`/commercial`)**: Single source of truth for all brand deals, agency fees, creator payouts, and campaign statuses (`Active` / `Over`).
- **Overview Matrix (`/`)**: Real-time aggregation of billing per campaign across months and fiscal quarters, highlighting EMW Billing, EMW %, Gross Profits, and Profit Ratios.
- **Billing Entity Summary (`/entity-summary`)**: Financial drill-down across legal billing entities, associated brands, and billed talent.
- **Invoicing & Payments (`/payments`)**: Invoice generation, TDS calculation, UTR payment tracking, and status reconciliation.
- **Health Signals & Alerts (`/alerts`)**: Automated detection of overdue invoices, overdue creator payments, dormant brands, hot brands (high deal velocity), and creator contract renewals.
- **Team Weekly Reporting (`/employees`)**: Weekly Thursday reporting and notes for team operational visibility.

### 2. Creator Portal (`/creator-portal`)
- **Creator Workspace**: Role-scoped dashboard for creators to track earnings, active campaigns, deliverables, and payment histories.
- **Brand & Media Kit (`/creator-portal/media-kit`)**: Media kit builder allowing creators to showcase verified metrics, curated content, and published kits with public vanity URLs (`/k/:slug`).
- **Creator Invoices & Deals (`/creator-portal/invoices`, `/creator-portal/deals`)**: Self-serve invoice submission and tracking.
- **Instagram Insights Integration**: Connect Instagram handles and import verified audience insights and recent posts via the background worker.

### 3. Campaign Content & AI Ideation (`/campaigns/:id/brief`)
- **Structured Campaign Briefs**: Collaborative briefing covering objectives, requirements, and creator allocations.
- **AI Concept Ideation**: Generate and iterate on creative concepts powered by OpenAI with prompt contextualization from brand parameters and audience profiles.
- **Concept Workspace**: Version-controlled pitch drafts, creator feedback loops, and submission workflows.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, TanStack Query v5, Lucide Icons, Sonner (:5050) |
| **Backend** | NestJS v11, TypeORM, TypeScript, Swagger / OpenAPI docs (:8000) |
| **Database** | PostgreSQL 17 (Supabase session pooler) with row-level safety and advisory admission locks |
| **Worker** | Node.js TypeScript background worker (`src/social-worker.ts`) for asynchronous social imports |
| **External APIs** | TrioSphere (Instagram profile/media lookups), OpenAI (Campaign brief concept ideation), Resend (Transactional emails) |
| **Formatting** | Prettier + EditorConfig |

---

## Repository Layout

```
.
├── backend/                  # NestJS API backend
│   ├── src/
│   │   ├── auth/             # Supabase JWT & role-based access control (RBAC)
│   │   ├── campaign-content/ # Campaign briefs, concepts, and AI ideation
│   │   ├── creator-social/   # TrioSphere client, normalizers, and brand-kit services
│   │   ├── migrations/       # TypeORM database migrations
│   │   ├── resources/        # Deals, campaigns, payments, TDS, and reporting controllers
│   │   ├── social-worker.ts  # Background worker for queued social imports
│   │   └── data-source.ts    # TypeORM DataSource configuration
│   └── test/                 # Test suites (unit and integration)
├── frontend/                 # Next.js frontend application
│   ├── app/                  # Next.js App Router pages and layouts
│   │   ├── commercial/       # Deal & campaign tracking
│   │   ├── creator-portal/   # Creator portal and self-service kit
│   │   ├── payments/         # Invoice, TDS, and UTR workflows
│   │   └── k/[slug]/         # Public published creator media kits
│   ├── components/           # Shared UI components and layout wrappers
│   ├── features/             # Feature-specific modules (e.g. campaign-content)
│   └── lib/                  # Typed API clients, Supabase browser client, helpers
├── docker/                   # Docker environment configurations
├── docker-compose.dev.yml    # Local development stack (Postgres + Backend + Frontend + Worker)
└── scripts/                  # Database backup and verification utilities
```

---

## Getting Started

### Prerequisites
- Node.js ≥ 22.12
- Docker & Docker Compose (for local containerized development)
- PostgreSQL 17 (if running outside Docker)

### 1. Local Development with Docker (Recommended)

The easiest way to run the entire stack (PostgreSQL, NestJS API, Next.js frontend, and the social worker) is via Docker Compose:

```bash
# Start all services with hot reload
npm run docker:dev

# View container logs
npm run docker:dev:logs

# Stop all services
npm run docker:dev:down

# Reset local dev database and volumes
npm run docker:dev:reset
```

- **Frontend**: http://localhost:5050
- **Backend API**: http://localhost:8000/api
- **Swagger Documentation**: http://localhost:8000/docs
- **Local Dev Database**: `localhost:5433` (database: `tch_financials_dev`, user: `tch_dev`)

### 2. Host Development (Manual)

If running without Docker:

```bash
# 1. Install dependencies
npm run install:backend
npm run install:frontend

# 2. Configure environment
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local   # or configure Supabase keys

# 3. Run database migrations
npm run migrate

# 4. Start backend and frontend
npm run dev
# Or run individually:
# npm run dev:backend   # NestJS on :8000
# npm run dev:frontend  # Next.js on :5050
```

---

## Configuration & Environment Variables

Copy `.env.example` to `.env` at the repository root:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase session pooler port 5432 with `sslmode=require`) |
| `APP_ENV` | Application environment (`development`, `staging`, `production`) |
| `TRIOSPHERE_API_TOKEN` | Bearer token for TrioSphere profile/media lookups |
| `SOCIAL_GLOBAL_HOURLY_LIMIT` | Global rate limit cap per hour (default: `20`, provider cap: `30`) |
| `SOCIAL_GLOBAL_DAILY_LIMIT` | Global rate limit cap per day (default: `100`) |
| `OPENAI_API_KEY` | OpenAI API key for brief concept ideation |
| `OPENAI_SEARCH_MODEL` | OpenAI model identifier (default: `gpt-4o-mini`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_JWT_SECRET` | Secret key used to verify Supabase Auth tokens |

---

## Testing & Code Quality

### Code Formatting
Prettier and EditorConfig enforce a consistent 2-space indentation style across the repository:

```bash
# Check code formatting
npm run format:check

# Auto-format all frontend and backend files
npm run format
```

### Type Checking & Linting
```bash
# Frontend
npm run typecheck       # tsc --noEmit in frontend
npm run lint            # eslint in frontend

# Backend
cd backend && npm run typecheck
```

### Running Tests
```bash
# Run backend test suite
npm run test:backend
```

---

## Database Backups & Maintenance

Automated daily backups are configured on Supabase. Manual snapshot backups can be created via:

```bash
./scripts/db_backup.sh        # Generates compressed SQL backup in backups/
npm run backup:verify         # Verifies backup integrity against test container
```
