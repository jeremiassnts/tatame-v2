# Tatame — Architecture Design Spec

## 1. Product Overview

Tatame is a management platform for Brazilian Jiu-Jitsu academies. It provides tools for academy managers, instructors, and students to handle class scheduling, attendance tracking, subscription management, belt promotions, and payments.

The platform consists of three applications sharing a common backend API:

- **Mobile app** — React Native + Expo for all user roles
- **Backend API** — Express + Node.js modular monolith
- **Web panel** — Next.js 16 for the landing page and manager dashboard

---

## 2. User Roles

A user has a **single role**, chosen at first login:

- **Manager** — creates and manages an academy
- **Instructor** — teaches classes at one academy
- **Student** — trains at one academy

Roles are stored in a `user_roles` history table with an `is_active` flag. Only one active role per user. In MVP, users cannot switch roles — they must delete their account and re-register. The history table exists for future flexibility.

---

## 3. Academy Membership

Each user (instructor or student) can have **one active academy membership** at a time. Memberships are tracked in `academy_memberships` with history (via `is_active`, `joined_at`, `left_at`).

**Membership flow:**
1. User searches for an academy
2. User requests to join → status = `pending`
3. Manager approves → status = `active`
4. Manager can reject → status = `rejected`
5. Manager can block → status = `blocked` (cannot request again unless unblocked)
6. User can leave → `is_active = false`, `left_at` set

A manager is automatically an active member of their own academy upon creation.

---

## 4. Monorepo Structure

```
tatame-v2/
├── apps/
│   ├── mobile/          # React Native + Expo
│   ├── api/             # Express modular monolith
│   └── web/             # Next.js 16 (landing + manager dashboard)
├── packages/
│   ├── types/           # Shared TypeScript types, enums, DTOs
│   ├── validators/      # Shared Zod schemas (API contracts)
│   ├── config/          # Env parsing, shared constants
│   └── db/              # Drizzle schema, migrations, client
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── AGENTS.md
└── .env.example
```

**Tooling:** pnpm workspaces + Turborepo

### Shared Packages

**`packages/types`**
- Enums: `Role`, `MembershipStatus`, `PaymentMethod`, `Belt`, `SubscriptionStatus`, `DayOfWeek`
- DTOs: response types for API endpoints
- Types inferred from Zod schemas via `z.infer<>`

**`packages/validators`**
- Zod schemas for every API request/response
- Organized per module (e.g., `academy.schema.ts`, `checkin.schema.ts`)
- Consumed by API (request validation), mobile (form validation), web (form validation)

**`packages/config`**
- Type-safe environment variable parsing with Zod
- Shared constants: belt order, max stripes per belt, day-of-week mapping
- API base URL per environment

**`packages/db`**
- Drizzle ORM schema definitions (all tables)
- Migration files
- Drizzle client factory
- Runtime usage by `apps/api` only; other packages may import for type inference

App-specific code stays within each app. Shared packages are only for genuinely cross-cutting concerns.

---

## 5. Backend Architecture

### Modular Monolith

A single Express server organized into domain modules:

```
apps/api/src/
├── modules/
│   ├── academy/         # Academy CRUD, settings
│   ├── auth/            # Clerk webhooks, JWT verification
│   ├── class/           # Recurring class CRUD
│   ├── checkin/         # Check-in with Redis lock
│   ├── membership/      # Join/leave, approval flow, history
│   ├── graduation/      # Belt/stripe promotion, history
│   ├── subscription/    # Plan CRUD, student plan selection, payment confirmation
│   └── user/            # Profile management, role history
├── middleware/
│   ├── auth.ts          # Clerk JWT verification
│   ├── authorize.ts     # Role-based permission check
│   ├── validate.ts      # Zod request validation
│   └── error-handler.ts
├── lib/
│   ├── redis.ts         # node-redis client
│   ├── lock.ts          # Redis lock for check-ins
│   └── db.ts            # Drizzle client instance
├── router.ts            # Aggregates all module routes
└── server.ts            # Express app setup
```

Each module follows the pattern:
- `module.routes.ts` — route definitions
- `module.controller.ts` — request handling
- `module.service.ts` — business logic
- `module.validator.ts` — imports/re-exports from `packages/validators`

### Request Flow

1. Request → global middleware (CORS, body parser, Clerk JWT verification)
2. Router dispatches to module route
3. Route applies `authorize(roles)` + `validate(schema)` middleware
4. Controller calls service
5. Service executes business logic (Drizzle/Redis)
6. Controller returns response

### API Style

REST with conventional resource-based routes. Request/response contracts defined as Zod schemas in `packages/validators`, validated on both client and server.

---

## 6. Database Schema

**Database:** PostgreSQL with Drizzle ORM

### 6.1 users

| column | type | description |
|---|---|---|
| id | uuid (pk) | internal user id |
| clerk_user_id | text (unique) | Clerk identity |
| email | text (unique) | user email |
| name | text | display name |
| profile_image_url | text | from Clerk |
| phone | text | optional |
| instagram | text | optional, username |
| birth_date | date | optional |
| created_at | timestamp | |
| updated_at | timestamp | |

