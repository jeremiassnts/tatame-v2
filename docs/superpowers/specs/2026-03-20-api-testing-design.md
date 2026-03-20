# API Testing Design — Unit & Integration Tests

## Overview

Implement comprehensive unit and integration tests for all 9 modules in `apps/api/`. Unit tests validate service business logic using in-memory repository implementations. Integration tests validate full HTTP flows against a real Postgres database via testcontainers.

## Architecture

### Two Vitest Projects

```
vitest.config.ts (workspace with two projects)
├── unit      → src/**/*.test.ts        (no external deps)
└── integration → src/**/*.integration.test.ts (requires Postgres container)
```

- `unit`: fast, no globalSetup, pool: "forks", runs in CI without Docker. The existing `api.smoke.test.ts` matches this glob and continues to work as-is.
- `integration`: uses globalSetup to start a shared Postgres container, **pool: "forks" with isolate: true** (each test file runs in its own forked process with a clean module cache — this is critical for the dynamic import + `setDbForTest` pattern to work correctly across files). Both projects share `vitest.setup.ts` as a setupFile (sets `DATABASE_URL` placeholder and `NODE_ENV=test`).

### Container Lifecycle (globalSetup)

1. `global-setup.ts` starts a single `PostgreSqlContainer` via testcontainers
2. Exposes connection string via `process.env.TEST_DATABASE_URL`
3. On teardown, stops the container

### Schema Isolation Per Test File

Each `*.integration.test.ts` uses a shared helper:

```
beforeAll:
  1. Create schema with unique name (test_<randomSuffix>)
  2. Apply migrations (read 0000_init.sql, replace all "public" with "test_<suffix>",
     then execute the modified SQL)
  3. Return a Database instance connected to that schema (via SET search_path)

afterEach:
  TRUNCATE all tables with CASCADE (avoids FK ordering issues)

afterAll:
  DROP SCHEMA test_<suffix> CASCADE
  clearDbForTest()
```

The migration SQL (`0000_init.sql`) contains hardcoded `"public".` references in enum types and foreign keys. The helper must string-replace all occurrences of `"public"` with the test schema name before executing to ensure full isolation.

### New File Structure

```
apps/api/
├── vitest.config.ts                        (rewritten — two projects)
├── vitest.setup.ts                         (kept — unit test env vars)
├── src/testing/
│   ├── global-setup.ts                     (starts/stops Postgres container)
│   ├── integration-setup.ts                (schema creation, truncate, teardown)
│   └── factories/
│       └── index.ts                        (makeUser, makeAcademy, etc.)
```

## Unit Tests

### In-Memory Repositories

Each module gets a `*.repository.in-memory.ts` co-located with the interface:

```
modules/<module>/
├── <module>.repository.ts                  (interface — exists)
├── <module>.repository.postgres.ts         (Postgres impl — exists)
├── <module>.repository.in-memory.ts        (in-memory impl — new)
├── <module>.service.ts                     (service — exists)
├── <module>.service.test.ts                (unit test — new or expand)
```

In-memory implementations:
- Use plain arrays/Maps internally
- Implement the same interface as the Postgres version
- Replicate essential behavior: filtering, ordering, unique constraints where relevant
- Do NOT replicate Postgres-specific behavior

#### Handling `withTransaction` in In-Memory Repos

Some repositories (academy, membership) have a `withTransaction(fn)` method. The actual signature is:

```ts
withTransaction<T>(
  fn: (txRepo: IAcademyRepository, createRepo: <R>(factory: RepoFactory<R>) => R) => Promise<T>,
): Promise<T>;
```

Where `RepoFactory<R> = (db: Database) => R`. The calling code passes lambdas like `(txDb) => new PostgresMembershipRepository(txDb)`.

The in-memory implementation ignores the factory parameter and returns pre-registered in-memory repos:

