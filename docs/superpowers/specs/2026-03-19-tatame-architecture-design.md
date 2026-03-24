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

| column            | type          | description        |
| ----------------- | ------------- | ------------------ |
| id                | uuid (pk)     | internal user id   |
| clerk_user_id     | text (unique) | Clerk identity     |
| email             | text (unique) | user email         |
| name              | text          | display name       |
| profile_image_url | text          | from Clerk         |
| phone             | text          | optional           |
| instagram         | text          | optional, username |
| birth_date        | date          | optional           |
| created_at        | timestamp     |                    |
| updated_at        | timestamp     |                    |

### 6.2 user_roles

| column     | type                                | description               |
| ---------- | ----------------------------------- | ------------------------- |
| id         | uuid (pk)                           |                           |
| user_id    | uuid (fk users)                     |                           |
| role       | enum (manager, instructor, student) |                           |
| is_active  | boolean                             | only one active at a time |
| started_at | timestamp                           | when role was assigned    |
| ended_at   | timestamp                           | null if active            |

**Constraint:** unique partial index on `(user_id)` where `is_active = true`

### 6.3 academies

| column        | type            | description                |
| ------------- | --------------- | -------------------------- |
| id            | uuid (pk)       |                            |
| owner_id      | uuid (fk users) | the manager who created it |
| name          | text            |                            |
| logo_url      | text            |                            |
| address       | text            |                            |
| contact_email | text            |                            |
| contact_phone | text            |                            |
| founded_at    | date            | academy founding date      |
| created_at    | timestamp       |                            |
| updated_at    | timestamp       |                            |

### 6.4 academy_memberships

| column     | type                                      | description                         |
| ---------- | ----------------------------------------- | ----------------------------------- |
| id         | uuid (pk)                                 |                                     |
| academy_id | uuid (fk academies)                       |                                     |
| user_id    | uuid (fk users)                           |                                     |
| role       | enum (manager, instructor, student)       | role in this academy                |
| status     | enum (pending, active, rejected, blocked) |                                     |
| is_active  | boolean                                   | only one active membership per user |
| joined_at  | timestamp                                 | when approved                       |
| left_at    | timestamp                                 | null if active                      |
| created_at | timestamp                                 |                                     |
| updated_at | timestamp                                 |                                     |

**Constraint:** unique partial index on `(user_id)` where `is_active = true`

**Note:** Manager's membership is auto-created with `status = active` (skips `pending`) when they create an academy.

### 6.5 classes

| column        | type                | description                                  |
| ------------- | ------------------- | -------------------------------------------- |
| id            | uuid (pk)           |                                              |
| academy_id    | uuid (fk academies) |                                              |
| instructor_id | uuid (fk users)     | who teaches                                  |
| name          | text                | e.g., "Fundamentals"                         |
| description   | text                | optional                                     |
| day_of_week   | smallint (0-6)      | 0=Sunday, 6=Saturday                         |
| start_time    | time                |                                              |
| end_time      | time                |                                              |
| capacity      | smallint            | max students per session, null = unlimited   |
| is_active     | boolean             | allows temporary suspension without deletion |
| created_at    | timestamp           |                                              |
| updated_at    | timestamp           |                                              |

**Index:** `(academy_id, day_of_week)` for schedule queries

**Note:** Class cancellations for specific dates are out of scope for MVP. Managers can communicate cancellations informally.

### 6.6 checkins

| column         | type              | description                       |
| -------------- | ----------------- | --------------------------------- |
| id             | uuid (pk)         |                                   |
| class_id       | uuid (fk classes) |                                   |
| user_id        | uuid (fk users)   | student                           |
| checked_in_at  | timestamp         |                                   |
| date           | date              | the specific date of the check-in |
| week_reference | date              | Monday of the calendar week       |

**Indexes:**

- `(user_id, week_reference)` for weekly count queries
- `(class_id, date)` for class capacity count queries

**Constraints:**

- unique index on `(user_id, class_id, date)` — no duplicate check-ins to same class on same date

### 6.7 subscription_plans

| column               | type                | description            |
| -------------------- | ------------------- | ---------------------- |
| id                   | uuid (pk)           |                        |
| academy_id           | uuid (fk academies) |                        |
| name                 | text                | e.g., "Gold Plan"      |
| recurrence_months    | smallint            | 1, 3, 6, 12            |
| price_cents          | integer             | price in cents         |
| weekly_checkin_limit | smallint            | null = unlimited       |
| is_active            | boolean             | manager can deactivate |
| created_at           | timestamp           |                        |
| updated_at           | timestamp           |                        |

