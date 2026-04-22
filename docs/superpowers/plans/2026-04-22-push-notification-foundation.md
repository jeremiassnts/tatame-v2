# Push Notification Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the push notification infrastructure — database tables, push token CRUD, BullMQ dispatch pipeline, Expo Push API integration, and mobile token registration.

**Architecture:** Server-side notification dispatch via BullMQ worker (following the existing email queue pattern). Mobile registers Expo push tokens on startup and sends them to the API. The API stores tokens, creates notification records, and enqueues jobs that the worker processes via `expo-server-sdk`. Stale tokens are cleaned up automatically on `DeviceNotRegistered` errors.

**Tech Stack:** Drizzle ORM (PostgreSQL), BullMQ + Redis, expo-server-sdk (API), expo-notifications (mobile), Express.js, Zod validators.

---

## File Structure

### packages/db (schema + migration)
- **Modify:** `packages/db/src/schema/index.ts` — add enums + `pushTokens` and `notifications` tables
- **Create:** `packages/db/drizzle/0008_*.sql` — generated migration (via `drizzle-kit generate`)

### packages/types (shared types)
- **Modify:** `packages/types/src/index.ts` — add `NotificationCategory`, `NotificationStatus`, `PushTokenPlatform` const objects

### packages/validators (Zod schemas)
- **Create:** `packages/validators/src/push-token.schema.ts` — register/delete push token schemas
- **Create:** `packages/validators/src/notification.schema.ts` — send notification schema
- **Modify:** `packages/validators/src/index.ts` — re-export new schemas

### apps/api (push-tokens module)
- **Create:** `apps/api/src/modules/push-token/push-token.repository.ts` — interface
- **Create:** `apps/api/src/modules/push-token/push-token.repository.postgres.ts` — Drizzle impl
- **Create:** `apps/api/src/modules/push-token/push-token.repository.in-memory.ts` — test impl
- **Create:** `apps/api/src/modules/push-token/push-token.service.ts` — business logic
- **Create:** `apps/api/src/modules/push-token/push-token.service.test.ts` — unit tests
- **Create:** `apps/api/src/modules/push-token/push-token.routes.ts` — Express routes

### apps/api (notification module — dispatch only)
- **Create:** `apps/api/src/modules/notification/notification.repository.ts` — interface
- **Create:** `apps/api/src/modules/notification/notification.repository.postgres.ts` — Drizzle impl
- **Create:** `apps/api/src/modules/notification/notification.repository.in-memory.ts` — test impl
- **Create:** `apps/api/src/modules/notification/notification.service.ts` — dispatch logic
- **Create:** `apps/api/src/modules/notification/notification.service.test.ts` — unit tests
- **Create:** `apps/api/src/modules/notification/notification.queue.ts` — BullMQ queue
- **Create:** `apps/api/src/modules/notification/notification.worker.ts` — BullMQ worker
- **Create:** `apps/api/src/modules/notification/notification.routes.ts` — Express routes

### apps/api (wiring)
- **Modify:** `apps/api/src/router.ts` — mount push-token + notification routes
- **Modify:** `apps/api/src/server.ts` — start notification worker, add queue to Bull Board

### apps/api (test factories)
- **Modify:** `apps/api/src/testing/factories/index.ts` — add `makePushToken`, `makeNotification`

### apps/mobile (token registration)
- **Create:** `apps/mobile/lib/notifications.ts` — registration + handlers
- **Modify:** `apps/mobile/app/(app)/_layout.tsx` — call registration on mount
- **Modify:** `apps/mobile/app.json` — add expo-notifications plugin

---

## Task 1: Database schema — enums and tables

**Files:**
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Add shared type constants to `packages/types/src/index.ts`**

Add at the end of the file:

```typescript
export const NotificationCategory = {
  ClassChange: "class_change",
  Payment: "payment",
  BeltPromotion: "belt_promotion",
  Announcement: "announcement",
  Marketplace: "marketplace",
  Tournament: "tournament",
  NewMember: "new_member",
  SubscriptionAlert: "subscription_alert",
  CheckinAnomaly: "checkin_anomaly",
  Streak: "streak",
  Inactivity: "inactivity",
  Milestone: "milestone",
  WeeklySummary: "weekly_summary",
  Wrapped: "wrapped",
} as const;
export type NotificationCategory =
  (typeof NotificationCategory)[keyof typeof NotificationCategory];

export const NotificationStatus = {
  Pending: "pending",
  Queued: "queued",
  Sent: "sent",
  Failed: "failed",
} as const;
export type NotificationStatus =
  (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const PushTokenPlatform = {
  Ios: "ios",
  Android: "android",
} as const;
export type PushTokenPlatform =
  (typeof PushTokenPlatform)[keyof typeof PushTokenPlatform];
```

- [ ] **Step 2: Add enums and tables to Drizzle schema**

Add to `packages/db/src/schema/index.ts`, after the existing enums:

```typescript
import { jsonb } from "drizzle-orm/pg-core";
```

(Add `jsonb` to the existing import from `drizzle-orm/pg-core`.)

Then add enums:

