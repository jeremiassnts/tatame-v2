# Tatame

Management platform for Brazilian Jiu-Jitsu academies. Managers run their classes,
attendance, belt promotions and billing from one place; students check in, follow their
graduation progress and pay their monthly fee from the mobile app.

Production: [apptatame.com.br](https://apptatame.com.br)

> The codebase is written in English; all user-facing copy is in Brazilian Portuguese.

---

## What it does

| Area | Capability |
| --- | --- |
| **Academies** | Academy profile, public invite page (`/convite/<academyId>`), member directory |
| **Memberships** | Join requests, manager approval, roles (manager, instructor, student, guardian) |
| **Classes** | Weekly schedule, per-class rosters, instructor assignment |
| **Check-ins** | Student self check-in with a Redis lock against double submission; guardians check in their dependents |
| **Graduations** | Belt and degree history, promotion flow for managers and instructors |
| **Dependents** | Guardians register minors, who attend and check in under the guardian's account |
| **Student billing** | PIX and card charges through **Asaas**, split so the money lands in the academy's own subaccount; card checkout through **Stripe** |
| **Manager billing** | Stripe subscription per academy — a 30-day trial on the `pro` plan, then paid. There is no free tier |
| **Payout onboarding** | Each academy gets an Asaas subaccount; its API key is stored AES-256-GCM encrypted at rest |
| **Announcements** | Academy-wide posts |
| **Notifications** | In-app feed plus Expo push, fanned out by BullMQ workers; engagement jobs (streaks, inactivity, weekly summaries) |
| **Admin** | Internal dashboard over platform-wide metrics, academies and payments |

---

## Architecture

A pnpm + Turborepo monorepo with three apps on five shared packages.

```
apps/
  api/        Express 4 REST API (Node 22, ESM) — the only thing that touches the database
  web/        Next.js 15 — landing page, manager signup, invite pages, admin dashboard
  mobile/     Expo / React Native (expo-router) — the product itself, iOS + Android
packages/
  db/         Drizzle ORM schema and migrations (PostgreSQL)
  types/      Shared domain enums and types
  validators/ Zod schemas shared between API, web and mobile
  config/     Typed, Zod-validated environment loader
  email/      React Email templates
infra/
  observability/  OpenTelemetry Collector, Prometheus, Tempo, Loki, Grafana config
```

### API layering

Every module in `apps/api/src/modules/<domain>/` follows the same four files:

```
<domain>.routes.ts            Express router — guards, request validation, HTTP status
<domain>.service.ts           Business rules and authorization; depends on the interface
<domain>.repository.ts        Repository interface (the port)
<domain>.repository.postgres.ts  Drizzle implementation (the adapter)
```

Services receive repositories through the constructor, so unit tests swap in in-memory
implementations and integration tests run against a real PostgreSQL via testcontainers.

### Request pipeline

`apps/api/src/app.ts` composes, in order: telemetry body capture → Helmet → CORS allowlist
→ raw body for webhooks → Clerk session → JSON parser (100 kB) → rate limiting (100 req/min
globally, 10 req/min on auth-ish routes, backed by Redis) → routes → error handler.

Authorization is middleware-composed per route:

| Middleware | What it guarantees |
| --- | --- |
| `requireSession` | A valid Clerk session exists |
| `authorize(...roles)` | Resolves the internal user and their active role, and that it is one of `roles` |
| `attachActiveAcademyContext` | Loads the caller's active `academy_memberships` row onto `req.appAuth` |
| `requireActiveAcademy` | Rejects a caller with no active academy |
| `requireActivePlan` / `requirePlanFeature` | The academy holds a live subscription |
| `adminOnly` | HMAC-SHA256 admin token issued by `POST /v1/admin/login` |

### Stack

- **Runtime** — Node 22, TypeScript 5.9, ESM throughout
- **API** — Express 4, Drizzle ORM, PostgreSQL, Redis (locks + rate limit store), BullMQ (email, push, engagement workers)
- **Auth** — Clerk (`@clerk/express`, `@clerk/nextjs`, `@clerk/clerk-expo`)
- **Payments** — Stripe (subscriptions, card checkout) and Asaas (PIX, split payouts)
- **Storage** — Cloudflare R2 via the S3 SDK (images only, 5 MB, jpeg/png/webp)
- **Email** — Resend + React Email
- **Mobile** — Expo SDK 57, expo-router, NativeWind, TanStack Query, Poppins
- **Web** — Next.js 15 (App Router, Turbopack), Tailwind v4, shadcn/ui, Recharts, Motion
- **Observability** — OpenTelemetry (metrics, traces, logs) → Collector → Prometheus / Tempo / Loki → Grafana, with email alerting
- **Tests** — Vitest; integration suites use `@testcontainers/postgresql`

---

## Getting started

### Requirements

- Node 22+
- pnpm 9.15 (`corepack enable`)
- Docker (PostgreSQL, Redis, and the integration test containers)

### Setup

```bash
pnpm install
cp .env.example .env          # then fill in the values you need
docker compose up -d          # PostgreSQL + Redis
pnpm db:migrate               # apply Drizzle migrations
pnpm db:seed                  # optional demo data
```

`.env.example` documents every variable, including which ones are only read in production.
Almost all integrations are optional — the API boots without them and the dependent
features answer `503` instead of crashing.

The minimum for a working local API:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tatame
REDIS_URL=redis://localhost:6379
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
```

### Running

```bash
pnpm api:dev       # API on :3001
pnpm web:dev       # Next.js on :3000
pnpm mobile:dev    # Expo dev server
```

The mobile app is developed against **Expo Go** on a physical device, so native-only
modules are guarded with `isRunningInExpoGo` and a lazy `require`.

### Common scripts

```bash
pnpm build             # turbo build across the workspace
pnpm typecheck         # tsc --noEmit everywhere
pnpm lint
pnpm test              # unit + integration
pnpm test:unit         # no containers needed
pnpm test:integration  # spins up PostgreSQL via testcontainers
pnpm db:generate       # generate a migration from the schema
pnpm db:studio         # Drizzle Studio
pnpm load-test
```

---

## Testing

Tests are classified by the shape of the code, not by the folder it sits in:

- **Decision logic reachable only through SQL** — proved at the integration layer against
  real PostgreSQL, with one asserted case per predicate. A repository's `where` clauses are
  invisible to every caller, so no unit test can assert them.
- **Route existence** — proved at the boundary through the fully assembled app, asserting a
  live sibling route in the same test. A bare `404` cannot tell a deleted route apart from a
  router that stopped mounting.

Everything else is a unit test over a service with in-memory repositories.

---

## Observability

The API exports metrics, traces and logs over OTLP/gRPC. Nothing is exported unless
`OTEL_COLLECTOR_URL` is set, so local development is unaffected by default.

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

Grafana comes provisioned with dashboards, alert rules and contact points. The dev stack
runs with anonymous admin and never sends mail; the production stack
(`docker-compose.observability.prod.yml`) requires a real admin password and SMTP
credentials. `apps/api` has a typed event catalog and no raw `console.*` calls — see
[`docs/observability.md`](docs/observability.md).

---

## Deployment

- **API** — `Dockerfile.api`, deployed on Coolify. Migrations run at boot when
  `NODE_ENV=production`.
- **Web** — `Dockerfile.web`, Next.js standalone output.
- **Mobile** — EAS Build (`eas.json`), shipped to the App Store and Play Store.
- **Universal Links / App Links** — served by `apps/web` from `/.well-known/`; both routes
  answer `404` until `IOS_APP_ID` and `ANDROID_SHA256_CERT_FINGERPRINTS` are configured.

Auto-deploy on merge is off: `main` is promoted and released manually.

---

## Webhooks

| Endpoint | Source | Verification |
| --- | --- | --- |
| `POST /v1/webhooks/stripe` | Stripe | Signature over the raw body with `STRIPE_WEBHOOK_SECRET` |
| `POST /v1/webhooks/asaas` | Asaas | `asaas-access-token` header; the expected value depends on whether the event is an account-status or a payment event, and the delivery is matched against the platform's own Asaas account id |

Asaas offers no request signature, so the header token is the entire boundary between that
route and anyone able to POST JSON at it. Use a distinct random value per environment.

---

## Contributing

- Branch off `dev`; open pull requests **against `dev`**, never against `main`.
- Commit subjects in English, prefixed with the Linear ticket: `[tat-123] feat: ...`.
- Code, comments and commits in English; user-facing strings in Brazilian Portuguese.
- Styling through NativeWind (mobile) and Tailwind (web) — `className`, not `style` objects.

More conventions live in [`AGENTS.md`](AGENTS.md).