### 6.8 student_subscriptions

| column     | type                              | description                        |
| ---------- | --------------------------------- | ---------------------------------- |
| id         | uuid (pk)                         |                                    |
| user_id    | uuid (fk users)                   |                                    |
| plan_id    | uuid (fk subscription_plans)      |                                    |
| status     | enum (active, expired, cancelled) | derived from expires_at at runtime |
| starts_at  | date                              |                                    |
| expires_at | date                              |                                    |
| created_at | timestamp                         |                                    |
| updated_at | timestamp                         |                                    |

**Subscription expiry:** Evaluated lazily at runtime. When querying a subscription, check `expires_at < today` — if true, treat as expired regardless of the `status` column. The `status` column serves as a cache and is updated opportunistically (e.g., when the subscription is accessed).

### 6.9 payments

| column            | type                            | description                             |
| ----------------- | ------------------------------- | --------------------------------------- |
| id                | uuid (pk)                       |                                         |
| subscription_id   | uuid (fk student_subscriptions) |                                         |
| user_id           | uuid (fk users)                 | student                                 |
| academy_id        | uuid (fk academies)             |                                         |
| amount_cents      | integer                         | amount paid                             |
| method            | enum (manual, stripe)           |                                         |
| confirmed_by      | uuid (fk users)                 | manager who confirmed (null for stripe) |
| stripe_payment_id | text                            | null for manual                         |
| reference_month   | date                            | first day of the billing period month   |
| notes             | text                            | optional                                |
| paid_at           | timestamp                       | when payment was made                   |
| created_at        | timestamp                       |                                         |

### 6.10 belt_promotions

| column      | type                                     | description                                 |
| ----------- | ---------------------------------------- | ------------------------------------------- |
| id          | uuid (pk)                                |                                             |
| user_id     | uuid (fk users)                          | student                                     |
| academy_id  | uuid (fk academies)                      |                                             |
| promoted_by | uuid (fk users)                          | manager or instructor                       |
| belt        | enum (white, blue, purple, brown, black) |                                             |
| stripes     | smallint                                 | 0-4 for white through brown, 0-10 for black |
| is_current  | boolean                                  | only one current per user                   |
| promoted_at | timestamp                                |                                             |
| notes       | text                                     | optional                                    |

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

**Lock key:** `checkin:lock:{class_id}:{date}`

The lock is scoped per class per date. This serializes all check-in attempts for a given class session, allowing us to safely check both class capacity and the user's weekly limit within the same critical section.

1. Student requests check-in for a class
2. **Validate:** current time is within the check-in window (see below)
3. **Validate:** student has an active subscription (or is within the 3-day grace period)
4. **Acquire lock** on `checkin:lock:{class_id}:{date}` with 5s TTL
5. If acquired:
   - Query today's check-in count for this class → check against `capacity`
   - If capacity is null (unlimited) or count < capacity:
     - Query week's check-in count for this user → check against `weekly_checkin_limit`
     - If weekly limit is null (unlimited) or count < limit → insert check-in, release lock
     - If count >= weekly limit → reject ("weekly limit reached"), release lock
   - If count >= capacity → reject ("class is full"), release lock
6. If lock not acquired → retry once after 500ms, then fail with "try again"

**Redis failure fallback:** If Redis is unavailable (connection refused), check-ins are blocked entirely. The system does not fall back to database-level locking — Redis availability is a requirement for check-in operations.

### Check-in Window

A student can check in to a class starting **12 hours before the class start time**, up until the **class end time**.

Example: a class from 19:00 to 20:00 on Monday allows check-in from 07:00 Monday until 20:00 Monday.

**Implementation note:** Classes that cross midnight (e.g., ending at 02:00) require careful date boundary handling. A class ending at 02:00 Tuesday with start at 23:00 Monday allows check-in from 11:00 Monday until 02:00 Tuesday.

### Weekly Limit

Check-in limits reset on a **calendar week basis (Monday to Sunday)**. The `week_reference` field stores the Monday date of the current week. Managers can create plans with unlimited check-ins (`weekly_checkin_limit = null`).

### Payment Grace Period

Students with an **expired payment** (no payment record for the current billing period) can still check in for **3 days** after their subscription's `expires_at` date. During this grace period, the app shows a warning to the student that their payment is overdue. After the 3-day grace period, check-ins are blocked until payment is confirmed.

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