```typescript
export const pushTokenPlatformEnum = pgEnum("push_token_platform", [
  "ios",
  "android",
]);

export const notificationCategoryEnum = pgEnum("notification_category", [
  "class_change",
  "payment",
  "belt_promotion",
  "announcement",
  "marketplace",
  "tournament",
  "new_member",
  "subscription_alert",
  "checkin_anomaly",
  "streak",
  "inactivity",
  "milestone",
  "weekly_summary",
  "wrapped",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "queued",
  "sent",
  "failed",
]);
```

Then add the `pushTokens` table:

```typescript
export const pushTokens = pgTable(
  "push_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.clerkUserId, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: pushTokenPlatformEnum("platform").notNull(),
    deviceId: text("device_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userDeviceUnique: uniqueIndex("push_tokens_user_device_unique").on(
      t.userId,
      t.deviceId,
    ),
    userIdx: index("push_tokens_user_id_idx").on(t.userId),
  }),
);
```

Then add the `notifications` table:

```typescript
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => users.clerkUserId, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    category: notificationCategoryEnum("category").notNull(),
    data: jsonb("data"),
    readAt: timestamp("read_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    status: notificationStatusEnum("status").notNull().default("pending"),
    academyId: uuid("academy_id").references(() => academies.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    recipientReadIdx: index("notifications_recipient_read_idx").on(
      t.recipientId,
      t.readAt,
    ),
    recipientCreatedIdx: index("notifications_recipient_created_idx").on(
      t.recipientId,
      t.createdAt,
    ),
  }),
);
```

- [ ] **Step 3: Generate the Drizzle migration**

Run from the repo root:

```bash
cd packages/db && pnpm generate
```

Expected: a new `drizzle/0008_*.sql` file with CREATE TYPE and CREATE TABLE statements.

- [ ] **Step 4: Build the db package**

```bash
cd packages/db && pnpm build
```

Expected: clean build, no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/index.ts packages/db/drizzle/ packages/types/src/index.ts
git commit -m "feat(db): add push_tokens and notifications tables (TAT-95)"
```

---

## Task 2: Zod validators for push tokens and notifications

**Files:**
- Create: `packages/validators/src/push-token.schema.ts`
- Create: `packages/validators/src/notification.schema.ts`
- Modify: `packages/validators/src/index.ts`

- [ ] **Step 1: Create push token validators**

Create `packages/validators/src/push-token.schema.ts`:

```typescript
import { z } from "zod";

export const registerPushTokenBodySchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android"]),
  deviceId: z.string().min(1),
});

export type RegisterPushTokenBody = z.infer<typeof registerPushTokenBodySchema>;
```

- [ ] **Step 2: Create notification validators**

Create `packages/validators/src/notification.schema.ts`:

```typescript
import { z } from "zod";

const notificationCategoryValues = [
  "class_change",
  "payment",
  "belt_promotion",
  "announcement",
  "marketplace",
  "tournament",
  "new_member",
  "subscription_alert",
  "checkin_anomaly",
  "streak",
  "inactivity",
  "milestone",
  "weekly_summary",
  "wrapped",
] as const;

export const sendNotificationBodySchema = z.object({
  recipientIds: z.array(z.string().min(1)).min(1),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  category: z.enum(notificationCategoryValues),
  data: z.record(z.unknown()).optional(),
  academyId: z.string().uuid().optional(),
});

export type SendNotificationBody = z.infer<typeof sendNotificationBodySchema>;
```

- [ ] **Step 3: Re-export from index**

Add to `packages/validators/src/index.ts`:

```typescript
export * from "./push-token.schema.js";
export * from "./notification.schema.js";
```

- [ ] **Step 4: Build validators package**

```bash
cd packages/validators && pnpm build
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add packages/validators/src/push-token.schema.ts packages/validators/src/notification.schema.ts packages/validators/src/index.ts
git commit -m "feat(validators): add push token and notification schemas (TAT-95)"
```

---

## Task 3: Push token repository + in-memory impl

**Files:**
- Create: `apps/api/src/modules/push-token/push-token.repository.ts`
- Create: `apps/api/src/modules/push-token/push-token.repository.postgres.ts`
- Create: `apps/api/src/modules/push-token/push-token.repository.in-memory.ts`

- [ ] **Step 1: Create repository interface**

Create `apps/api/src/modules/push-token/push-token.repository.ts`:

```typescript
import type { InferSelectModel } from "drizzle-orm";
import type { pushTokens } from "@tatame/db";

export type PushTokenRow = InferSelectModel<typeof pushTokens>;

export interface IPushTokenRepository {
  upsert(data: {
    userId: string;
    token: string;
    platform: "ios" | "android";
    deviceId: string;
  }): Promise<PushTokenRow>;

  deleteByUserAndDevice(userId: string, deviceId: string): Promise<boolean>;

  findByUserId(userId: string): Promise<PushTokenRow[]>;

  deleteByToken(token: string): Promise<boolean>;
}
```

- [ ] **Step 2: Create Postgres implementation**

Create `apps/api/src/modules/push-token/push-token.repository.postgres.ts`:

```typescript
import { and, eq } from "drizzle-orm";
import { pushTokens, type Database } from "@tatame/db";
import type { IPushTokenRepository, PushTokenRow } from "./push-token.repository.js";

