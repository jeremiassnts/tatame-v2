# User Sync on Login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Clerk webhook-based user creation with an explicit `POST /v1/users/me/sync` endpoint called on login, eliminating race conditions and simplifying the architecture.

**Architecture:** New sync endpoint extracts `clerkUserId` from session token, fetches full user data from Clerk Backend API, upserts to database, and optionally assigns initial role. Mobile calls this endpoint after every `setActive(session)` in all auth flows. Webhook handler and separate role endpoint are removed.

**Tech Stack:** Express, Drizzle ORM, `@clerk/backend` (createClerkClient), `@clerk/express` (getAuth), Zod, React Native (Expo), `@clerk/clerk-expo`

**Spec:** `docs/superpowers/specs/2026-03-25-user-sync-on-login-design.md`

---

## File Map

### New files
- `apps/api/src/lib/clerk.ts` — Clerk backend client singleton
- `apps/api/src/modules/user/user.sync.test.ts` — Unit tests for sync handler logic

### Modified files
- `packages/validators/src/user.schema.ts` — Add `syncUserBodySchema`, remove `setInitialRole*` schemas, update JSDoc
- `packages/validators/src/index.ts` — Update exports
- `apps/api/src/modules/user/user.service.ts` — Remove `deleteByClerkId`
- `apps/api/src/modules/user/user.repository.ts` — Remove `deleteByClerkId` from interface
- `apps/api/src/modules/user/user.repository.postgres.ts` — Remove `deleteByClerkId` implementation
- `apps/api/src/modules/user/user.repository.in-memory.ts` — Remove `deleteByClerkId` implementation
- `apps/api/src/modules/user/user.routes.ts` — Add sync endpoint, remove role endpoint, update 404 message
- `apps/api/src/modules/user/user.service.test.ts` — Remove `deleteByClerkId` test, add sync-related tests
- `apps/api/src/app.ts` — Remove webhook route and import
- `packages/config/src/env.ts` — Remove webhook env vars
- `packages/config/src/clerk.ts` — Remove `clerkWebhookSigningSecret`
- `packages/config/src/index.ts` — Remove `clerkWebhookSigningSecret` export
- `apps/mobile/lib/api.ts` — Add standalone `syncUser` function with retry logic

**Note on concurrency safety:** The spec requires protection against concurrent `assignInitialRole` calls. The existing schema already has a partial unique index `user_roles_one_active_per_user` on `userRoles(userId) WHERE isActive = true` (see `packages/db/src/schema/index.ts:82`). This means the DB will reject duplicate active roles, so no additional work is needed.
- `apps/mobile/app/(auth)/sign-in.tsx` — Call `syncUser` after `setActive`
- `apps/mobile/app/(auth)/sign-up.tsx` — Call `syncUser` after `setActive` (OAuth)
- `apps/mobile/app/(auth)/verify-email.tsx` — Replace `assignRole` with `syncUser`

### Deleted files
- `apps/api/src/modules/auth/clerk-webhook.handler.ts`
- `apps/api/src/auth.integration.test.ts` — Webhook integration tests
- `apps/api/src/user.integration.test.ts` — Tests for `POST /me/role` (will be rewritten for sync)

---

### Task 1: Add `syncUserBodySchema` to validators

**Files:**
- Modify: `packages/validators/src/user.schema.ts:1-38`
- Modify: `packages/validators/src/index.ts:9-18`

- [ ] **Step 1: Update `user.schema.ts` — add sync schema, remove old schemas, fix JSDoc**

Replace the content of `packages/validators/src/user.schema.ts` with:

```typescript
import { z } from "zod";

export const roleEnumSchema = z.enum(["manager", "instructor", "student"]);

export const syncUserBodySchema = z.object({
  role: roleEnumSchema.optional(),
});

export type SyncUserBody = z.infer<typeof syncUserBodySchema>;

export const activeAcademySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  logoUrl: z.string().nullable(),
});

export type ActiveAcademy = z.infer<typeof activeAcademySchema>;

export const userMeResponseSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string(),
  email: z.string().email(),
  name: z.string(),
  profileImageUrl: z.string().nullable(),
  /** Null until a role is assigned via POST /users/me/sync. */
  activeRole: roleEnumSchema.nullable(),
  /** Non-null for managers who own an academy. */
  activeAcademy: activeAcademySchema.nullable(),
});

export type UserMeResponse = z.infer<typeof userMeResponseSchema>;
```

- [ ] **Step 2: Update `index.ts` exports**

Replace the user schema exports block (lines 9-18) in `packages/validators/src/index.ts` with:

```typescript
export {
  activeAcademySchema,
  roleEnumSchema,
  syncUserBodySchema,
  userMeResponseSchema,
  type ActiveAcademy,
  type SyncUserBody,
  type UserMeResponse,
} from "./user.schema.js";
```

- [ ] **Step 3: Verify the validators package builds**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo build --filter=@tatame/validators`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/validators/src/user.schema.ts packages/validators/src/index.ts
git commit -m "feat(validators): add syncUserBodySchema, remove setInitialRole schemas"
```

---

### Task 2: Create Clerk backend client singleton

**Files:**
- Create: `apps/api/src/lib/clerk.ts`

- [ ] **Step 1: Create `apps/api/src/lib/clerk.ts`**

```typescript
import { createClerkClient } from "@clerk/backend";
import { loadEnv } from "@tatame/config";

let instance: ReturnType<typeof createClerkClient> | null = null;

export function getClerkClient() {
  if (!instance) {
    const env = loadEnv();
    if (!env.CLERK_SECRET_KEY) {
      throw new Error("CLERK_SECRET_KEY is required for Clerk backend client");
    }
    instance = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  }
  return instance;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/api && npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/clerk.ts
git commit -m "feat(api): add Clerk backend client singleton"
```

---

### Task 3: Remove `deleteByClerkId` from repository interface, implementations, and service

**Files:**
- Modify: `apps/api/src/modules/user/user.repository.ts:14`
- Modify: `apps/api/src/modules/user/user.repository.postgres.ts:39-41`
- Modify: `apps/api/src/modules/user/user.repository.in-memory.ts:46-54`
- Modify: `apps/api/src/modules/user/user.service.ts:16-18`
- Modify: `apps/api/src/modules/user/user.service.test.ts:36-47`

- [ ] **Step 1: Remove `deleteByClerkId` from interface**

In `apps/api/src/modules/user/user.repository.ts`, remove line 14:

```typescript
  deleteByClerkId(clerkUserId: string): Promise<void>;
```

- [ ] **Step 2: Remove `deleteByClerkId` from Postgres repository**

In `apps/api/src/modules/user/user.repository.postgres.ts`, remove lines 39-41:

```typescript
  async deleteByClerkId(clerkUserId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.clerkUserId, clerkUserId));
  }
```

- [ ] **Step 3: Remove `deleteByClerkId` from in-memory repository**

In `apps/api/src/modules/user/user.repository.in-memory.ts`, remove lines 46-54:

```typescript
  async deleteByClerkId(clerkUserId: string): Promise<void> {
    const u = this.users.find((x) => x.clerkUserId === clerkUserId);
    if (!u) return;
    const i = this.users.indexOf(u);
    this.users.splice(i, 1);
    for (let j = this.roles.length - 1; j >= 0; j--) {
      if (this.roles[j]!.userId === u.id) this.roles.splice(j, 1);
    }
  }
```

- [ ] **Step 4: Remove `deleteByClerkId` from service**

In `apps/api/src/modules/user/user.service.ts`, remove lines 16-18:

```typescript
  async deleteByClerkId(clerkUserId: string): Promise<void> {
    await this.userRepo.deleteByClerkId(clerkUserId);
  }
```

