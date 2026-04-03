# API Dockerfile & Docker Compose for Coolify Deployment

**Date:** 2026-04-02
**Status:** Draft

## Goal

Create a Dockerfile for the API app and a production docker-compose file to deploy on a Coolify server. No CI/CD integration — manual deploy for now. PostgreSQL and Redis run as separate services (not in this container).

## Decisions

- **Approach:** Multi-stage build with `pnpm deploy` for isolated production output
- **Node version:** 24-alpine (LTS)
- **Port:** Configurable via `API_PORT` environment variable (default 3001)
- **Migrations:** Run automatically on container startup via `drizzle-orm/migrator` (programmatic, no drizzle-kit in production)
- **Docker Compose:** Separate `docker-compose.prod.yml` — dev compose unchanged
- **Build workflow:** Local build for now, registry-based in the future

## Files to Create

### 1. `apps/api/Dockerfile`

Multi-stage build with 3 stages:

**Stage 1 — `deps`**
- Base: `node:24-alpine`
- Enable corepack, activate pnpm
- Copy dependency files only: root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and each workspace `package.json`
- Run `pnpm install --frozen-lockfile`

**Stage 2 — `build`**
- Copy all source code
- Run `pnpm turbo build` to compile everything in dependency order (types → config → validators → db → api)
- Run `pnpm deploy --filter=api --prod /app/deploy` to create isolated production bundle

**Stage 3 — `production`**
- Base: `node:24-alpine` (clean image)
- Create non-root user `appuser`
- Copy from build stage:
  - `/app/deploy` (contains `dist/`, `node_modules/` with production deps only)
  - Migration SQL files from `packages/db/drizzle/`
- Copy entrypoint script
- Set `NODE_ENV=production`
- Run as `appuser`
- Entrypoint: `docker-entrypoint.sh`

### 2. `apps/api/docker-entrypoint.sh`

```sh
#!/bin/sh
set -e
echo "Running database migrations..."
node dist/migrate.js
echo "Starting API server..."
exec node dist/server.js
```

Uses `exec` so the Node process receives signals (SIGTERM for graceful shutdown).

### 3. `apps/api/src/migrate.ts`

Programmatic migration script using `drizzle-orm/migrator`:

- Imports `drizzle` and `postgres` driver
- Reads `DATABASE_URL` from environment (with the same env-bootstrap as server.ts)
- Calls `migrate(db, { migrationsFolder: './drizzle' })` pointing to the SQL migration files
- Exits after completion (success or failure with non-zero exit code)
- Closes the database connection after migration completes

This avoids needing `drizzle-kit` as a production dependency. The compiled `dist/migrate.js` runs against the SQL files in the `drizzle/` folder.

**Important path detail:** In the production container, the working directory is `/app`. The migration SQL files are copied to `/app/drizzle/`. The migrate script references `./drizzle` relative to the working directory.

### 4. `docker-compose.prod.yml`

```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    env_file: .env
    ports:
      - "${API_PORT:-3001}:${API_PORT:-3001}"
    restart: unless-stopped
```

Kept separate from the dev `docker-compose.yml`. For local testing, run:
- `docker compose -f docker-compose.prod.yml build`
- `docker compose -f docker-compose.prod.yml up`

The `.env` file provides `DATABASE_URL`, `REDIS_URL`, `API_PORT`, and all other environment variables.

### 5. `.dockerignore`

Excludes from build context:
- `node_modules/` (all levels)
- `.env` (secrets)
- `.git/`
- `dist/` (rebuild inside container)
- `apps/mobile/` (not needed for API build)
- `*.md`, `.vscode/`, `.turbo/`

## Environment Variables

All env vars are injected at runtime (not baked into the image):

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `API_PORT` | No | Port to listen on (default: 3001) |
| `NODE_ENV` | No | Set to `production` in Dockerfile |
| `CLERK_SECRET_KEY` | Yes | Clerk authentication |
| `CLERK_PUBLISHABLE_KEY` | Yes | Clerk authentication |
| `STRIPE_SECRET_KEY` | Conditional | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | Conditional | Stripe webhooks |
| `R2_*` | Conditional | Cloudflare R2 storage |

## Coolify Deployment

In Coolify, configure:
1. Point to `apps/api/Dockerfile` (or use the built image)
2. Set all required environment variables in the Coolify dashboard
3. PostgreSQL and Redis are separate Coolify services/resources
4. The container handles migrations automatically on startup

## Not in Scope

- GitHub Actions / CI/CD pipeline (future)
- Container registry push (future)
- Health check endpoint (can be added later)
- Horizontal scaling / replicas