```ts
class InMemoryAcademyRepository implements IAcademyRepository {
  private inMemoryRepos: Map<Function, unknown>;

  constructor(repoMap: Map<Function, unknown>) {
    this.inMemoryRepos = repoMap;
  }

  async withTransaction<T>(
    fn: (txRepo: IAcademyRepository, createRepo: <R>(factory: RepoFactory<R>) => R) => Promise<T>,
  ): Promise<T> {
    const createRepo = <R>(factory: RepoFactory<R>): R => {
      // Look up by Postgres constructor to find the in-memory equivalent
      // e.g., PostgresMembershipRepository → InMemoryMembershipRepository
      return this.inMemoryRepos.get(factory) as R
        ?? (() => { throw new Error("No in-memory repo registered for factory"); })();
    };
    return fn(this, createRepo);
  }
}
```

In tests, the repo map is set up once:

```ts
const membershipRepo = new InMemoryMembershipRepository();
const repoMap = new Map();
repoMap.set(PostgresMembershipRepository, membershipRepo);
const academyRepo = new InMemoryAcademyRepository(repoMap);
```

Note: This works because the service calls `createRepo((db) => new PostgresMembershipRepository(db))`. The factory function's identity won't match, so instead the in-memory `createRepo` should match by a simpler mechanism — for example, the test setup registers factories by repo interface name or the in-memory `withTransaction` simply passes a registry lookup function that ignores the factory entirely and returns the correct pre-built in-memory repo. The exact lookup strategy is an implementation detail; what matters is the type signature matches.

**Important distinction:** Only `IAcademyRepository.withTransaction` uses the `createRepo` parameter. `IMembershipRepository.withTransaction` has a simpler signature — `fn: (txRepo: IMembershipRepository) => Promise<T>` — with no `createRepo`. Its in-memory implementation simply passes `this`:

```ts
async withTransaction<T>(fn: (txRepo: IMembershipRepository) => Promise<T>): Promise<T> {
  return fn(this);
}
```

#### Handling Redis/Lock in Checkin Unit Tests

The `CheckinService.checkIn()` imports from two separate modules:
- `withCheckinLock` from `../../lib/lock.js`
- `requireRedisForCheckin` from `../../lib/redis.js`

For unit tests, mock both modules:

```ts
vi.mock("../../lib/lock.js", () => ({
  withCheckinLock: (_redis: unknown, _key: unknown, fn: () => Promise<unknown>) => fn(),
}));

vi.mock("../../lib/redis.js", () => ({
  requireRedisForCheckin: () => ({}), // returns mock Redis client
}));
```

This isolates business logic from Redis. Lock correctness is an infrastructure concern tested separately in integration.

Note: `checkIn()` also accepts an optional `redis` parameter in its options. Unit tests can pass a mock directly, but the module mocks are still needed for the fallback path where `redis` is not provided.

### Service Unit Tests

Each `*.service.test.ts`:
1. Instantiates in-memory repositories
2. Injects them into the service via constructor (existing DI pattern)
3. Tests success paths, error paths, and edge cases of business logic
4. Uses factories for test data creation

### Factory Return Types

Factories return objects matching `InferSelectModel<typeof table>` — the full row type including `id`, `createdAt`, `updatedAt`, and all required fields. This ensures compatibility with both in-memory repositories (which store these objects) and direct database insertion in integration tests.

## Integration Tests

### Database Injection Strategy

Today, every route file calls `getDb()` at **module scope** to instantiate services as singletons:

```ts
// academy.routes.ts (current)
const db = getDb();
const academyService = new AcademyService(new PostgresAcademyRepository(db), ...);
```

This pattern also exists in:
- `middleware/authorize.ts` (line 9): `const userService = new UserService(new PostgresUserRepository(getDb()));`
- `middleware/academy-context.ts` (line 5): `const membershipRepo = new PostgresMembershipRepository(getDb());`
- `modules/auth/clerk-webhook.handler.ts` (line 27-28): `const db = getDb(); const userService = ...`

All of these execute once on first import, before any test can inject a different database.

**Solution: Refactor `getDb()` to support a `setDbForTest()` override.**

```ts
// lib/db.ts
let _db: Database | undefined;
let _override: Database | undefined;

export function setDbForTest(db: Database) { _override = db; }
export function clearDbForTest() { _override = undefined; }

export function getDb(): Database {
  if (_override) return _override;
  if (!_db) _db = createDb(loadEnv("DATABASE_URL"));
  return _db;
}
```