### 6.2 user_roles

| column | type | description |
|---|---|---|
| id | uuid (pk) | |
| user_id | uuid (fk users) | |
| role | enum (manager, instructor, student) | |
| is_active | boolean | only one active at a time |
| started_at | timestamp | when role was assigned |
| ended_at | timestamp | null if active |

**Constraint:** unique partial index on `(user_id)` where `is_active = true`

### 6.3 academies

| column | type | description |
|---|---|---|
| id | uuid (pk) | |
| owner_id | uuid (fk users) | the manager who created it |
| name | text | |
| logo_url | text | |
| address | text | |
| contact_email | text | |
| contact_phone | text | |
| founded_at | date | academy founding date |
| created_at | timestamp | |
| updated_at | timestamp | |

### 6.4 academy_memberships

| column | type | description |
|---|---|---|
| id | uuid (pk) | |
| academy_id | uuid (fk academies) | |
| user_id | uuid (fk users) | |
| role | enum (manager, instructor, student) | role in this academy |
| status | enum (pending, active, rejected, blocked) | |
| is_active | boolean | only one active membership per user |
| joined_at | timestamp | when approved |
| left_at | timestamp | null if active |
| created_at | timestamp | |

**Constraint:** unique partial index on `(user_id)` where `is_active = true`

### 6.5 classes

| column | type | description |
|---|---|---|
| id | uuid (pk) | |
| academy_id | uuid (fk academies) | |
| instructor_id | uuid (fk users) | who teaches |
| name | text | e.g., "Fundamentals" |
| description | text | optional |
| day_of_week | smallint (0-6) | 0=Sunday, 6=Saturday |
| start_time | time | |
| end_time | time | |
| created_at | timestamp | |
| updated_at | timestamp | |

**Index:** `(academy_id, day_of_week)` for schedule queries

### 6.6 checkins

| column | type | description |
|---|---|---|
| id | uuid (pk) | |
| class_id | uuid (fk classes) | |
| user_id | uuid (fk users) | student |
| checked_in_at | timestamp | |
| week_reference | date | Monday of the calendar week |

**Index:** `(user_id, week_reference)` for weekly count queries
**Constraint:** unique index on `(user_id, class_id, week_reference)` — no duplicate check-ins to same class in same week

### 6.7 subscription_plans

| column | type | description |
|---|---|---|
| id | uuid (pk) | |
| academy_id | uuid (fk academies) | |
| name | text | e.g., "Gold Plan" |
| recurrence_months | smallint | 1, 3, 6, 12 |
| price_cents | integer | price in cents |
| weekly_checkin_limit | smallint | null = unlimited |
| is_active | boolean | manager can deactivate |
| created_at | timestamp | |
| updated_at | timestamp | |

### 6.8 student_subscriptions

| column | type | description |
|---|---|---|
| id | uuid (pk) | |
| user_id | uuid (fk users) | |
| plan_id | uuid (fk subscription_plans) | |
| status | enum (active, expired, cancelled) | |
| starts_at | date | |
| expires_at | date | |
| created_at | timestamp | |

### 6.9 payments

| column | type | description |
|---|---|---|
| id | uuid (pk) | |
| subscription_id | uuid (fk student_subscriptions) | |
| user_id | uuid (fk users) | student |
| academy_id | uuid (fk academies) | |
| amount_cents | integer | amount paid |
| method | enum (manual, stripe) | |
| confirmed_by | uuid (fk users) | manager who confirmed (null for stripe) |
| stripe_payment_id | text | null for manual |
| reference_month | date | first day of the billing period month |
| notes | text | optional |
| paid_at | timestamp | when payment was made |
| created_at | timestamp | |

### 6.10 belt_promotions

| column | type | description |
|---|---|---|
| id | uuid (pk) | |
| user_id | uuid (fk users) | student |
| academy_id | uuid (fk academies) | |
| promoted_by | uuid (fk users) | manager or instructor |
| belt | enum (white, blue, purple, brown, black) | |
| stripes | smallint | 0-4 for white through brown, 0-10 for black |
| is_current | boolean | only one current per user |
| promoted_at | timestamp | |
| notes | text | optional |

**Constraint:** unique partial index on `(user_id)` where `is_current = true`

### Belt Rules

- Belt order: white → blue → purple → brown → black
- Stripes: 0-4 for white, blue, purple, brown
- Stripes: 0-10 for black belt
- Initial belt registered by the student upon academy approval
- Subsequent promotions by manager or instructor only

---

## 7. Redis Strategy

**Client:** node-redis (v4)
**Usage in MVP:** Check-in locks only. No caching.

### Check-in Lock Flow

**Lock key:** `checkin:lock:{user_id}:{week_reference}`