1. First launch → onboarding: welcome screen, then user type selection (manager, instructor, student)
2. Selected user type saved to localStorage — skipped on subsequent launches
3. User signs up via Clerk (email or social)
4. Webhook creates record in `users` table
5. After first login, app reads userType from localStorage → role saved in `user_roles` with `is_active = true`
6. Manager → can create an academy immediately
7. Instructor/Student → must search and request to join an academy

### Authorization

Backend manages all authorization using our own tables.

**Middleware:** `authorize(...allowedRoles)`

1. Reads `user_id` from Clerk JWT
2. Queries active role from `user_roles`
3. Rejects if role not in `allowedRoles`
4. Attaches `{ userId, role, academyId }` to request context

**Permission matrix:**

| Action                    | Manager | Instructor  | Student |
| ------------------------- | ------- | ----------- | ------- |
| Create academy            | yes     | —           | —       |
| Edit academy              | own     | —           | —       |
| Create/edit class         | yes     | own classes | —       |
| Approve/reject member     | yes     | —           | —       |
| Block/unblock member      | yes     | —           | —       |
| Check in to class         | —       | —           | yes     |
| Confirm payment           | yes     | —           | —       |
| Promote belt/stripe       | yes     | yes         | —       |
| View schedule             | yes     | yes         | yes     |
| Manage subscription plans | yes     | —           | —       |
| Select subscription plan  | —       | —           | yes     |

**Academy-scoped authorization:** Most actions are scoped to an academy. The middleware verifies the user has an active membership in the target academy.

---

## 9. Mobile App Architecture

**Stack:** React Native + Expo (managed workflow) + Clerk Expo SDK + NativeWind v4

### UI Components

- **NativeWind** (Tailwind CSS for RN) for all styling — replaces Gluestack
- **Poppins** as single font family (400, 500, 600, 700)
- **Custom modal-based select** — opens a modal with a scrollable list. No native select component.

### State Management

- **React Query (TanStack Query)** for server state — caching, background refetch, offline read cache
- **Local state** with React context or zustand only where needed

### Navigation

Expo Router (file-based routing) with route groups:

- `(onboarding)/` — welcome, user type selection (shown only on first launch, before auth)
- `(auth)/` — login, signup
- `(app)/` — main screens, protected by auth
- Role-based conditional rendering within `(app)/`

### Onboarding Persistence

On first launch, the app checks localStorage for a `userType` key:

- **Not found** → navigate to `(onboarding)/` flow
- **Found** → skip onboarding, navigate to `(auth)/` or `(app)/` based on auth state

After onboarding, `userType` is saved to localStorage (`manager`, `instructor`, or `student`). This value is consumed once after first login to assign the user's role via the API, then the role is managed server-side.

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
3. **Membership approval** — manager must approve instructors and students; manager's own membership is auto-approved
4. **Rejected = blocked** — rejected users cannot re-request unless unblocked by manager
5. **Classes are recurring** — each class is one day of week + one time slot, with optional capacity limit
6. **Check-in window** — opens 12 hours before class start time, closes at class end time
7. **Weekly check-in limit** — calendar week (Mon-Sun), can be unlimited
8. **Check-in atomicity** — Redis lock per class/date prevents exceeding both class capacity and weekly limit
9. **Payments are manual in MVP** — manager confirms payment, history tracked
10. **Payment grace period** — 3 days after due date, student can still check in with a warning
11. **Subscription expiry** — evaluated lazily at runtime via `expires_at`
12. **Belt promotions** — student sets initial belt, only manager/instructor can promote after that
13. **Stripes** — 0-4 for white through brown, 0-10 for black belt
14. **No academy deletion** — academies cannot be deleted in MVP
15. **Class cancellations** — out of scope for MVP, communicated informally

## 12. Edge Case Behaviors

- **Manager deletes Clerk account:** Block account deletion for managers with active academies. The manager must transfer ownership or the feature is deferred — for MVP, managers simply cannot delete their account while they own an academy.
- **Subscription plan deactivated:** Existing active subscriptions on that plan continue until their `expires_at`. The plan simply becomes unavailable for new selections.
- **Instructor attendance:** Instructors are not tracked for check-in attendance. They are assumed present when teaching their class.

## 13. Clerk Webhook Idempotency

Clerk may retry webhooks. All webhook handlers must be idempotent:

- Use Clerk's `svix_id` header for deduplication, or
- Use `ON CONFLICT (clerk_user_id) DO UPDATE` for user sync operations

## 14. Out of Scope (MVP)

- Stripe payment integration (manual payments only)
- Role switching (delete account and re-register)
- Multi-academy membership
- Class cancellations for specific dates
- Academy deletion
- Redis caching (locks only)
- Offline mutations