**Critical: Module cache isolation.** Since route files cache service instances at module scope, each integration test file must run in its own forked process with a fresh module cache. The integration vitest project uses `pool: "forks"` with `isolate: true` (default), ensuring each file gets a clean process. Within each file:

```ts
// 1. Set override BEFORE importing app (which triggers all route/middleware imports)
setDbForTest(db);

// 2. Dynamic import — evaluated fresh in this process
const { createApp } = await import("../../app.js");
const app = createApp();
```

This approach:
- Requires minimal changes to production code (only `lib/db.ts`)
- Does not change any route file signatures
- Works because each test file's process has a clean module cache

### Auth Mocking Strategy

The `authorize` middleware calls `getAuth(req)` from `@clerk/express` and then queries the database for the user and role. For integration tests:

**Mock the `@clerk/express` module via `vi.mock`:**

```ts
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: Function) => next(),
  getAuth: () => ({ userId: "clerk_test_user_id" }),
}));
```

Combined with a real user record in the test database (inserted via factory in `beforeEach`), the `authorize` middleware will:
1. Get the mocked Clerk user ID
2. Look up the real user in the test DB
3. Load the real role from the test DB
4. Set `req.appAuth` as normal

This tests the full authorization flow except the Clerk token verification.

For the `requireSession` middleware (used in user routes), the same `getAuth` mock provides the `userId`.

**Environment setup:** Integration tests must set these env vars to dummy values (via `vitest.setup.ts` or `integration-setup.ts`):
- `CLERK_SECRET_KEY` = `"test_clerk_key"` — required because `createApp()` checks this to decide whether to mount `clerkMiddleware`. Without it, the middleware is skipped and the mock is never invoked.
- `CLERK_WEBHOOK_SIGNING_SECRET` = `"test_webhook_secret"` — required for webhook integration tests. The handler returns 503 if this is missing, bypassing the mocked `verifyWebhook` entirely.

Note: `clerkAuthorizedParties(env)` is also called when `CLERK_SECRET_KEY` is set, but returns `undefined` when `CLERK_AUTHORIZED_PARTIES` is not configured. This is fine because `clerkMiddleware` is mocked.

### Auth Module — Webhook Testing

The `auth` module handles Clerk webhooks via `clerk-webhook.handler.ts`. This handler uses `verifyWebhook` from `@clerk/express/webhooks` (a different import path than `@clerk/express`).

Integration tests for this endpoint:

```ts
vi.mock("@clerk/express/webhooks", () => ({
  verifyWebhook: (_req: unknown) => ({
    type: "user.created",
    data: { id: "clerk_123", email_addresses: [...], first_name: "Test", ... },
  }),
}));
```

- Mock `@clerk/express/webhooks` (not `svix`) to bypass signature checking
- Return controlled webhook event payloads
- Verify user records are correctly created/updated/deleted in the database

### Redis Mocking in Integration Tests

- **All modules except checkin:** Redis is not involved. No mocking needed.
- **Checkin module:** Mock both modules:
  - `vi.mock("../../lib/lock.js")` — `withCheckinLock` executes callback directly
  - `vi.mock("../../lib/redis.js")` — `requireRedisForCheckin` returns mock client
  - This is acceptable because the lock mechanism is an infrastructure concern. The integration test validates the full HTTP → service → DB flow.

### HTTP Integration Test Structure

Each `*.integration.test.ts`:

```ts
import { vi, beforeAll, afterAll, afterEach, test, expect } from "vitest";
import request from "supertest";
import { setupIntegrationTest } from "../../testing/integration-setup.js";
import { setDbForTest, clearDbForTest } from "../../lib/db.js";

// Mock Clerk before any app imports
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: Function) => next(),
  getAuth: () => ({ userId: "clerk_test_user_id" }),
}));

// Setup: schema + db override + app import
const { db, truncateAll, dropSchema } = await setupIntegrationTest();
setDbForTest(db);
const { createApp } = await import("../../app.js");
const app = createApp();

afterEach(() => truncateAll());
afterAll(async () => {
  await dropSchema();
  clearDbForTest();
});

test("POST /v1/graduations promotes student", async () => {
  // arrange: insert user, academy, membership, initial belt via db + factories
  // act: supertest POST request
  // assert: verify response status/body + query db to verify state
});
```