1. Student requests check-in
2. **Validate:** class is within 12h window before class end time
3. **Validate:** student has an active subscription
4. **Acquire lock** with 5s TTL
5. If acquired:
   - Query week's check-in count from DB
   - If `weekly_checkin_limit` is null (unlimited) → allow
   - If count < limit → insert check-in, release lock
   - If count >= limit → reject, release lock
6. If lock not acquired → retry once after 500ms, then fail with "try again"

### 12-Hour Check-in Window

A student can check in to a class starting **12 hours before the class end time**. For example, a class ending at 20:00 on Monday allows check-in from 08:00 Monday onward.

### Weekly Limit

Check-in limits reset on a **calendar week basis (Monday to Sunday)**. The `week_reference` field stores the Monday date of the current week. Managers can create plans with unlimited check-ins (`weekly_checkin_limit = null`).

---

## 8. Authentication & Authorization

### Authentication (Clerk)

- Mobile and web use Clerk SDKs for login/signup
- Clerk issues JWTs, backend verifies via Clerk middleware
- Clerk webhooks sync user lifecycle events to our DB:
  - `user.created` → create user in `users` table
  - `user.updated` → sync profile data
  - `user.deleted` → handle account deletion

### Registration Flow

1. User signs up via Clerk (email or social)
2. Webhook creates record in `users` table
3. User opens app → selects role (manager, instructor, student)
4. Role saved in `user_roles` with `is_active = true`
5. Manager → can create an academy immediately
6. Instructor/Student → must search and request to join an academy

### Authorization

Backend manages all authorization using our own tables.

**Middleware:** `authorize(...allowedRoles)`
1. Reads `user_id` from Clerk JWT
2. Queries active role from `user_roles`
3. Rejects if role not in `allowedRoles`
4. Attaches `{ userId, role, academyId }` to request context

**Permission matrix:**

| Action | Manager | Instructor | Student |
|---|---|---|---|
| Create academy | yes | — | — |
| Edit academy | own | — | — |
| Create/edit class | yes | own classes | — |
| Approve/reject member | yes | — | — |
| Block/unblock member | yes | — | — |
| Check in to class | — | — | yes |
| Confirm payment | yes | — | — |
| Promote belt/stripe | yes | yes | — |
| View schedule | yes | yes | yes |
| Manage subscription plans | yes | — | — |
| Select subscription plan | — | — | yes |

**Academy-scoped authorization:** Most actions are scoped to an academy. The middleware verifies the user has an active membership in the target academy.

---

## 9. Mobile App Architecture

**Stack:** React Native + Expo (managed workflow) + Clerk Expo SDK + Gluestack UI

### UI Components

- **Gluestack** for all UI primitives (buttons, inputs, cards, etc.)
- **Custom modal-based select** — opens a modal with a scrollable list. No native select or Gluestack select component.

### State Management

- **React Query (TanStack Query)** for server state — caching, background refetch, offline read cache
- **Local state** with React context or zustand only where needed

### Navigation

Expo Router (file-based routing) with route groups:
- `(auth)/` — login, signup, role selection
- `(app)/` — main screens, protected by auth
- Role-based conditional rendering within `(app)/`

### Forced Update Check

On app launch (when online):
- Call a `/version` endpoint or use Expo Updates
- Compare current app version against minimum required version
- If outdated → block with "please update" screen pointing to the app store

### Offline Support

- React Query cache persisted to AsyncStorage via `persistQueryClient`
- Cached data: class schedules, academy details, subscription info
- All mutations require internet — show clear error when offline

### API Client

- Shared client using `fetch` or `axios`
- Clerk token automatically attached via interceptor
- Base URL from `packages/config`
- Request/response validated against `packages/validators` schemas

---

## 10. Web Panel Architecture

**Stack:** Next.js 16 (App Router) + Clerk Next.js SDK + Radix UI + Tailwind CSS

### Route Structure

- **Public routes** — landing page, pricing, about (SSG, SEO-optimized)
- **Authenticated routes** — `/dashboard/*` (manager only, protected by Clerk middleware)

### Key Decisions

- **No direct DB access** from Next.js — all data flows through the API to keep business logic centralized
- **React Query** for data fetching in the dashboard
- **Radix UI + Tailwind CSS** for the component layer
- Same Clerk JWT validation as mobile on the API side

---

## 11. Key Business Rules Summary

1. **One role per user** — chosen at first login, no switching in MVP
2. **One active academy per user** — must leave before joining another
3. **Membership approval** — manager must approve instructors and students
4. **Rejected = blocked** — rejected users cannot re-request unless unblocked by manager
5. **Classes are recurring** — each class is one day of week + one time slot
6. **Check-in window** — 12 hours before class end time
7. **Weekly check-in limit** — calendar week (Mon-Sun), can be unlimited
8. **Check-in atomicity** — Redis lock prevents exceeding weekly limit
9. **Payments are manual in MVP** — manager confirms payment, history tracked
10. **Belt promotions** — student sets initial belt, only manager/instructor can promote after that
11. **Stripes** — 0-4 for white through brown, 0-10 for black belt
