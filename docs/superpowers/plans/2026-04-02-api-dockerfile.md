# API Dockerfile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a multi-stage Dockerfile and supporting files to deploy the API on Coolify.

**Architecture:** Multi-stage Docker build using `pnpm deploy` to produce an isolated production bundle. A shell entrypoint runs Drizzle migrations programmatically before starting the Express server. A separate `docker-compose.prod.yml` enables local build/test without touching the dev compose.

**Tech Stack:** Docker, Node 24 Alpine, pnpm 9.15, Drizzle ORM migrator, Express

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/migrate.ts` | Create | Programmatic migration script using drizzle-orm migrator |
| `apps/api/docker-entrypoint.sh` | Create | Shell script: run migrations then start server |
| `apps/api/Dockerfile` | Create | Multi-stage build (deps → build → production) |
| `.dockerignore` | Create | Exclude unnecessary files from build context |
| `docker-compose.prod.yml` | Create | Production compose with API service only |

---

### Task 1: Create the migration script

**Files:**
- Create: `apps/api/src/migrate.ts`

The migration script uses `drizzle-orm/postgres-js/migrator` to run SQL migrations programmatically. This avoids needing `drizzle-kit` in production. It imports `postgres` directly (available as a transitive dependency via `@tatame/db`).

- [ ] **Step 1: Create `apps/api/src/migrate.ts`**

```ts
import "./env-bootstrap.js";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations completed successfully");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
} finally {
  await sql.end();
}
```

Key details:
- Imports `env-bootstrap.js` to load `.env` in development (in production, env vars come from the container)
- Uses `max: 1` connection since migrations should run serially
- Closes connection with `sql.end()` before the process exits
- Migration folder `./drizzle` is relative to working directory (`/app` in container)

- [ ] **Step 2: Verify it compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm turbo build --filter=api`

Expected: Build succeeds, `apps/api/dist/migrate.js` exists.

- [ ] **Step 3: Test the migration script locally**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/api && node dist/migrate.js`

Expected: "Migrations completed successfully" (migrations already applied, so it's a no-op).

Note: This requires the local PostgreSQL to be running and `DATABASE_URL` set in `.env`. The migrate script loads env-bootstrap which reads `../../.env`.

However, the migration folder path `./drizzle` won't resolve correctly when running from `apps/api/` locally — it would need `../../packages/db/drizzle`. This is fine because the script is designed for the Docker container where migrations are copied to `/app/drizzle/`. For local use, `pnpm db:migrate` (drizzle-kit) remains the workflow.

To verify it compiles correctly, just check the file exists:

Run: `ls apps/api/dist/migrate.js`

Expected: File exists.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/migrate.ts
git commit -m "feat(api): add programmatic migration script for Docker"
```

---

### Task 2: Create the Docker entrypoint script

**Files:**
- Create: `apps/api/docker-entrypoint.sh`

- [ ] **Step 1: Create `apps/api/docker-entrypoint.sh`**

```sh
#!/bin/sh
set -e

echo "Running database migrations..."
node dist/migrate.js

echo "Starting API server..."
exec node dist/server.js
```

Key details:
- `set -e` — exit immediately if migration fails
- `exec` replaces the shell process with Node, so the container receives signals (SIGTERM) correctly for graceful shutdown
- No `env-bootstrap` needed — Docker injects env vars directly

- [ ] **Step 2: Make it executable**

Run: `chmod +x apps/api/docker-entrypoint.sh`

- [ ] **Step 3: Commit**

```bash
git add apps/api/docker-entrypoint.sh
git commit -m "feat(api): add Docker entrypoint script"
```

---

### Task 3: Create the Dockerfile

**Files:**
- Create: `apps/api/Dockerfile`

- [ ] **Step 1: Create `apps/api/Dockerfile`**