- [ ] **Step 5: Remove `deleteByClerkId` test from unit tests**

In `apps/api/src/modules/user/user.service.test.ts`, remove the test at lines 36-47:

```typescript
  it("deleteByClerkId removes user", async () => {
    const repo = new InMemoryUserRepository();
    const svc = new UserService(repo);
    await svc.upsertFromClerk({
      clerkUserId: "x",
      email: "x@example.com",
      name: "X",
      profileImageUrl: null,
    });
    await svc.deleteByClerkId("x");
    expect(await svc.getByClerkId("x")).toBeNull();
  });
```

- [ ] **Step 6: Run unit tests**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx vitest run apps/api/src/modules/user/user.service.test.ts`
Expected: All remaining tests pass

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/api && npx tsc --noEmit --pretty`
Expected: No errors (webhook handler will fail — that's expected and handled in Task 5)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/user/user.repository.ts apps/api/src/modules/user/user.repository.postgres.ts apps/api/src/modules/user/user.repository.in-memory.ts apps/api/src/modules/user/user.service.ts apps/api/src/modules/user/user.service.test.ts
git commit -m "refactor(api): remove deleteByClerkId from user layer"
```

---

### Task 4: Add sync endpoint to user routes

**Files:**
- Modify: `apps/api/src/modules/user/user.routes.ts`

- [ ] **Step 1: Write the sync endpoint and update existing routes**

Replace the full content of `apps/api/src/modules/user/user.routes.ts` with:

```typescript
import { getAuth } from "@clerk/express";
import type { SyncUserBody } from "@tatame/validators";
import {
  syncUserBodySchema,
  userMeResponseSchema,
} from "@tatame/validators";
import { Router } from "express";
import { getClerkClient } from "../../lib/clerk.js";
import { getDb } from "../../lib/db.js";
import { requireSession } from "../../middleware/require-session.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresUserRepository } from "./user.repository.postgres.js";
import { UserService } from "./user.service.js";

export const userRouter = Router();

const db = getDb();
const userService = new UserService(new PostgresUserRepository(db));

function buildMeResponse(row: NonNullable<Awaited<ReturnType<typeof userService.getByClerkId>>>, activeRole: string | null, activeAcademy: Awaited<ReturnType<typeof userService.getActiveAcademyForManager>>) {
  return userMeResponseSchema.parse({
    id: row.id,
    clerkUserId: row.clerkUserId,
    email: row.email,
    name: row.name,
    profileImageUrl: row.profileImageUrl,
    activeRole,
    activeAcademy,
  });
}

userRouter.get("/me", requireSession, async (req, res, next) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const row = await userService.getByClerkId(clerkUserId);

    if (!row) {
      res.status(404).json({
        error: "Usuário não encontrado; faça login novamente",
      });
      return;
    }

    const activeRole = await userService.getActiveRole(row.id);

    let activeAcademy = null;
    if (activeRole === "manager") {
      activeAcademy = await userService.getActiveAcademyForManager(row.id);
    }

    res.json(buildMeResponse(row, activeRole, activeAcademy));
  } catch (e) {
    next(e);
  }
});

