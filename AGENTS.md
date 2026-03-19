# Tatame — notes for agents

- Architecture spec: `docs/superpowers/specs/2026-03-19-tatame-architecture-design.md`
- Monorepo: **pnpm** workspaces + **Turborepo**
- Database: **PostgreSQL** + **Drizzle** in `packages/db`
- API: `apps/api` (modular Express); **Clerk** — `clerkMiddleware` when `CLERK_SECRET_KEY` is set; webhook `POST /v1/auth/webhooks/clerk` (raw body) with `CLERK_WEBHOOK_SIGNING_SECRET`; `GET /v1/users/me` + `POST /v1/users/me/role` (first login / onboarding role); `authorize(...roles)` sets `req.appAuth` from `user_roles`; after it, `attachActiveAcademyContext` fills `activeAcademyId` + `academyRole` from the active `academy_memberships` row (if any); `requireActiveAcademy` → 403 when missing
- **Academy / membership** — `GET/POST/PATCH /v1/academies`, `GET ?q=` search; `POST /v1/memberships/requests`, `GET /v1/memberships/pending?academyId=`, `PATCH .../approve|reject|block|unblock`, `POST /v1/memberships/leave`. Pending rows use `is_active: false`; exactly one `is_active` membership per user.
- **Classes** — `GET/POST /v1/classes`, `GET/PATCH/DELETE /v1/classes/:classId` scoped to active academy. Manager: full CRUD (`assertManagerOwnsAcademy`); instructor: create/update/delete only own classes; students: read schedule. `DELETE` sets `is_active: false`. Query: `dayOfWeek`, `includeInactive` (managers only).
- Redis (`node-redis` v4) for check-in locks only — `apps/api/src/lib/redis.ts`, `lock.ts`
- Local stack: `docker compose up -d` (Postgres + Redis) — URLs in `.env.example`
- After schema changes: `pnpm db:generate`, then `pnpm db:migrate` with `DATABASE_URL` set
