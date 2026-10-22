# TCH Financials — repeatable startup guide

Use **Option A** for the existing Node.js setup and configured database. Use
**Option B** for an isolated Docker database. Choose one option per session:
these setups use the same frontend and backend ports.

## Option A: existing Node.js setup

### One-time setup (or after dependencies change)

Open Terminal and run:

```bash
cd /Users/kapildadhich/Documents/GitHub/TCH-Financials
nvm use 22
node --version
npm run install:backend
npm run install:frontend
```

Use Node 22.12 or newer. If `nvm use 22` says the version is missing, run
`nvm install 22`, then `nvm use 22`. If `nvm` is unavailable, use your installed
Node.js version after checking that it meets the requirement.

The existing environment files must be configured:

- Backend: `DATABASE_URL` in the root `.env` or `backend/.env`, plus the
  Supabase authentication settings when using real accounts.
- Frontend: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
  `frontend/.env.local` when using real accounts. Next.js also loads
  `frontend/.env.development.local` in development; values there take precedence
  over `.env.local`.

Keep your existing credentials. Do not overwrite configured environment files
with `.env.example`. The host setup connects to the database in your environment
files, so application edits affect that database.

### Every time you start

**1. Start the backend in Terminal tab 1:**

```bash
cd /Users/kapildadhich/Documents/GitHub/TCH-Financials
nvm use 22
npm run dev:backend
```

Leave this tab running. Wait for NestJS to report that the application started.
The API normally runs at <http://localhost:8000/api>.

**2. Open a second Terminal tab and start the frontend:**

```bash
cd /Users/kapildadhich/Documents/GitHub/TCH-Financials
nvm use 22
npm run dev:frontend
```

Leave this tab running. Wait for Next.js to show `Ready`.

**3. Open the app:**

<http://localhost:5050>

If the login page appears, use your existing Supabase account email and password.
There is no universal default password. Keep both Terminal tabs open while
working; code changes are reloaded automatically.

### Every time you stop

Press **Ctrl + C in each Terminal tab**, once for the frontend and once for the
backend. Separate tabs make it clear which server you are stopping.

The root `npm run dev` shortcut starts both servers, but it uses a shell
background process for the backend. This guide uses separate tabs so you can
stop each server explicitly.

## Option B: isolated Docker development

This option uses its own local PostgreSQL database and uploaded-file storage.
It starts with an empty database rather than your existing Supabase records.

### Every time you start

1. Open Docker Desktop and wait until its engine is running.
2. Open Terminal and run:

```bash
cd /Users/kapildadhich/Documents/GitHub/TCH-Financials
npm run docker:dev
```

The first run takes longer while images build. The stack runs database migrations
and seeds development accounts automatically. Wait for the frontend to be ready,
then open <http://localhost:5050>.

Use the **Development account** selector in the bottom-right corner to choose
Dev Admin, Dev Accounts, or Dev Creator. No real Supabase login is required.

### Every time you stop

Press **Ctrl + C** in the running terminal, then run:

```bash
npm run docker:dev:down
```

Your local database and uploaded files remain available for the next start.
`npm run docker:dev:reset` deletes the Docker development data; it is not a
normal stop or startup step.

More Docker details: [DOCKER_DEV.md](DOCKER_DEV.md).

## If something does not start

| Symptom | What to do |
|---|---|
| Missing dependencies or command not found inside the app | Run the two install commands under Option A. For Docker, inspect the build logs. |
| `EADDRINUSE` / port already in use | Stop the previous Node servers or Docker stack before restarting. |
| App opens but data fails to load | Check the backend terminal for errors and confirm the backend is running. |
| Backend reports a database connection error | Check the configured database URL and database availability; Docker users should check Docker Desktop and service logs. |
| Docker cannot connect to its daemon | Start Docker Desktop and wait for the engine. |
| Login fails | Use the correct existing Supabase credentials for Option A, or the development selector for Option B. |

Check which processes are listening:

```bash
lsof -nP -iTCP:5050 -sTCP:LISTEN
lsof -nP -iTCP:8000 -sTCP:LISTEN
```

Prefer Ctrl + C in the original terminal. If a leftover process belongs to this
project, stop that specific process with `kill <PID>` using its actual process
ID. Do not stop unrelated processes.

For Docker status and logs:

```bash
docker compose -f docker-compose.dev.yml ps
npm run docker:dev:logs
```

Press Ctrl + C to exit the log viewer.

## Occasional database updates

Migrations are not an everyday host startup step. When a project update adds
migrations, confirm which database your environment targets, then run from the
project root:

```bash
npm run migrate
```

Docker development applies migrations automatically during startup.