```dockerfile
# ── Stage 1: Install dependencies ──
FROM node:24-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy dependency manifests only (for layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
COPY packages/validators/package.json packages/validators/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ──
FROM deps AS build

# Copy all source code
COPY apps/api/ apps/api/
COPY packages/ packages/
COPY turbo.json tsconfig.base.json ./

# Build all packages in dependency order, then the API
RUN pnpm turbo build --filter=api

# Create isolated production bundle
RUN pnpm deploy --filter=api --prod /app/deploy

# ── Stage 3: Production ──
FROM node:24-alpine AS production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy production bundle (dist + prod node_modules)
COPY --from=build /app/deploy/dist ./dist
COPY --from=build /app/deploy/node_modules ./node_modules

# Copy migration SQL files and meta
COPY --from=build /app/packages/db/drizzle ./drizzle

# Copy entrypoint
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

ENV NODE_ENV=production

USER appuser

ENTRYPOINT ["./docker-entrypoint.sh"]
```

Key details:
- Stage 1 copies only `package.json` files for optimal layer caching — source changes don't invalidate the dependency layer
- Stage 2 uses `turbo build --filter=api` which builds all dependencies in order (types → config → validators → db → api)
- `pnpm deploy --filter=api --prod` creates a standalone copy with only production dependencies
- Stage 3 starts from a clean Alpine image — no pnpm, no turbo, no source code
- Migration SQL files (`packages/db/drizzle/`) are copied to `/app/drizzle/` matching the path in `migrate.ts`
- No `EXPOSE` directive — port is fully dynamic via `API_PORT` env var
- Runs as non-root `appuser`

- [ ] **Step 2: Commit**

```bash
git add apps/api/Dockerfile
git commit -m "feat(api): add multi-stage Dockerfile for production"
```

---

### Task 4: Create `.dockerignore`

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
.git
.gitignore
.env
.env.*
!.env.example
dist
.turbo
.vscode
.idea
*.md
apps/mobile
docs
```

Key details:
- Excludes `node_modules` at all levels (Docker rebuilds from lockfile)
- Excludes `.env` files (secrets must not be in the image)
- Keeps `.env.example` excluded too (not needed for build)
- Excludes `apps/mobile` (not needed, saves significant context size)
- Excludes `dist` (rebuilt inside container)
- Excludes `docs`, markdown files, editor configs

- [ ] **Step 2: Commit**

```bash
git add .dockerignore
git commit -m "chore: add .dockerignore for API builds"
```

---

### Task 5: Create `docker-compose.prod.yml`

**Files:**
- Create: `docker-compose.prod.yml`

- [ ] **Step 1: Create `docker-compose.prod.yml`**

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

Key details:
- Build context is the repo root (monorepo needs access to all packages)
- `env_file: .env` injects all environment variables at runtime
- Port mapping uses `API_PORT` from env with fallback to 3001
- `restart: unless-stopped` keeps the container running through crashes

- [ ] **Step 2: Commit**

```bash
git add docker-compose.prod.yml
git commit -m "feat: add production docker-compose for API"
```

---

### Task 6: Build and test the Docker image

This task verifies the entire setup works end-to-end.

- [ ] **Step 1: Build the image**

Run: `docker compose -f docker-compose.prod.yml build`

Expected: Multi-stage build completes successfully. Watch for:
- pnpm install succeeds with frozen lockfile
- turbo build compiles all packages
- pnpm deploy creates the production bundle

- [ ] **Step 2: Verify image size**

Run: `docker images | grep tatame`

Expected: Image should be under ~300MB (Alpine + Node + production deps).

- [ ] **Step 3: Test the container starts**

Ensure PostgreSQL and Redis are running (via dev docker-compose), then:

Run: `docker compose -f docker-compose.prod.yml up`

Expected:
1. "Running database migrations..."
2. "Migrations completed successfully"
3. "Starting API server..."
4. "API listening on http://localhost:3001/v1"

- [ ] **Step 4: Test API responds**

Run: `curl http://localhost:3001/v1`

Expected: API responds (exact response depends on root route handler).

- [ ] **Step 5: Stop and clean up**

Run: `docker compose -f docker-compose.prod.yml down`

- [ ] **Step 6: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(api): Docker build adjustments"
```

Only commit if changes were needed during testing. Skip if everything worked first try.
