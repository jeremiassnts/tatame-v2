# Tatame — notes for agents

- Architecture spec: `docs/superpowers/specs/2026-03-19-tatame-architecture-design.md`
- Monorepo: **pnpm** workspaces + **Turborepo**
- Database: **PostgreSQL** + **Drizzle** in `packages/db`
- API: `apps/api` (modular Express); **Clerk** — `clerkMiddleware` when `CLERK_SECRET_KEY` is set; webhook `POST /v1/auth/webhooks/clerk` (raw body) with `CLERK_WEBHOOK_SIGNING_SECRET`; `GET /v1/users/me` requires session
- Redis (`node-redis` v4) for check-in locks only — `apps/api/src/lib/redis.ts`, `lock.ts`
- Local stack: `docker compose up -d` (Postgres + Redis) — URLs in `.env.example`
- After schema changes: `pnpm db:generate`, then `pnpm db:migrate` with `DATABASE_URL` set