export class PostgresPushTokenRepository implements IPushTokenRepository {
  constructor(private readonly db: Database) {}

  async upsert(data: {
    userId: string;
    token: string;
    platform: "ios" | "android";
    deviceId: string;
  }): Promise<PushTokenRow> {
    const [row] = await this.db
      .insert(pushTokens)
      .values({
        userId: data.userId,
        token: data.token,
        platform: data.platform,
        deviceId: data.deviceId,
      })
      .onConflictDoUpdate({
        target: [pushTokens.userId, pushTokens.deviceId],
        set: {
          token: data.token,
          platform: data.platform,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error("Failed to upsert push token");
    return row;
  }

  async deleteByUserAndDevice(userId: string, deviceId: string): Promise<boolean> {
    const result = await this.db
      .delete(pushTokens)
      .where(
        and(eq(pushTokens.userId, userId), eq(pushTokens.deviceId, deviceId)),
      )
      .returning({ id: pushTokens.id });
    return result.length > 0;
  }

  async findByUserId(userId: string): Promise<PushTokenRow[]> {
    return this.db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId));
  }

  async deleteByToken(token: string): Promise<boolean> {
    const result = await this.db
      .delete(pushTokens)
      .where(eq(pushTokens.token, token))
      .returning({ id: pushTokens.id });
    return result.length > 0;
  }
}
```

- [ ] **Step 3: Create in-memory implementation**

Create `apps/api/src/modules/push-token/push-token.repository.in-memory.ts`:

```typescript
import { randomUUID } from "node:crypto";
import type { IPushTokenRepository, PushTokenRow } from "./push-token.repository.js";

export class InMemoryPushTokenRepository implements IPushTokenRepository {
  constructor(private readonly rows: PushTokenRow[] = []) {}