userRouter.post(
  "/me/sync",
  requireSession,
  validateBody(syncUserBodySchema),
  async (req, res, next) => {
    try {
      const { userId: clerkUserId } = getAuth(req);
      if (!clerkUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const clerkClient = getClerkClient();
      const clerkUser = await clerkClient.users.getUser(clerkUserId);

      const email = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

      if (!email) {
        res.status(400).json({ error: "Clerk user has no email address" });
        return;
      }

      const nameParts = [clerkUser.firstName, clerkUser.lastName].filter(
        (x): x is string => Boolean(x?.trim()),
      );
      const name = nameParts.length
        ? nameParts.join(" ")
        : clerkUser.username ?? email;

      await userService.upsertFromClerk({
        clerkUserId,
        email,
        name,
        profileImageUrl: clerkUser.imageUrl ?? null,
      });

      const row = await userService.getByClerkId(clerkUserId);
      if (!row) {
        res.status(500).json({ error: "Failed to upsert user" });
        return;
      }

      const { role } = req.validatedBody as SyncUserBody;
      if (role) {
        try {
          await userService.assignInitialRole(row.id, role);
        } catch (err: unknown) {
          // Unique constraint violation (concurrent sync) — role already assigned, ignore
          const isConstraintViolation =
            err instanceof Error && "code" in err && (err as { code: string }).code === "23505";
          if (!isConstraintViolation) throw err;
        }
      }

      const activeRole = await userService.getActiveRole(row.id);

      let activeAcademy = null;
      if (activeRole === "manager") {
        activeAcademy = await userService.getActiveAcademyForManager(row.id);
      }

      res.json(buildMeResponse(row, activeRole, activeAcademy));
    } catch (e) {
      next(e);
    }
  },
);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/api && npx tsc --noEmit --pretty`
Expected: Errors only in `clerk-webhook.handler.ts` (deleted in next task) and `auth.integration.test.ts` (deleted in next task)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/user/user.routes.ts
git commit -m "feat(api): add POST /users/me/sync endpoint, remove POST /users/me/role"
```

---

### Task 5: Remove webhook handler, integration tests, and config

**Files:**
- Delete: `apps/api/src/modules/auth/clerk-webhook.handler.ts`
- Delete: `apps/api/src/auth.integration.test.ts`
- Delete: `apps/api/src/user.integration.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `packages/config/src/env.ts:18-21`
- Modify: `packages/config/src/clerk.ts:10-12`
- Modify: `packages/config/src/index.ts:4`

- [ ] **Step 1: Delete webhook handler file**

```bash
rm apps/api/src/modules/auth/clerk-webhook.handler.ts
```

- [ ] **Step 2: Delete webhook and old user integration tests**

```bash
rm apps/api/src/auth.integration.test.ts
rm apps/api/src/user.integration.test.ts
```

- [ ] **Step 3: Update `app.ts` — remove webhook route and import**

Replace `apps/api/src/app.ts` with:

```typescript
import "./express-augment.js";
import cors from "cors";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { clerkAuthorizedParties, loadEnv } from "@tatame/config";
import { apiRouter } from "./router.js";
import { errorHandler } from "./middleware/error-handler.js";

/** Express app without `listen` — used by `server.ts` and tests. */
export function createApp(): express.Express {
  const env = loadEnv();
  const app = express();

  app.use(cors());
  app.use(express.json());

  if (env.CLERK_SECRET_KEY) {
    app.use(
      clerkMiddleware({
        authorizedParties: clerkAuthorizedParties(env),
      }),
    );
  }

  app.use("/v1", apiRouter);
  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 4: Remove webhook env vars from `env.ts`**

In `packages/config/src/env.ts`, remove lines 18-21:

```typescript
  /** From Clerk Dashboard → Webhooks → signing secret (preferred env name for @clerk/backend) */
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().optional(),
  /** @deprecated use CLERK_WEBHOOK_SIGNING_SECRET — still read as fallback */
  CLERK_WEBHOOK_SECRET: z.string().optional(),
```

- [ ] **Step 5: Remove `clerkWebhookSigningSecret` from `clerk.ts`**

In `packages/config/src/clerk.ts`, remove lines 10-12:

```typescript
export function clerkWebhookSigningSecret(env: Env): string | undefined {
  return env.CLERK_WEBHOOK_SIGNING_SECRET ?? env.CLERK_WEBHOOK_SECRET;
}
```

- [ ] **Step 6: Remove `clerkWebhookSigningSecret` from `index.ts`**

In `packages/config/src/index.ts`, replace lines 2-5:

```typescript
export {
  clerkAuthorizedParties,
  clerkWebhookSigningSecret,
} from "./clerk.js";
```

With:

```typescript
export { clerkAuthorizedParties } from "./clerk.js";
```

- [ ] **Step 7: Verify TypeScript compiles cleanly**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/api && npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 8: Run all API unit tests**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx vitest run apps/api/src/modules/`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add -A apps/api/src/modules/auth/clerk-webhook.handler.ts apps/api/src/auth.integration.test.ts apps/api/src/user.integration.test.ts apps/api/src/app.ts packages/config/src/env.ts packages/config/src/clerk.ts packages/config/src/index.ts
git commit -m "refactor(api): remove Clerk webhook handler and related config"
```

---

### Task 6: Write new sync integration test

**Files:**
- Create: `apps/api/src/user-sync.integration.test.ts`

- [ ] **Step 1: Write the integration test**

Create `apps/api/src/user-sync.integration.test.ts`:

```typescript
import {
  INTEGRATION_CLERK_USER_ID,
  resetIntegrationClerkAuth,
} from "./testing/integration-clerk-mock.js";
import request from "supertest";
import { eq } from "drizzle-orm";
import { users, userRoles } from "@tatame/db/schema";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setDbForTest } from "./lib/db.js";
import { insertUserWithoutRole, insertUserWithGlobalRole } from "./testing/integration-seed.js";
import { setupIntegrationTest } from "./testing/integration-setup.js";

// Mock Clerk backend client
vi.mock("./lib/clerk.js", () => ({
  getClerkClient: () => ({
    users: {
      getUser: vi.fn(async (clerkUserId: string) => ({
        id: clerkUserId,
        emailAddresses: [
          { id: "ea_1", emailAddress: "sync@example.com" },
        ],
        primaryEmailAddressId: "ea_1",
        firstName: "Sync",
        lastName: "User",
        imageUrl: "https://img.example.com/sync.jpg",
        username: null,
      })),
    },
  }),
}));

describe("User sync integration", () => {
  let app: import("express").Express;
  let ctx: Awaited<ReturnType<typeof setupIntegrationTest>>;

  beforeAll(async () => {
    ctx = await setupIntegrationTest();
    setDbForTest(ctx.db);
    const { createApp } = await import("./app.js");
    app = createApp();
  });

  afterEach(async () => {
    resetIntegrationClerkAuth();
    await ctx.truncateAll();
  });

  afterAll(async () => {
    await ctx.dropSchema();
  });

  it("POST /v1/users/me/sync creates user and returns UserMeResponse", async () => {
    const res = await request(app)
      .post("/v1/users/me/sync")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      clerkUserId: INTEGRATION_CLERK_USER_ID,
      email: "sync@example.com",
      name: "Sync User",
      profileImageUrl: "https://img.example.com/sync.jpg",
      activeRole: null,
      activeAcademy: null,
    });
    expect(res.body.id).toBeDefined();
  });

  it("POST /v1/users/me/sync with role assigns role to new user", async () => {
    const res = await request(app)
      .post("/v1/users/me/sync")
      .send({ role: "manager" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      activeRole: "manager",
    });
  });

  it("POST /v1/users/me/sync is idempotent — second call updates user", async () => {
    await request(app).post("/v1/users/me/sync").send({});
    const res = await request(app).post("/v1/users/me/sync").send({});

    expect(res.status).toBe(200);

    const rows = await ctx.db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, INTEGRATION_CLERK_USER_ID));
    expect(rows).toHaveLength(1);
  });

  it("POST /v1/users/me/sync with role ignores role if already assigned", async () => {
    await insertUserWithGlobalRole(ctx.db, INTEGRATION_CLERK_USER_ID, "student");

    const res = await request(app)
      .post("/v1/users/me/sync")
      .send({ role: "manager" });

    expect(res.status).toBe(200);
    expect(res.body.activeRole).toBe("student");
  });

  it("POST /v1/users/me/sync with invalid role returns 400", async () => {
    const res = await request(app)
      .post("/v1/users/me/sync")
      .send({ role: "admin" });

    expect(res.status).toBe(400);
  });

  it("GET /v1/users/me returns 404 with updated message when user not synced", async () => {
    const res = await request(app).get("/v1/users/me");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("faça login novamente");
  });

  it("POST /v1/users/me/sync then GET /v1/users/me returns full profile", async () => {
    await request(app)
      .post("/v1/users/me/sync")
      .send({ role: "student" });

    const me = await request(app).get("/v1/users/me");
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      clerkUserId: INTEGRATION_CLERK_USER_ID,
      activeRole: "student",
      activeAcademy: null,
    });
  });
});
```

- [ ] **Step 2: Run the integration tests**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx vitest run apps/api/src/user-sync.integration.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/user-sync.integration.test.ts
git commit -m "test(api): add integration tests for POST /users/me/sync"
```

---

### Task 7: Add `syncUser` function to mobile API client

**Files:**
- Modify: `apps/mobile/lib/api.ts`

- [ ] **Step 1: Add standalone `syncUser` function with retry logic**

In `apps/mobile/lib/api.ts`, add the following after the `ApiError` class (after line 52):

```typescript
const MAX_SYNC_RETRIES = 3;

/**
 * Sync current Clerk user to our database. Plain function (not a hook)
 * so it can be called from event handlers. Pass the token from getToken().
 * Retries up to 3 times on failure before throwing.
 */
export async function syncUser(
  token: string,
  role?: string | null,
): Promise<void> {
  const body: Record<string, string> = {};
  if (role) body.role = role;

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
    try {
      await request("/users/me/sync", { method: "POST", body, token });
      return;
    } catch (err) {
      lastError = err;
      if (err instanceof ApiError && err.status === 400) throw err;
      if (attempt < MAX_SYNC_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastError;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/mobile && npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/api.ts
git commit -m "feat(mobile): add syncUser function to API client"
```

---

### Task 8: Integrate `syncUser` into sign-in flow

**Files:**
- Modify: `apps/mobile/app/(auth)/sign-in.tsx`

- [ ] **Step 1: Add imports and update handlers**

Add imports at the top of `sign-in.tsx`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/clerk-expo";
import { syncUser } from "@/lib/api";
```

Inside the component, destructure `getToken` from `useAuth`:

```typescript
const { getToken } = useAuth();
```

- [ ] **Step 2: Update `handleSignIn` — add sync after `setActive`**

Replace lines 38-41 of `handleSignIn`:

```typescript
      if (result.status === "complete" && setActive) {
        await setActive({ session: result.createdSessionId });
        router.replace("/(app)");
      }
```

With:

```typescript
      if (result.status === "complete" && setActive) {
        await setActive({ session: result.createdSessionId });
        const token = await getToken();
        if (!token) { setErrors({ general: "Sessão inválida. Tente novamente." }); return; }
        const userType = await AsyncStorage.getItem("userType");
        try {
          await syncUser(token, userType);
          router.replace("/(app)");
        } catch {
          setErrors({ general: "Não foi possível sincronizar. Tente novamente." });
        }
      }
```

- [ ] **Step 3: Update `handleOAuth` — add sync after `setActive`**

Replace lines 67-71 of `handleOAuth`:

```typescript
    try {
      const result = await start();
      if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
        router.replace("/(app)");
      }
```

With:

```typescript
    try {
      const result = await start();
      if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
        const token = await getToken();
        if (!token) { Alert.alert("Erro", "Sessão inválida. Tente novamente."); return; }
        const userType = await AsyncStorage.getItem("userType");
        try {
          await syncUser(token, userType);
          router.replace("/(app)");
        } catch {
          Alert.alert("Erro", "Não foi possível sincronizar. Tente novamente.");
        }
      }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/mobile && npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(auth\)/sign-in.tsx
git commit -m "feat(mobile): call syncUser after sign-in"
```

---

### Task 9: Integrate `syncUser` into sign-up OAuth flow

**Files:**
- Modify: `apps/mobile/app/(auth)/sign-up.tsx`

- [ ] **Step 1: Add imports**

Add imports at the top of `sign-up.tsx`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/clerk-expo";
import { syncUser } from "@/lib/api";
```

Inside the component, destructure `getToken` from `useAuth`:

```typescript
const { getToken } = useAuth();
```

- [ ] **Step 2: Update `handleOAuth` — add sync after `setActive`**

Replace lines 66-70 of `handleOAuth`:

```typescript
    try {
      const result = await start();
      if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
        router.replace("/(app)");
      }
```

With:

```typescript
    try {
      const result = await start();
      if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
        const token = await getToken();
        if (!token) { Alert.alert("Erro", "Sessão inválida. Tente novamente."); return; }
        const userType = await AsyncStorage.getItem("userType");
        try {
          await syncUser(token, userType);
          router.replace("/(app)");
        } catch {
          Alert.alert("Erro", "Não foi possível sincronizar. Tente novamente.");
        }
      }
```

Note: Add `Alert` to the existing `react-native` import if not already there.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/mobile && npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(auth\)/sign-up.tsx
git commit -m "feat(mobile): call syncUser after sign-up OAuth"
```

---

### Task 10: Integrate `syncUser` into verify-email flow

**Files:**
- Modify: `apps/mobile/app/(auth)/verify-email.tsx`

- [ ] **Step 1: Add imports and remove dead code**

Add import at the top:

```typescript
import { useAuth } from "@clerk/clerk-expo";
import { syncUser } from "@/lib/api";
```

Inside the component, destructure `getToken` from `useAuth`:

```typescript
const { getToken } = useAuth();
```

Remove the dead `assignRole` function (lines 57-60):

```typescript
  const assignRole = async () => {
    const userType = await AsyncStorage.getItem("userType");
    if (!userType) return;
  };
```

- [ ] **Step 2: Update `handleVerify` — replace `assignRole` with `syncUser`**

Replace lines 72-75 inside `handleVerify`:

```typescript
      if (result.status === "complete" && setActive) {
        await setActive({ session: result.createdSessionId });
        await assignRole();
        router.replace("/(app)");
      }
```

With:

```typescript
      if (result.status === "complete" && setActive) {
        await setActive({ session: result.createdSessionId });
        const token = await getToken();
        if (!token) { setError("Sessão inválida. Tente novamente."); return; }
        const userType = await AsyncStorage.getItem("userType");
        try {
          await syncUser(token, userType);
          router.replace("/(app)");
        } catch {
          setError("Não foi possível sincronizar. Tente novamente.");
        }
      }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/mobile && npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(auth\)/verify-email.tsx
git commit -m "feat(mobile): call syncUser after email verification, remove dead assignRole"
```

---

### Task 11: Run full verification

- [ ] **Step 1: Build all packages**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo build`
Expected: All packages build successfully

- [ ] **Step 2: Run all API tests**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx vitest run apps/api/`
Expected: All tests pass

- [ ] **Step 3: Verify mobile TypeScript**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/mobile && npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 4: Verify no stale references to removed code**

Run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
grep -r "clerk-webhook" apps/api/src/ --include="*.ts" || echo "OK: no webhook references"
grep -r "setInitialRole" packages/ apps/ --include="*.ts" || echo "OK: no setInitialRole references"
grep -r "CLERK_WEBHOOK" packages/ apps/ --include="*.ts" || echo "OK: no CLERK_WEBHOOK references"
grep -r "deleteByClerkId" apps/api/src/ --include="*.ts" || echo "OK: no deleteByClerkId references"
grep -r "me/role" apps/ packages/ --include="*.ts" | grep -v "me/sync" | grep -v node_modules || echo "OK: no /me/role references"
```
Expected: All checks pass with "OK" messages
