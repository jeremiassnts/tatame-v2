# Tatame — notes for agents

- Architecture spec: `docs/superpowers/specs/2026-03-19-tatame-architecture-design.md`
- Monorepo: **pnpm** workspaces + **Turborepo**
- Database: **PostgreSQL** + **Drizzle** in `packages/db`
- API: `apps/api` (modular Express); Redis / check-in locks come later per spec
- Local Postgres: `docker compose up -d` (repo root) — same URL as `.env.example`
- After schema changes: `pnpm db:generate`, then `pnpm db:migrate` with `DATABASE_URL` set