  async upsert(data: {
    userId: string;
    token: string;
    platform: "ios" | "android";
    deviceId: string;
  }): Promise<PushTokenRow> {
    const existing = this.rows.find(
      (r) => r.userId === data.userId && r.deviceId === data.deviceId,
    );
    if (existing) {
      existing.token = data.token;
      existing.platform = data.platform;
      existing.updatedAt = new Date();
      return existing;
    }
    const now = new Date();
    const row: PushTokenRow = {
      id: randomUUID(),
      userId: data.userId,
      token: data.token,
      platform: data.platform,
      deviceId: data.deviceId,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return row;
  }

  async deleteByUserAndDevice(userId: string, deviceId: string): Promise<boolean> {
    const idx = this.rows.findIndex(
      (r) => r.userId === userId && r.deviceId === deviceId,
    );
    if (idx === -1) return false;
    this.rows.splice(idx, 1);
    return true;
  }

  async findByUserId(userId: string): Promise<PushTokenRow[]> {
    return this.rows.filter((r) => r.userId === userId);
  }

  async deleteByToken(token: string): Promise<boolean> {
    const idx = this.rows.findIndex((r) => r.token === token);
    if (idx === -1) return false;
    this.rows.splice(idx, 1);
    return true;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/push-token/
git commit -m "feat(api): add push-token repository layer (TAT-95)"
```

---

## Task 4: Push token service + tests

**Files:**
- Create: `apps/api/src/modules/push-token/push-token.service.ts`
- Create: `apps/api/src/modules/push-token/push-token.service.test.ts`
- Modify: `apps/api/src/testing/factories/index.ts`

- [ ] **Step 1: Add factory function**

Add to `apps/api/src/testing/factories/index.ts`:

Import the new table:
```typescript
import {
  // ... existing imports ...
  pushTokens,
  notifications,
} from "@tatame/db";
```

Add types:
```typescript
export type PushTokenRow = InferSelectModel<typeof pushTokens>;
export type NotificationRow = InferSelectModel<typeof notifications>;
```

Add factory functions at the end:
```typescript
export function makePushToken(
  overrides: Partial<PushTokenRow> = {},
): PushTokenRow {
  const t = faker.date.recent({ days: 14 });
  return {
    id: rid(),
    userId: `clerk_${faker.string.alphanumeric({ length: 16 })}`,
    token: `ExponentPushToken[${faker.string.alphanumeric({ length: 22 })}]`,
    platform: faker.helpers.arrayElement(["ios", "android"] as const),
    deviceId: faker.string.uuid(),
    createdAt: t,
    updatedAt: t,
    ...overrides,
  };
}

export function makeNotification(
  overrides: Partial<NotificationRow> = {},
): NotificationRow {
  const t = faker.date.recent({ days: 14 });
  return {
    id: rid(),
    recipientId: `clerk_${faker.string.alphanumeric({ length: 16 })}`,
    title: faker.lorem.sentence({ min: 3, max: 6 }),
    body: faker.lorem.sentence(),
    category: "payment",
    data: null,
    readAt: null,
    sentAt: null,
    status: "pending",
    academyId: null,
    createdAt: t,
    updatedAt: t,
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the service**

Create `apps/api/src/modules/push-token/push-token.service.ts`:

```typescript
import { HttpError } from "../../lib/http-error.js";
import type { IPushTokenRepository } from "./push-token.repository.js";

export class PushTokenService {
  constructor(private readonly repo: IPushTokenRepository) {}

  async register(data: {
    userId: string;
    token: string;
    platform: "ios" | "android";
    deviceId: string;
  }) {
    return this.repo.upsert(data);
  }

  async unregister(userId: string, deviceId: string) {
    const deleted = await this.repo.deleteByUserAndDevice(userId, deviceId);
    if (!deleted) {
      throw new HttpError(404, "Push token not found");
    }
  }

  async getTokensForUser(userId: string) {
    return this.repo.findByUserId(userId);
  }

  async removeStaleToken(token: string) {
    await this.repo.deleteByToken(token);
  }
}
```

- [ ] **Step 3: Write failing tests**

Create `apps/api/src/modules/push-token/push-token.service.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { HttpError } from "../../lib/http-error.js";
import { makePushToken } from "../../testing/factories/index.js";
import { InMemoryPushTokenRepository } from "./push-token.repository.in-memory.js";
import { PushTokenService } from "./push-token.service.js";

function setup() {
  const repo = new InMemoryPushTokenRepository();
  const service = new PushTokenService(repo);
  return { repo, service };
}

describe("PushTokenService", () => {
  describe("register", () => {
    it("creates a new push token", async () => {
      const { service } = setup();
      const row = await service.register({
        userId: "clerk_abc",
        token: "ExponentPushToken[xxx]",
        platform: "ios",
        deviceId: "device-1",
      });
      expect(row.userId).toBe("clerk_abc");
      expect(row.token).toBe("ExponentPushToken[xxx]");
      expect(row.platform).toBe("ios");
      expect(row.deviceId).toBe("device-1");
    });

    it("upserts when same user+device registers again", async () => {
      const { service } = setup();
      await service.register({
        userId: "clerk_abc",
        token: "ExponentPushToken[old]",
        platform: "ios",
        deviceId: "device-1",
      });
      const updated = await service.register({
        userId: "clerk_abc",
        token: "ExponentPushToken[new]",
        platform: "ios",
        deviceId: "device-1",
      });
      expect(updated.token).toBe("ExponentPushToken[new]");
      const tokens = await service.getTokensForUser("clerk_abc");
      expect(tokens).toHaveLength(1);
    });
  });

  describe("unregister", () => {
    it("deletes an existing token", async () => {
      const { service } = setup();
      await service.register({
        userId: "clerk_abc",
        token: "ExponentPushToken[xxx]",
        platform: "ios",
        deviceId: "device-1",
      });
      await service.unregister("clerk_abc", "device-1");
      const tokens = await service.getTokensForUser("clerk_abc");
      expect(tokens).toHaveLength(0);
    });

    it("throws 404 when token not found", async () => {
      const { service } = setup();
      await expect(
        service.unregister("clerk_abc", "nonexistent"),
      ).rejects.toThrow(HttpError);
    });
  });

  describe("removeStaleToken", () => {
    it("removes token by value", async () => {
      const { service } = setup();
      await service.register({
        userId: "clerk_abc",
        token: "ExponentPushToken[stale]",
        platform: "android",
        deviceId: "device-1",
      });
      await service.removeStaleToken("ExponentPushToken[stale]");
      const tokens = await service.getTokensForUser("clerk_abc");
      expect(tokens).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && npx vitest run src/modules/push-token/push-token.service.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/push-token/push-token.service.ts apps/api/src/modules/push-token/push-token.service.test.ts apps/api/src/testing/factories/index.ts
git commit -m "feat(api): add push-token service with tests (TAT-95)"
```

---

## Task 5: Push token routes + wire into router

**Files:**
- Create: `apps/api/src/modules/push-token/push-token.routes.ts`
- Modify: `apps/api/src/router.ts`

- [ ] **Step 1: Create push token routes**

Create `apps/api/src/modules/push-token/push-token.routes.ts`:

```typescript
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { Role } from "@tatame/types";
import { registerPushTokenBodySchema } from "@tatame/validators";
import type { RegisterPushTokenBody } from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresPushTokenRepository } from "./push-token.repository.postgres.js";
import { PushTokenService } from "./push-token.service.js";

export const pushTokenRouter = Router();

const db = getDb();
const pushTokenService = new PushTokenService(
  new PostgresPushTokenRepository(db),
);

/**
 * `authorize` sets `req.appAuth.userId` to the internal DB uuid,
 * but `push_tokens.userId` references `users.clerk_user_id`.
 * Use Clerk's `getAuth` to get the Clerk user ID for token storage.
 */
pushTokenRouter.post(
  "/",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  validateBody(registerPushTokenBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as RegisterPushTokenBody;
      const { userId: clerkId } = getAuth(req);
      if (!clerkId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const row = await pushTokenService.register({
        userId: clerkId,
        token: body.token,
        platform: body.platform,
        deviceId: body.deviceId,
      });
      res.status(201).json({
        id: row.id,
        platform: row.platform,
        deviceId: row.deviceId,
        createdAt: row.createdAt.toISOString(),
      });
    } catch (e) {
      next(e);
    }
  },
);

pushTokenRouter.delete(
  "/:deviceId",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  async (req, res, next) => {
    try {
      const { userId: clerkId } = getAuth(req);
      if (!clerkId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      await pushTokenService.unregister(clerkId, req.params.deviceId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);
```

- [ ] **Step 2: Mount in router**

Add to `apps/api/src/router.ts`:

Import:
```typescript
import { pushTokenRouter } from "./modules/push-token/push-token.routes.js";
```

Mount (after the existing routes, before `apiRouter.use("/admin", adminRouter)`):
```typescript
apiRouter.use("/push-tokens", pushTokenRouter);
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/push-token/push-token.routes.ts apps/api/src/router.ts
git commit -m "feat(api): add push-token routes (TAT-95)"
```

---

## Task 6: Notification repository + in-memory impl

**Files:**
- Create: `apps/api/src/modules/notification/notification.repository.ts`
- Create: `apps/api/src/modules/notification/notification.repository.postgres.ts`
- Create: `apps/api/src/modules/notification/notification.repository.in-memory.ts`

- [ ] **Step 1: Create repository interface**

Create `apps/api/src/modules/notification/notification.repository.ts`:

```typescript
import type { InferSelectModel } from "drizzle-orm";
import type { notifications } from "@tatame/db";

export type NotificationRow = InferSelectModel<typeof notifications>;

export interface INotificationRepository {
  createMany(
    items: {
      recipientId: string;
      title: string;
      body: string;
      category: NotificationRow["category"];
      data?: Record<string, unknown> | null;
      academyId?: string | null;
    }[],
  ): Promise<NotificationRow[]>;

  updateStatus(
    id: string,
    status: NotificationRow["status"],
    sentAt?: Date,
  ): Promise<void>;
}
```

- [ ] **Step 2: Create Postgres implementation**

Create `apps/api/src/modules/notification/notification.repository.postgres.ts`:

```typescript
import { eq } from "drizzle-orm";
import { notifications, type Database } from "@tatame/db";
import type {
  INotificationRepository,
  NotificationRow,
} from "./notification.repository.js";

export class PostgresNotificationRepository
  implements INotificationRepository
{
  constructor(private readonly db: Database) {}

  async createMany(
    items: {
      recipientId: string;
      title: string;
      body: string;
      category: NotificationRow["category"];
      data?: Record<string, unknown> | null;
      academyId?: string | null;
    }[],
  ): Promise<NotificationRow[]> {
    if (items.length === 0) return [];
    return this.db
      .insert(notifications)
      .values(
        items.map((item) => ({
          recipientId: item.recipientId,
          title: item.title,
          body: item.body,
          category: item.category,
          data: item.data ?? null,
          academyId: item.academyId ?? null,
          status: "pending" as const,
        })),
      )
      .returning();
  }

  async updateStatus(
    id: string,
    status: NotificationRow["status"],
    sentAt?: Date,
  ): Promise<void> {
    await this.db
      .update(notifications)
      .set({
        status,
        ...(sentAt ? { sentAt } : {}),
      })
      .where(eq(notifications.id, id));
  }
}
```

- [ ] **Step 3: Create in-memory implementation**

Create `apps/api/src/modules/notification/notification.repository.in-memory.ts`:

```typescript
import { randomUUID } from "node:crypto";
import type {
  INotificationRepository,
  NotificationRow,
} from "./notification.repository.js";

export class InMemoryNotificationRepository
  implements INotificationRepository
{
  constructor(public readonly rows: NotificationRow[] = []) {}

  async createMany(
    items: {
      recipientId: string;
      title: string;
      body: string;
      category: NotificationRow["category"];
      data?: Record<string, unknown> | null;
      academyId?: string | null;
    }[],
  ): Promise<NotificationRow[]> {
    const now = new Date();
    const created = items.map((item) => {
      const row: NotificationRow = {
        id: randomUUID(),
        recipientId: item.recipientId,
        title: item.title,
        body: item.body,
        category: item.category,
        data: item.data ?? null,
        readAt: null,
        sentAt: null,
        status: "pending",
        academyId: item.academyId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.rows.push(row);
      return row;
    });
    return created;
  }

  async updateStatus(
    id: string,
    status: NotificationRow["status"],
    sentAt?: Date,
  ): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) {
      row.status = status;
      if (sentAt) row.sentAt = sentAt;
      row.updatedAt = new Date();
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/notification/
git commit -m "feat(api): add notification repository layer (TAT-95)"
```

---

## Task 7: BullMQ notification queue

**Files:**
- Create: `apps/api/src/modules/notification/notification.queue.ts`

- [ ] **Step 1: Create the queue module**

Create `apps/api/src/modules/notification/notification.queue.ts`:

```typescript
import { Queue } from "bullmq";

export type NotificationJobData = {
  notificationId: string;
  recipientId: string;
  expoPushToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

let notificationQueue: Queue | null = null;

export function getNotificationQueue(redisUrl: string): Queue {
  if (!notificationQueue) {
    notificationQueue = new Queue("push-notifications", {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return notificationQueue;
}

export async function closeNotificationQueue(): Promise<void> {
  if (notificationQueue) {
    await notificationQueue.close();
    notificationQueue = null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/notification/notification.queue.ts
git commit -m "feat(api): add push-notifications BullMQ queue (TAT-95)"
```

---

## Task 8: Notification service + tests

**Files:**
- Create: `apps/api/src/modules/notification/notification.service.ts`
- Create: `apps/api/src/modules/notification/notification.service.test.ts`

- [ ] **Step 1: Create the notification service**

Create `apps/api/src/modules/notification/notification.service.ts`:

```typescript
import type { Queue } from "bullmq";
import { logger } from "../../lib/logger.js";
import type { INotificationRepository, NotificationRow } from "./notification.repository.js";
import type { IPushTokenRepository } from "../push-token/push-token.repository.js";
import type { NotificationJobData } from "./notification.queue.js";

export class NotificationService {
  constructor(
    private readonly notificationRepo: INotificationRepository,
    private readonly pushTokenRepo: IPushTokenRepository,
    private readonly queue: { add(name: string, data: NotificationJobData): Promise<unknown> } | null,
  ) {}

  /**
   * Create notification records and enqueue push delivery jobs.
   * Returns created notification rows.
   */
  async send(opts: {
    recipientIds: string[];
    title: string;
    body: string;
    category: NotificationRow["category"];
    data?: Record<string, unknown>;
    academyId?: string;
  }): Promise<NotificationRow[]> {
    const rows = await this.notificationRepo.createMany(
      opts.recipientIds.map((recipientId) => ({
        recipientId,
        title: opts.title,
        body: opts.body,
        category: opts.category,
        data: opts.data ?? null,
        academyId: opts.academyId ?? null,
      })),
    );

    // Enqueue push delivery for each recipient
    for (const row of rows) {
      try {
        const tokens = await this.pushTokenRepo.findByUserId(row.recipientId);
        if (tokens.length === 0) {
          // No push token — notification stays in DB as in-app only
          continue;
        }

        for (const tokenRow of tokens) {
          if (!this.queue) {
            logger.warn("[notification] No queue available, skipping push delivery");
            continue;
          }
          await this.queue.add("push-send", {
            notificationId: row.id,
            recipientId: row.recipientId,
            expoPushToken: tokenRow.token,
            title: opts.title,
            body: opts.body,
            data: opts.data,
          });
        }

        await this.notificationRepo.updateStatus(row.id, "queued");
      } catch (err) {
        logger.error({ err, notificationId: row.id }, "[notification] Failed to enqueue push");
      }
    }

    return rows;
  }
}
```

- [ ] **Step 2: Write tests**

Create `apps/api/src/modules/notification/notification.service.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { InMemoryNotificationRepository } from "./notification.repository.in-memory.js";
import { InMemoryPushTokenRepository } from "../push-token/push-token.repository.in-memory.js";
import { NotificationService } from "./notification.service.js";

function setup() {
  const notificationRepo = new InMemoryNotificationRepository();
  const pushTokenRepo = new InMemoryPushTokenRepository();
  const mockQueue = { add: vi.fn().mockResolvedValue(undefined) };
  const service = new NotificationService(notificationRepo, pushTokenRepo, mockQueue);
  return { notificationRepo, pushTokenRepo, mockQueue, service };
}

describe("NotificationService", () => {
  describe("send", () => {
    it("creates notification records for each recipient", async () => {
      const { service, notificationRepo } = setup();
      const rows = await service.send({
        recipientIds: ["clerk_a", "clerk_b"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      expect(rows).toHaveLength(2);
      expect(notificationRepo.rows).toHaveLength(2);
      expect(rows[0]!.status).toBe("pending");
    });

    it("enqueues push jobs when recipient has a token", async () => {
      const { service, pushTokenRepo, mockQueue } = setup();
      await pushTokenRepo.upsert({
        userId: "clerk_a",
        token: "ExponentPushToken[abc]",
        platform: "ios",
        deviceId: "d1",
      });
      await service.send({
        recipientIds: ["clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        "push-send",
        expect.objectContaining({
          expoPushToken: "ExponentPushToken[abc]",
          title: "Test",
          body: "Hello",
        }),
      );
    });

    it("updates status to queued after enqueuing", async () => {
      const { service, pushTokenRepo, notificationRepo } = setup();
      await pushTokenRepo.upsert({
        userId: "clerk_a",
        token: "ExponentPushToken[abc]",
        platform: "ios",
        deviceId: "d1",
      });
      await service.send({
        recipientIds: ["clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      expect(notificationRepo.rows[0]!.status).toBe("queued");
    });

    it("skips push when recipient has no token (in-app only)", async () => {
      const { service, mockQueue, notificationRepo } = setup();
      await service.send({
        recipientIds: ["clerk_no_token"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      expect(mockQueue.add).not.toHaveBeenCalled();
      // Notification still created in DB
      expect(notificationRepo.rows).toHaveLength(1);
      expect(notificationRepo.rows[0]!.status).toBe("pending");
    });

    it("enqueues multiple jobs when user has multiple devices", async () => {
      const { service, pushTokenRepo, mockQueue } = setup();
      await pushTokenRepo.upsert({
        userId: "clerk_a",
        token: "ExponentPushToken[ios]",
        platform: "ios",
        deviceId: "d1",
      });
      await pushTokenRepo.upsert({
        userId: "clerk_a",
        token: "ExponentPushToken[android]",
        platform: "android",
        deviceId: "d2",
      });
      await service.send({
        recipientIds: ["clerk_a"],
        title: "Test",
        body: "Hello",
        category: "payment",
      });
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
    });

    it("does not throw when queue is null", async () => {
      const notificationRepo = new InMemoryNotificationRepository();
      const pushTokenRepo = new InMemoryPushTokenRepository();
      await pushTokenRepo.upsert({
        userId: "clerk_a",
        token: "ExponentPushToken[abc]",
        platform: "ios",
        deviceId: "d1",
      });
      const service = new NotificationService(notificationRepo, pushTokenRepo, null);
      await expect(
        service.send({
          recipientIds: ["clerk_a"],
          title: "Test",
          body: "Hello",
          category: "payment",
        }),
      ).resolves.not.toThrow();
    });
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd apps/api && npx vitest run src/modules/notification/notification.service.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/notification/notification.service.ts apps/api/src/modules/notification/notification.service.test.ts
git commit -m "feat(api): add notification service with tests (TAT-95)"
```

---

## Task 9: BullMQ notification worker (Expo Push API)

**Files:**
- Create: `apps/api/src/modules/notification/notification.worker.ts`

- [ ] **Step 1: Install expo-server-sdk**

```bash
cd apps/api && pnpm add expo-server-sdk
```

- [ ] **Step 2: Create the worker**

Create `apps/api/src/modules/notification/notification.worker.ts`:

```typescript
import { Expo, type ExpoPushTicket } from "expo-server-sdk";
import { Worker, type Job } from "bullmq";
import { logger } from "../../lib/logger.js";
import { getDb } from "../../lib/db.js";
import { PostgresNotificationRepository } from "./notification.repository.postgres.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import type { NotificationJobData } from "./notification.queue.js";

const expo = new Expo();

async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const { notificationId, expoPushToken, title, body, data } = job.data;

  if (!Expo.isExpoPushToken(expoPushToken)) {
    logger.warn({ expoPushToken, notificationId }, "[push] Invalid Expo push token, removing");
    const db = getDb();
    const pushTokenRepo = new PostgresPushTokenRepository(db);
    await pushTokenRepo.deleteByToken(expoPushToken);
    return;
  }

  const [ticket] = await expo.sendPushNotificationsAsync([
    {
      to: expoPushToken,
      sound: "default",
      title,
      body,
      data: data ?? {},
    },
  ]);

  if (!ticket) {
    throw new Error("No ticket returned from Expo");
  }

  const db = getDb();
  const notificationRepo = new PostgresNotificationRepository(db);

  if (ticket.status === "ok") {
    await notificationRepo.updateStatus(notificationId, "sent", new Date());
    return;
  }

  // ticket.status === "error"
  const errorTicket = ticket as ExpoPushTicket & { details?: { error?: string } };
  logger.error(
    { notificationId, error: errorTicket.message, details: errorTicket.details },
    "[push] Expo push error",
  );

  if (errorTicket.details?.error === "DeviceNotRegistered") {
    const pushTokenRepo = new PostgresPushTokenRepository(db);
    await pushTokenRepo.deleteByToken(expoPushToken);
    logger.info({ expoPushToken }, "[push] Removed stale token (DeviceNotRegistered)");
  }

  await notificationRepo.updateStatus(notificationId, "failed");
  throw new Error(`Expo push error: ${errorTicket.message}`);
}

let notificationWorker: Worker | null = null;

export function startNotificationWorker(redisUrl: string): Worker {
  if (notificationWorker) return notificationWorker;

  notificationWorker = new Worker("push-notifications", processNotificationJob, {
    connection: { url: redisUrl },
    concurrency: 10,
  });

  notificationWorker.on("failed", (job, err) => {
    logger.error(
      { jobName: job?.name, jobId: job?.id, err: err.message },
      "[push] Job failed",
    );
  });

  return notificationWorker;
}

export async function closeNotificationWorker(): Promise<void> {
  if (notificationWorker) {
    await notificationWorker.close();
    notificationWorker = null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/notification/notification.worker.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): add notification worker with Expo Push API (TAT-95)"
```

---

## Task 10: Notification routes + wire everything into server

**Files:**
- Create: `apps/api/src/modules/notification/notification.routes.ts`
- Modify: `apps/api/src/router.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Create notification routes**

Create `apps/api/src/modules/notification/notification.routes.ts`:

```typescript
import { Router } from "express";
import { sendNotificationBodySchema } from "@tatame/validators";
import type { SendNotificationBody } from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { loadEnv } from "@tatame/config";
import { adminOnly } from "../../middleware/admin-only.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresNotificationRepository } from "./notification.repository.postgres.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import { getNotificationQueue } from "./notification.queue.js";
import { NotificationService } from "./notification.service.js";

export const notificationRouter = Router();

function buildService() {
  const db = getDb();
  const env = loadEnv();
  const queue = env.REDIS_URL ? getNotificationQueue(env.REDIS_URL) : null;
  return new NotificationService(
    new PostgresNotificationRepository(db),
    new PostgresPushTokenRepository(db),
    queue,
  );
}

notificationRouter.post(
  "/send",
  adminOnly,
  validateBody(sendNotificationBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as SendNotificationBody;
      const service = buildService();
      const rows = await service.send({
        recipientIds: body.recipientIds,
        title: body.title,
        body: body.body,
        category: body.category,
        data: body.data,
        academyId: body.academyId,
      });
      res.status(201).json({
        created: rows.length,
        ids: rows.map((r) => r.id),
      });
    } catch (e) {
      next(e);
    }
  },
);
```

- [ ] **Step 2: Mount notification routes in router**

Add to `apps/api/src/router.ts`:

Import:
```typescript
import { notificationRouter } from "./modules/notification/notification.routes.js";
```

Mount (alongside push-token route):
```typescript
apiRouter.use("/notifications", notificationRouter);
```

- [ ] **Step 3: Wire worker + queue into server.ts**

Modify `apps/api/src/server.ts`:

Add imports at the top:
```typescript
import {
  closeNotificationQueue,
  getNotificationQueue,
} from "./modules/notification/notification.queue.js";
import {
  startNotificationWorker,
  closeNotificationWorker,
} from "./modules/notification/notification.worker.js";
```

Inside the `if (env.REDIS_URL)` block, after the email worker start and before the Bull Board setup:

```typescript
  startNotificationWorker(env.REDIS_URL);
  logger.info("[push] Notification worker started");
```

Update the `createBullBoard` call to include the notification queue:

```typescript
  createBullBoard({
    queues: [
      new BullMQAdapter(getEmailQueue(env.REDIS_URL)),
      new BullMQAdapter(getNotificationQueue(env.REDIS_URL)),
    ],
    serverAdapter,
  });
```

Update the `shutdown` function to close notification resources:

```typescript
async function shutdown() {
  logger.info("Shutting down...");
  server.close();
  await closeEmailWorker();
  await closeEmailQueue();
  await closeNotificationWorker();
  await closeNotificationQueue();
  process.exit(0);
}
```

- [ ] **Step 4: Verify build**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notification/notification.routes.ts apps/api/src/router.ts apps/api/src/server.ts
git commit -m "feat(api): wire notification routes + worker into server (TAT-95)"
```

---

## Task 11: Mobile — install expo-notifications + registration

**Files:**
- Create: `apps/mobile/lib/notifications.ts`
- Modify: `apps/mobile/app/(app)/_layout.tsx`
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Install expo-notifications**

```bash
cd apps/mobile && npx expo install expo-notifications
```

- [ ] **Step 2: Add plugin to app.json**

Add `"expo-notifications"` to the `plugins` array in `apps/mobile/app.json`:

```json
"plugins": [
  ["expo-system-ui", { "backgroundColor": "#0C0C0C" }],
  "expo-router",
  "expo-font",
  "@react-native-community/datetimepicker",
  ["@stripe/stripe-react-native", { "merchantIdentifier": [] }],
  "expo-notifications"
]
```

- [ ] **Step 3: Create notifications lib**

Create `apps/mobile/lib/notifications.ts`:

```typescript
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Constants.isDevice) {
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Padrão",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return token;
}

export function getDeviceId(): string {
  return Constants.installationId ?? Constants.sessionId ?? "unknown";
}
```

- [ ] **Step 4: Integrate into app layout**

Modify `apps/mobile/app/(app)/_layout.tsx`. Add a new component `PushTokenRegistrar` and render it inside the providers:

Add imports at the top:
```typescript
import { Platform } from "react-native";
import { registerForPushNotificationsAsync, getDeviceId } from "@/lib/notifications";
import { useApi } from "@/lib/api";
```

Add the registrar component (before `AppLayout`):
```typescript
function PushTokenRegistrar() {
  const api = useApi();

  useEffect(() => {
    let mounted = true;

    async function register() {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!token || !mounted) return;

        await api.post("/push-tokens", {
          token,
          platform: Platform.OS as "ios" | "android",
          deviceId: getDeviceId(),
        });
      } catch {
        // Silent failure — push registration is not critical
      }
    }

    register();

    return () => {
      mounted = false;
    };
  }, []);

  return null;
}
```

Render it inside `AppLayout` alongside `AcademySyncer`:
```typescript
export default function AppLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AcademyProvider>
        <AcademySyncer />
        <PushTokenRegistrar />
        <Stack screenOptions={{ headerShown: false }} />
      </AcademyProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/notifications.ts apps/mobile/app/\(app\)/_layout.tsx apps/mobile/app.json apps/mobile/package.json
git commit -m "feat(mobile): add push notification registration (TAT-95)"
```

---

## Task 12: Run full test suite + final verification

- [ ] **Step 1: Run all API tests**

```bash
cd apps/api && npx vitest run
```

Expected: all tests pass (existing + new push-token and notification tests).

- [ ] **Step 2: Type-check all packages**

```bash
pnpm -r run build
```

Expected: clean build across all packages.

- [ ] **Step 3: Verify migration applies**

```bash
cd packages/db && pnpm migrate
```

Expected: migration 0008 applied successfully.

- [ ] **Step 4: Final commit (if any fixes needed)**

If any fixes were required during verification, commit them:

```bash
git add -A
git commit -m "fix(api): address review feedback from verification (TAT-95)"
```