### What Integration Tests Cover

- HTTP status codes (200, 201, 400, 403, 404, 409)
- Zod validation rejecting invalid payloads
- Role-based authorization (correct roles required, real middleware execution)
- Database state after operations (data persisted correctly)
- Multi-step flows (e.g., create plan -> enroll student -> record payment)
- Constraint violations (unique constraints, foreign keys)

## Module Coverage

All 9 modules get both unit and integration tests:

| Module | Unit (service) | Integration (HTTP) | Notes |
|--------|:-:|:-:|-------|
| academy | x | x | Transaction: create academy + manager membership |
| auth | — | x | Webhook handler: mock `@clerk/express/webhooks`, test user upsert/delete |
| checkin | x | x | Complex: window calc, capacity, weekly limits. Redis/lock mocked. |
| class | x | x | Role-based visibility, time validation |
| graduation | x | x | Belt progression rules, atomic promotion |
| membership | x | x | State machine: pending/active/rejected/blocked |
| payment | x | x | Manual payment recording, reference month uniqueness |
| subscription | x | x | Plan CRUD, enrollment with expiry calculation |
| user | x | x | Clerk upsert, initial role assignment |

## Factories

Shared test data builders in `src/testing/factories/index.ts`:

```ts
makeUser(overrides?)          // returns full user row type (InferSelectModel<typeof users>)
makeAcademy(overrides?)       // returns full academy row type
makeMembership(overrides?)    // returns full academy_memberships row type
makeClass(overrides?)         // returns full classes row type
makeCheckin(overrides?)       // returns full checkins row type
makeSubscriptionPlan(overrides?)  // returns full subscription_plans row type
makeStudentSubscription(overrides?)  // returns full student_subscriptions row type
makePayment(overrides?)       // returns full payments row type
makeBeltPromotion(overrides?) // returns full belt_promotions row type
makeUserRole(overrides?)      // returns full user_roles row type
```

Each factory generates valid defaults with unique UUIDs and realistic timestamps. Overrides allow customizing any field. Return types match `InferSelectModel<typeof table>` from Drizzle, including all timestamp fields.

### Fake values (Faker)

Whenever tests or factories need **synthetic or varied dummy data** (names, emails, addresses, prose, numeric jitter, dates, UUIDs, etc.), use **[faker-js/faker](https://github.com/faker-js/faker)** (`@faker-js/faker`). Prefer Faker over hand-rolled random strings or ad-hoc `Math.random` so data stays readable and consistent with one API.

- Import the default English instance: `import { faker } from "@faker-js/faker"`.
- Use **`faker.seed(n)`** in a test file when a deterministic sequence is required (e.g. snapshot-like assertions or debugging ordering).
- Domain enums and invariants (belt progression, membership status transitions) still follow product rules; Faker fills *incidental* fields, not business-invalid combinations unless the test intends to assert validation.

## Migrations for Tests

The existing `packages/db/drizzle/0000_init.sql` contains the full schema DDL. For integration tests:

1. `integration-setup.ts` reads the migration SQL file
2. Replaces all occurrences of `"public"` with `"test_<suffix>"` (the test schema name) — this handles enum type declarations, foreign key references, and any other schema-qualified identifiers
3. Prepends `CREATE SCHEMA "test_<suffix>"` and `SET search_path TO "test_<suffix>"`
4. Executes the modified SQL to create all tables in the isolated schema

Currently there is only one migration file (`0000_init.sql`). The setup reads all `*.sql` files from `packages/db/drizzle/` in journal order (from `meta/_journal.json`) and applies them sequentially, so future migrations are automatically included.

## Dependencies to Add

```
devDependencies:
  @testcontainers/postgresql   # Postgres container management
  @faker-js/faker            # Realistic fake data in factories / tests (see Factories → Fake values)
```

`vitest`, `supertest`, and `postgres` are already available.
