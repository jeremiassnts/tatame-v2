# Manager Subscription & Plan Enforcement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT — Linear tracking:** Each task has a Linear issue. When you complete a task:
> 1. Update this document by checking off the completed steps (`- [x]`)
> 2. Close the Linear issue (set status to "Done")
> 3. Then commit your changes
>
> **IMPORTANT — Pencil design references:** Tasks that build screens reference Pencil design nodes. Use `mcp__pencil__get_screenshot` and `mcp__pencil__batch_get` with the provided node IDs to inspect the exact design before implementing.

**Goal:** Implement manager subscription with Stripe integration — plan selection gate, Pro payment via Stripe Payment Sheet, plan-based feature restrictions, and subscription management screens.

**Architecture:** Stripe as source of truth for Pro subscriptions. Backend receives Stripe webhooks to sync state to a local `manager_subscriptions` table. Middleware enforces plan limits on restricted API routes. Mobile app gates navigation until a plan is selected and shows contextual alerts for free-plan limits.

**Tech Stack:** Express + Drizzle ORM + Stripe SDK (API), React Native + Expo Router + NativeWind + React Query + `@stripe/stripe-react-native` (mobile), Vitest (tests)

### Linear tracking

| Task | Linear |
|------|--------|
| 1 | [TAT-65](https://linear.app/tatame/issue/TAT-65/manager-subscription-task-1-add-types-env-config-and-db-schema) |
| 2 | [TAT-66](https://linear.app/tatame/issue/TAT-66/manager-subscription-task-2-add-validators-for-manager-subscription) |
| 3 | [TAT-67](https://linear.app/tatame/issue/TAT-67/manager-subscription-task-3-create-stripe-client-and-factory-helper) |
| 4 | [TAT-68](https://linear.app/tatame/issue/TAT-68/manager-subscription-task-4-create-manager-subscription-repository) |
| 5 | [TAT-69](https://linear.app/tatame/issue/TAT-69/manager-subscription-task-5-create-manager-subscription-service-with) |
| 6 | [TAT-70](https://linear.app/tatame/issue/TAT-70/manager-subscription-task-6-create-stripe-webhook-handler) |
| 7 | [TAT-71](https://linear.app/tatame/issue/TAT-71/manager-subscription-task-7-create-api-routes-and-middleware) |
| 8 | [TAT-72](https://linear.app/tatame/issue/TAT-72/manager-subscription-task-8-wire-plan-enforcement-into-existing-routes) |
| 9 | [TAT-73](https://linear.app/tatame/issue/TAT-73/manager-subscription-task-9-create-mobile-hooks-for-manager) |
| 10 | [TAT-74](https://linear.app/tatame/issue/TAT-74/manager-subscription-task-10-install-stripe-react-native-sdk) |
| 11 | [TAT-75](https://linear.app/tatame/issue/TAT-75/manager-subscription-task-11-build-plan-selection-gate-screen-m-mgr-02) |
| 12 | [TAT-76](https://linear.app/tatame/issue/TAT-76/manager-subscription-task-12-add-subscription-gate-to-manager-layout) |
| 13 | [TAT-77](https://linear.app/tatame/issue/TAT-77/manager-subscription-task-13-build-plan-details-and-update-financial) |

Issues are linked with **blocked by** in Linear following task dependencies.

---

## File Map

### Packages (shared)

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/types/src/index.ts` | Modify | Add `ManagerPlan` and `ManagerSubscriptionStatus` enums |
| `packages/validators/src/manager-subscription.schema.ts` | Create | Zod schemas for manager subscription endpoints |
| `packages/validators/src/index.ts` | Modify | Export new schemas |
| `packages/db/src/schema/index.ts` | Modify | Add `managerPlanEnum`, `managerSubscriptionStatusEnum`, `managerSubscriptions` table |
| `packages/config/src/env.ts` | Modify | Add Stripe env vars to schema |

### API (backend)

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/src/modules/manager-subscription/manager-subscription.repository.ts` | Create | Repository interface |
| `apps/api/src/modules/manager-subscription/manager-subscription.repository.postgres.ts` | Create | Postgres implementation |
| `apps/api/src/modules/manager-subscription/manager-subscription.repository.in-memory.ts` | Create | In-memory implementation for tests |
| `apps/api/src/modules/manager-subscription/manager-subscription.service.ts` | Create | Business logic — plan selection, Stripe integration, limits |
| `apps/api/src/modules/manager-subscription/manager-subscription.service.test.ts` | Create | Unit tests |
| `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts` | Create | API endpoints |
| `apps/api/src/modules/manager-subscription/stripe-webhook.handler.ts` | Create | Webhook event processing |
| `apps/api/src/middleware/require-active-plan.ts` | Create | Middleware: blocks requests when subscription inactive |
| `apps/api/src/middleware/require-plan-feature.ts` | Create | Middleware: enforces free-plan limits |
| `apps/api/src/router.ts` | Modify | Register manager-subscription routes |
| `apps/api/src/app.ts` | Modify | Add raw body parsing for Stripe webhooks, register webhook route |
| `apps/api/src/lib/stripe.ts` | Create | Stripe client singleton |
| `apps/api/src/testing/factories/index.ts` | Modify | Add `makeManagerSubscription` factory |
| `apps/api/src/express-augment.ts` | Modify | Add `managerPlan` and `managerSubscriptionStatus` to `appAuth` |

### Mobile (frontend)

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/mobile/lib/hooks/use-manager-subscription.ts` | Create | React Query hooks for subscription + limits |
| `apps/mobile/app/(app)/(manager)/plan-selection.tsx` | Create | Plan selection gate screen (Pencil node `moPBD`) |
| `apps/mobile/app/(app)/(manager)/(finances)/my-plan.tsx` | Create | Plan details screen (Pencil node `vqoDI`) |
| `apps/mobile/app/(app)/(manager)/(finances)/index.tsx` | Modify | Add "Plano atual" card (Pencil node `3sIUB`) |
| `apps/mobile/app/(app)/_layout.tsx` | Modify | Add subscription gate redirect |

---

## Task 1: Add types, env config, and DB schema

**Files:**
- Modify: `packages/types/src/index.ts`
- Modify: `packages/config/src/env.ts`
- Modify: `packages/db/src/schema/index.ts`

- [x] **Step 1: Add ManagerPlan and ManagerSubscriptionStatus to types**

In `packages/types/src/index.ts`, add after the `SubscriptionStatus` block:

```typescript
export const ManagerPlan = {
  Free: "free",
  Pro: "pro",
} as const;
export type ManagerPlan = (typeof ManagerPlan)[keyof typeof ManagerPlan];

export const ManagerSubscriptionStatus = {
  Active: "active",
  PastDue: "past_due",
  Canceled: "canceled",
  Incomplete: "incomplete",
} as const;
export type ManagerSubscriptionStatus =
  (typeof ManagerSubscriptionStatus)[keyof typeof ManagerSubscriptionStatus];
```

- [x] **Step 2: Add Stripe env vars to config**

In `packages/config/src/env.ts`, add to the `envSchema` object:

```typescript
STRIPE_SECRET_KEY: z.string().optional(),
STRIPE_PUBLISHABLE_KEY: z.string().optional(),
STRIPE_WEBHOOK_SECRET: z.string().optional(),
STRIPE_PRO_PRICE_ID: z.string().optional(),
```

- [x] **Step 3: Add DB schema for manager_subscriptions**

In `packages/db/src/schema/index.ts`, add enums after existing enums:

```typescript
export const managerPlanEnum = pgEnum("manager_plan", ["free", "pro"]);

export const managerSubscriptionStatusEnum = pgEnum(
  "manager_subscription_status",
  ["active", "past_due", "canceled", "incomplete"],
);
```

Add the table after existing tables:

```typescript
export const managerSubscriptions = pgTable("manager_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id")
    .notNull()
    .references(() => academies.id, { onDelete: "cascade" })
    .unique(),
  plan: managerPlanEnum("plan").notNull(),
  status: managerSubscriptionStatusEnum("status").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  subscribedAt: timestamp("subscribed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
```

- [x] **Step 4: Generate Drizzle migration**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/db generate`

Expected: New migration file created in `packages/db/drizzle/`

- [x] **Step 5: Run migration**

Run: `pnpm --filter @tatame/db migrate`

Expected: Migration applied successfully

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/index.ts packages/config/src/env.ts packages/db/src/schema/index.ts packages/db/drizzle/
git commit -m "feat: add manager subscription schema, types, and Stripe env config"
```

---

## Task 2: Add validators for manager subscription endpoints

**Files:**
- Create: `packages/validators/src/manager-subscription.schema.ts`
- Modify: `packages/validators/src/index.ts`

- [x] **Step 1: Create manager subscription validators**

Create `packages/validators/src/manager-subscription.schema.ts`:

```typescript
import { z } from "zod";

export const managerSubscriptionResponseSchema = z.object({
  id: z.string().uuid(),
  academyId: z.string().uuid(),
  plan: z.enum(["free", "pro"]),
  status: z.enum(["active", "past_due", "canceled", "incomplete"]),
  stripeCustomerId: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  subscribedAt: z.string(),
  canceledAt: z.string().nullable(),
});

export type ManagerSubscriptionResponse = z.infer<
  typeof managerSubscriptionResponseSchema
>;

export const managerLimitsResponseSchema = z.object({
  students: z.object({ used: z.number(), limit: z.number().nullable() }),
  plans: z.object({ used: z.number(), limit: z.number().nullable() }),
  schedulesPerDay: z.object({
    maxUsed: z.number(),
    limit: z.number().nullable(),
  }),
  instructors: z.object({ allowed: z.boolean() }),
  blocked: z.boolean(),
  plan: z.enum(["free", "pro"]),
});

export type ManagerLimitsResponse = z.infer<typeof managerLimitsResponseSchema>;

export const stripePortalResponseSchema = z.object({
  url: z.string().url(),
});

export const stripeCheckoutResponseSchema = z.object({
  clientSecret: z.string(),
  subscriptionId: z.string(),
});
```

- [x] **Step 2: Export from validators index**

In `packages/validators/src/index.ts`, add:

```typescript
export {
  managerSubscriptionResponseSchema,
  type ManagerSubscriptionResponse,
  managerLimitsResponseSchema,
  type ManagerLimitsResponse,
  stripePortalResponseSchema,
  stripeCheckoutResponseSchema,
} from "./manager-subscription.schema.js";
```

- [x] **Step 3: Verify build**

Run: `pnpm --filter @tatame/validators build`

Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/validators/src/manager-subscription.schema.ts packages/validators/src/index.ts
git commit -m "feat: add Zod validators for manager subscription endpoints"
```

---

## Task 3: Create Stripe client and factory helper

**Files:**
- Create: `apps/api/src/lib/stripe.ts`
- Modify: `apps/api/src/testing/factories/index.ts`
- Modify: `apps/api/src/express-augment.ts`

- [x] **Step 1: Create Stripe client singleton**

Create `apps/api/src/lib/stripe.ts`:

```typescript
import Stripe from "stripe";
import { loadEnv } from "@tatame/config";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const env = loadEnv();
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-04-30.basil",
    });
  }
  return stripeInstance;
}
```

- [x] **Step 2: Add managerPlan and managerSubscriptionStatus to express augment**

In `apps/api/src/express-augment.ts`, add to the `appAuth` interface:

```typescript
managerPlan?: "free" | "pro";
managerSubscriptionStatus?: "active" | "past_due" | "canceled" | "incomplete";
```

- [x] **Step 3: Add makeManagerSubscription factory**

In `apps/api/src/testing/factories/index.ts`, add the import:

```typescript
import { managerSubscriptions } from "@tatame/db";
```

Add the type:

```typescript
export type ManagerSubscriptionRow = InferSelectModel<
  typeof managerSubscriptions
>;
```

Add the factory function:

```typescript
export function makeManagerSubscription(
  overrides: Partial<ManagerSubscriptionRow> = {},
): ManagerSubscriptionRow {
  const t = faker.date.recent({ days: 14 });
  return {
    id: rid(),
    academyId: rid(),
    plan: "free",
    status: "active",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    subscribedAt: t,
    canceledAt: null,
    createdAt: t,
    updatedAt: t,
    ...overrides,
  };
}
```

- [x] **Step 4: Install Stripe SDK**

Run: `pnpm --filter api add stripe`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/stripe.ts apps/api/src/express-augment.ts apps/api/src/testing/factories/index.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat: add Stripe client, express augment, and subscription factory"
```

---

## Task 4: Create manager subscription repository

**Files:**
- Create: `apps/api/src/modules/manager-subscription/manager-subscription.repository.ts`
- Create: `apps/api/src/modules/manager-subscription/manager-subscription.repository.postgres.ts`
- Create: `apps/api/src/modules/manager-subscription/manager-subscription.repository.in-memory.ts`

- [x] **Step 1: Create repository interface**

Create `apps/api/src/modules/manager-subscription/manager-subscription.repository.ts`:

```typescript
import type { InferSelectModel } from "drizzle-orm";
import type { managerSubscriptions } from "@tatame/db";

export type ManagerSubscriptionRow = InferSelectModel<
  typeof managerSubscriptions
>;

export interface IManagerSubscriptionRepository {
  findByAcademyId(
    academyId: string,
  ): Promise<ManagerSubscriptionRow | undefined>;

  findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<ManagerSubscriptionRow | undefined>;

  findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<ManagerSubscriptionRow | undefined>;

  create(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "past_due" | "canceled" | "incomplete";
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    currentPeriodEnd?: Date | null;
  }): Promise<ManagerSubscriptionRow>;

  update(
    id: string,
    data: Partial<{
      plan: "free" | "pro";
      status: "active" | "past_due" | "canceled" | "incomplete";
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      currentPeriodEnd: Date | null;
      canceledAt: Date | null;
    }>,
  ): Promise<ManagerSubscriptionRow | undefined>;
}
```

- [x] **Step 2: Create Postgres implementation**

Create `apps/api/src/modules/manager-subscription/manager-subscription.repository.postgres.ts`:

```typescript
import { eq } from "drizzle-orm";
import { managerSubscriptions, type Database } from "@tatame/db";
import type {
  IManagerSubscriptionRepository,
  ManagerSubscriptionRow,
} from "./manager-subscription.repository.js";

export class PostgresManagerSubscriptionRepository
  implements IManagerSubscriptionRepository
{
  constructor(private readonly db: Database) {}

  async findByAcademyId(
    academyId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(managerSubscriptions)
      .where(eq(managerSubscriptions.academyId, academyId))
      .limit(1);
    return row;
  }

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(managerSubscriptions)
      .where(eq(managerSubscriptions.stripeCustomerId, stripeCustomerId))
      .limit(1);
    return row;
  }

  async findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(managerSubscriptions)
      .where(
        eq(managerSubscriptions.stripeSubscriptionId, stripeSubscriptionId),
      )
      .limit(1);
    return row;
  }

  async create(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "past_due" | "canceled" | "incomplete";
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    currentPeriodEnd?: Date | null;
  }): Promise<ManagerSubscriptionRow> {
    const [row] = await this.db
      .insert(managerSubscriptions)
      .values({
        academyId: data.academyId,
        plan: data.plan,
        status: data.status,
        stripeCustomerId: data.stripeCustomerId ?? null,
        stripeSubscriptionId: data.stripeSubscriptionId ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
      })
      .returning();
    return row;
  }

  async update(
    id: string,
    data: Partial<{
      plan: "free" | "pro";
      status: "active" | "past_due" | "canceled" | "incomplete";
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      currentPeriodEnd: Date | null;
      canceledAt: Date | null;
    }>,
  ): Promise<ManagerSubscriptionRow | undefined> {
    const [row] = await this.db
      .update(managerSubscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(managerSubscriptions.id, id))
      .returning();
    return row;
  }
}
```

- [x] **Step 3: Create in-memory implementation**

Create `apps/api/src/modules/manager-subscription/manager-subscription.repository.in-memory.ts`:

```typescript
import { randomUUID } from "node:crypto";
import type {
  IManagerSubscriptionRepository,
  ManagerSubscriptionRow,
} from "./manager-subscription.repository.js";

export class InMemoryManagerSubscriptionRepository
  implements IManagerSubscriptionRepository
{
  constructor(private readonly rows: ManagerSubscriptionRow[] = []) {}

  async findByAcademyId(
    academyId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    return this.rows.find((r) => r.academyId === academyId);
  }

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    return this.rows.find((r) => r.stripeCustomerId === stripeCustomerId);
  }

  async findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    return this.rows.find(
      (r) => r.stripeSubscriptionId === stripeSubscriptionId,
    );
  }

  async create(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "past_due" | "canceled" | "incomplete";
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    currentPeriodEnd?: Date | null;
  }): Promise<ManagerSubscriptionRow> {
    const t = new Date();
    const row: ManagerSubscriptionRow = {
      id: randomUUID(),
      academyId: data.academyId,
      plan: data.plan,
      status: data.status,
      stripeCustomerId: data.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      subscribedAt: t,
      canceledAt: null,
      createdAt: t,
      updatedAt: t,
    };
    this.rows.push(row);
    return row;
  }

  async update(
    id: string,
    data: Partial<{
      plan: "free" | "pro";
      status: "active" | "past_due" | "canceled" | "incomplete";
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      currentPeriodEnd: Date | null;
      canceledAt: Date | null;
    }>,
  ): Promise<ManagerSubscriptionRow | undefined> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return undefined;
    if (data.plan !== undefined) row.plan = data.plan;
    if (data.status !== undefined) row.status = data.status;
    if (data.stripeCustomerId !== undefined)
      row.stripeCustomerId = data.stripeCustomerId;
    if (data.stripeSubscriptionId !== undefined)
      row.stripeSubscriptionId = data.stripeSubscriptionId;
    if (data.currentPeriodEnd !== undefined)
      row.currentPeriodEnd = data.currentPeriodEnd;
    if (data.canceledAt !== undefined) row.canceledAt = data.canceledAt;
    row.updatedAt = new Date();
    return row;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/manager-subscription/
git commit -m "feat: add manager subscription repository (interface, postgres, in-memory)"
```

---

## Task 5: Create manager subscription service with tests (TDD)

**Files:**
- Create: `apps/api/src/modules/manager-subscription/manager-subscription.service.ts`
- Create: `apps/api/src/modules/manager-subscription/manager-subscription.service.test.ts`

- [x] **Step 1: Write failing tests for free plan selection**

Create `apps/api/src/modules/manager-subscription/manager-subscription.service.test.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  makeAcademy,
  makeManagerSubscription,
  makeMembership,
  makeClass,
  makeSubscriptionPlan,
} from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import type { AcademyRow } from "../academy/academy.repository.js";
import { InMemoryMembershipRepository } from "../membership/membership.repository.in-memory.js";
import type { MembershipRow } from "../membership/membership.repository.js";
import { InMemoryClassRepository } from "../class/class.repository.in-memory.js";
import type { ClassRow } from "../class/class.repository.js";
import { InMemorySubscriptionPlanRepository } from "../subscription/subscription.repository.in-memory.js";
import type { SubscriptionPlanRow } from "../subscription/subscription.repository.js";
import { InMemoryManagerSubscriptionRepository } from "./manager-subscription.repository.in-memory.js";
import type { ManagerSubscriptionRow } from "./manager-subscription.repository.js";
import { ManagerSubscriptionService } from "./manager-subscription.service.js";

function makeSvc(opts: {
  academies?: AcademyRow[];
  memberships?: MembershipRow[];
  classes?: ClassRow[];
  plans?: SubscriptionPlanRow[];
  subscriptions?: ManagerSubscriptionRow[];
}) {
  const acadRepo = new InMemoryAcademyRepository(opts.academies ?? []);
  const memRepo = new InMemoryMembershipRepository(opts.memberships ?? []);
  const classRepo = new InMemoryClassRepository(opts.classes ?? []);
  const planRepo = new InMemorySubscriptionPlanRepository(opts.plans ?? []);
  const subRepo = new InMemoryManagerSubscriptionRepository(
    opts.subscriptions ?? [],
  );
  return {
    svc: new ManagerSubscriptionService(
      subRepo,
      acadRepo,
      memRepo,
      classRepo,
      planRepo,
    ),
    subRepo,
  };
}

describe("ManagerSubscriptionService", () => {
  describe("selectFree", () => {
    it("creates a free subscription for academy", async () => {
      const ownerId = randomUUID();
      const academy = makeAcademy({ ownerId });
      const { svc } = makeSvc({ academies: [academy] });

      const result = await svc.selectFree(ownerId, academy.id);
      expect(result.plan).toBe("free");
      expect(result.status).toBe("active");
      expect(result.stripeCustomerId).toBeNull();
    });

    it("rejects if academy already has subscription", async () => {
      const ownerId = randomUUID();
      const academy = makeAcademy({ ownerId });
      const existing = makeManagerSubscription({ academyId: academy.id });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [existing],
      });

      await expect(svc.selectFree(ownerId, academy.id)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("rejects if user does not own academy", async () => {
      const academy = makeAcademy();
      const { svc } = makeSvc({ academies: [academy] });

      await expect(
        svc.selectFree(randomUUID(), academy.id),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe("getSubscription", () => {
    it("returns subscription for academy", async () => {
      const ownerId = randomUUID();
      const academy = makeAcademy({ ownerId });
      const sub = makeManagerSubscription({ academyId: academy.id });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
      });

      const result = await svc.getSubscription(academy.id);
      expect(result).toBeDefined();
      expect(result!.academyId).toBe(academy.id);
    });

    it("returns undefined when no subscription", async () => {
      const { svc } = makeSvc({});
      const result = await svc.getSubscription(randomUUID());
      expect(result).toBeUndefined();
    });
  });

  describe("getLimits", () => {
    it("returns free plan limits with current usage", async () => {
      const ownerId = randomUUID();
      const academy = makeAcademy({ ownerId });
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "free",
        status: "active",
      });
      const students = Array.from({ length: 5 }, () =>
        makeMembership({
          academyId: academy.id,
          role: "student",
          status: "active",
          isActive: true,
        }),
      );
      const plan = makeSubscriptionPlan({ academyId: academy.id });
      const cls = makeClass({ academyId: academy.id, dayOfWeek: 1 });

      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        memberships: students,
        plans: [plan],
        classes: [cls],
      });

      const limits = await svc.getLimits(academy.id);
      expect(limits.plan).toBe("free");
      expect(limits.students.used).toBe(5);
      expect(limits.students.limit).toBe(50);
      expect(limits.plans.used).toBe(1);
      expect(limits.plans.limit).toBe(1);
      expect(limits.instructors.allowed).toBe(false);
      expect(limits.blocked).toBe(false);
    });

    it("returns pro plan with no limits", async () => {
      const ownerId = randomUUID();
      const academy = makeAcademy({ ownerId });
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "pro",
        status: "active",
      });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
      });

      const limits = await svc.getLimits(academy.id);
      expect(limits.plan).toBe("pro");
      expect(limits.students.limit).toBeNull();
      expect(limits.plans.limit).toBeNull();
      expect(limits.instructors.allowed).toBe(true);
      expect(limits.blocked).toBe(false);
    });

    it("returns blocked=true for canceled pro with students over free limit", async () => {
      const ownerId = randomUUID();
      const academy = makeAcademy({ ownerId });
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "pro",
        status: "canceled",
      });
      const students = Array.from({ length: 51 }, () =>
        makeMembership({
          academyId: academy.id,
          role: "student",
          status: "active",
          isActive: true,
        }),
      );
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        memberships: students,
      });

      const limits = await svc.getLimits(academy.id);
      expect(limits.blocked).toBe(true);
    });
  });

  describe("canApproveStudent", () => {
    it("allows approval under 50 student limit", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "free",
        status: "active",
      });
      const students = Array.from({ length: 49 }, () =>
        makeMembership({
          academyId: academy.id,
          role: "student",
          status: "active",
          isActive: true,
        }),
      );
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        memberships: students,
      });

      await expect(svc.canApproveStudent(academy.id)).resolves.not.toThrow();
    });

    it("blocks approval at 50 students on free plan", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "free",
        status: "active",
      });
      const students = Array.from({ length: 50 }, () =>
        makeMembership({
          academyId: academy.id,
          role: "student",
          status: "active",
          isActive: true,
        }),
      );
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        memberships: students,
      });

      await expect(svc.canApproveStudent(academy.id)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe("canApproveInstructor", () => {
    it("blocks instructor approval on free plan", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "free",
        status: "active",
      });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
      });

      await expect(svc.canApproveInstructor(academy.id)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("allows instructor approval on pro plan", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "pro",
        status: "active",
      });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
      });

      await expect(
        svc.canApproveInstructor(academy.id),
      ).resolves.not.toThrow();
    });
  });

  describe("canCreatePlan", () => {
    it("blocks second plan on free", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "free",
        status: "active",
      });
      const plan = makeSubscriptionPlan({ academyId: academy.id });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        plans: [plan],
      });

      await expect(svc.canCreatePlan(academy.id)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe("canCreateClass", () => {
    it("blocks third class on same day on free", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "free",
        status: "active",
      });
      const cls1 = makeClass({ academyId: academy.id, dayOfWeek: 1 });
      const cls2 = makeClass({ academyId: academy.id, dayOfWeek: 1 });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        classes: [cls1, cls2],
      });

      await expect(svc.canCreateClass(academy.id, 1)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("allows class on different day on free", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "free",
        status: "active",
      });
      const cls1 = makeClass({ academyId: academy.id, dayOfWeek: 1 });
      const cls2 = makeClass({ academyId: academy.id, dayOfWeek: 1 });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        classes: [cls1, cls2],
      });

      await expect(svc.canCreateClass(academy.id, 2)).resolves.not.toThrow();
    });
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter api test -- --run src/modules/manager-subscription/manager-subscription.service.test.ts`

Expected: FAIL — `ManagerSubscriptionService` not found

- [x] **Step 3: Implement the service**

Create `apps/api/src/modules/manager-subscription/manager-subscription.service.ts`:

```typescript
import { HttpError } from "../../lib/http-error.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IClassRepository } from "../class/class.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { ISubscriptionPlanRepository } from "../subscription/subscription.repository.js";
import type {
  IManagerSubscriptionRepository,
  ManagerSubscriptionRow,
} from "./manager-subscription.repository.js";

const FREE_STUDENT_LIMIT = 50;
const FREE_PLAN_LIMIT = 1;
const FREE_DAILY_SCHEDULE_LIMIT = 2;

export class ManagerSubscriptionService {
  constructor(
    private readonly subRepo: IManagerSubscriptionRepository,
    private readonly acadRepo: IAcademyRepository,
    private readonly memRepo: IMembershipRepository,
    private readonly classRepo: IClassRepository,
    private readonly planRepo: ISubscriptionPlanRepository,
  ) {}

  async selectFree(
    managerUserId: string,
    academyId: string,
  ): Promise<ManagerSubscriptionRow> {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);
    const existing = await this.subRepo.findByAcademyId(academyId);
    if (existing) {
      throw new HttpError(409, "Academy already has a subscription");
    }
    return this.subRepo.create({
      academyId,
      plan: "free",
      status: "active",
    });
  }

  async getSubscription(
    academyId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    return this.subRepo.findByAcademyId(academyId);
  }

  async getLimits(academyId: string) {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub) {
      throw new HttpError(404, "No subscription found");
    }

    const isFree = sub.plan === "free";
    const isBlocked =
      (sub.status === "past_due" || sub.status === "canceled") &&
      sub.stripeSubscriptionId !== null;

    if (isBlocked) {
      // Check if they can downgrade to free
      const canDowngrade = await this.canDowngradeToFree(academyId);
      return {
        plan: sub.plan,
        students: { used: 0, limit: isFree ? FREE_STUDENT_LIMIT : null },
        plans: { used: 0, limit: isFree ? FREE_PLAN_LIMIT : null },
        schedulesPerDay: {
          maxUsed: 0,
          limit: isFree ? FREE_DAILY_SCHEDULE_LIMIT : null,
        },
        instructors: { allowed: !isFree },
        blocked: !canDowngrade,
      };
    }

    const activeStudents = await this.countActiveStudents(academyId);
    const activePlans = await this.countActivePlans(academyId);
    const maxClassesPerDay = await this.maxClassesPerDay(academyId);

    return {
      plan: sub.plan,
      students: {
        used: activeStudents,
        limit: isFree ? FREE_STUDENT_LIMIT : null,
      },
      plans: { used: activePlans, limit: isFree ? FREE_PLAN_LIMIT : null },
      schedulesPerDay: {
        maxUsed: maxClassesPerDay,
        limit: isFree ? FREE_DAILY_SCHEDULE_LIMIT : null,
      },
      instructors: { allowed: !isFree },
      blocked: false,
    };
  }

  async canApproveStudent(academyId: string): Promise<void> {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub || sub.plan !== "free") return;

    const count = await this.countActiveStudents(academyId);
    if (count >= FREE_STUDENT_LIMIT) {
      throw new HttpError(
        403,
        `Você atingiu o limite de ${FREE_STUDENT_LIMIT} alunos do plano gratuito. Faça upgrade para o Pro.`,
      );
    }
  }

  async canApproveInstructor(academyId: string): Promise<void> {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub || sub.plan !== "free") return;

    throw new HttpError(
      403,
      "No plano gratuito não é possível cadastrar instrutores. Faça upgrade para o Pro.",
    );
  }

  async canCreatePlan(academyId: string): Promise<void> {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub || sub.plan !== "free") return;

    const count = await this.countActivePlans(academyId);
    if (count >= FREE_PLAN_LIMIT) {
      throw new HttpError(
        403,
        "No plano gratuito você pode criar apenas 1 plano de assinatura. Faça upgrade para o Pro.",
      );
    }
  }

  async canCreateClass(academyId: string, dayOfWeek: number): Promise<void> {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub || sub.plan !== "free") return;

    const classes = await this.classRepo.findByAcademyId(academyId, {
      dayOfWeek,
      includeInactive: false,
    });
    if (classes.length >= FREE_DAILY_SCHEDULE_LIMIT) {
      throw new HttpError(
        403,
        `No plano gratuito você pode ter no máximo ${FREE_DAILY_SCHEDULE_LIMIT} horários por dia. Faça upgrade para o Pro.`,
      );
    }
  }

  async assertNotBlocked(academyId: string): Promise<void> {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub) {
      throw new HttpError(403, "Nenhuma assinatura encontrada. Selecione um plano.");
    }
    if (sub.status === "active" || sub.status === "incomplete") return;

    // past_due or canceled — check if was ever Pro
    if (sub.stripeSubscriptionId !== null) {
      const canDowngrade = await this.canDowngradeToFree(academyId);
      if (!canDowngrade) {
        const msg =
          sub.status === "past_due"
            ? "Seu pagamento está atrasado. Atualize seus dados de pagamento para continuar usando o app."
            : "Sua assinatura foi cancelada. Reative o plano Pro para continuar usando o app.";
        throw new HttpError(403, msg);
      }
    }
  }

  // --- private helpers ---

  private async countActiveStudents(academyId: string): Promise<number> {
    const members = await this.memRepo.findByAcademy(academyId, {
      role: "student",
      status: "active",
    });
    return members.length;
  }

  private async countActivePlans(academyId: string): Promise<number> {
    const plans = await this.planRepo.findByAcademy(academyId, {
      includeInactive: false,
    });
    return plans.length;
  }

  private async maxClassesPerDay(academyId: string): Promise<number> {
    let max = 0;
    for (let day = 0; day <= 6; day++) {
      const classes = await this.classRepo.findByAcademyId(academyId, {
        dayOfWeek: day,
        includeInactive: false,
      });
      if (classes.length > max) max = classes.length;
    }
    return max;
  }

  private async canDowngradeToFree(academyId: string): Promise<boolean> {
    const students = await this.countActiveStudents(academyId);
    if (students > FREE_STUDENT_LIMIT) return false;

    const plans = await this.countActivePlans(academyId);
    if (plans > FREE_PLAN_LIMIT) return false;

    const instructors = await this.memRepo.findByAcademy(academyId, {
      role: "instructor",
      status: "active",
    });
    if (instructors.length > 0) return false;

    for (let day = 0; day <= 6; day++) {
      const classes = await this.classRepo.findByAcademyId(academyId, {
        dayOfWeek: day,
        includeInactive: false,
      });
      if (classes.length > FREE_DAILY_SCHEDULE_LIMIT) return false;
    }

    return true;
  }

  private async assertManagerOwnsAcademy(
    userId: string,
    academyId: string,
  ): Promise<void> {
    const academy = await this.acadRepo.findById(academyId);
    if (!academy) throw new HttpError(404, "Academy not found");
    if (academy.ownerId !== userId) throw new HttpError(403, "Forbidden");
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test -- --run src/modules/manager-subscription/manager-subscription.service.test.ts`

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/manager-subscription/manager-subscription.service.ts apps/api/src/modules/manager-subscription/manager-subscription.service.test.ts
git commit -m "feat: add manager subscription service with plan enforcement (TDD)"
```

---

## Task 6: Create Stripe webhook handler

**Files:**
- Create: `apps/api/src/modules/manager-subscription/stripe-webhook.handler.ts`

- [x] **Step 1: Create webhook handler**

Create `apps/api/src/modules/manager-subscription/stripe-webhook.handler.ts`:

```typescript
import type Stripe from "stripe";
import type { IManagerSubscriptionRepository } from "./manager-subscription.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { IClassRepository } from "../class/class.repository.js";
import type { ISubscriptionPlanRepository } from "../subscription/subscription.repository.js";

const FREE_STUDENT_LIMIT = 50;
const FREE_PLAN_LIMIT = 1;
const FREE_DAILY_SCHEDULE_LIMIT = 2;

export class StripeWebhookHandler {
  constructor(
    private readonly subRepo: IManagerSubscriptionRepository,
    private readonly memRepo: IMembershipRepository,
    private readonly classRepo: IClassRepository,
    private readonly planRepo: ISubscriptionPlanRepository,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "customer.subscription.created":
        await this.onSubscriptionCreated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "customer.subscription.updated":
        await this.onSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "customer.subscription.deleted":
        await this.onSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "invoice.paid":
        await this.onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await this.onInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
        );
        break;
    }
  }

  private async onSubscriptionCreated(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof stripeSub.customer === "string"
        ? stripeSub.customer
        : stripeSub.customer.id;

    const row = await this.subRepo.findByStripeCustomerId(customerId);
    if (!row) return;

    await this.subRepo.update(row.id, {
      plan: "pro",
      status: "active",
      stripeSubscriptionId: stripeSub.id,
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
    });
  }

  private async onSubscriptionUpdated(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    const row = await this.subRepo.findByStripeSubscriptionId(stripeSub.id);
    if (!row) return;

    const statusMap: Record<string, "active" | "past_due" | "canceled" | "incomplete"> = {
      active: "active",
      past_due: "past_due",
      canceled: "canceled",
      incomplete: "incomplete",
      incomplete_expired: "canceled",
      trialing: "active",
      unpaid: "past_due",
      paused: "past_due",
    };

    const newStatus = statusMap[stripeSub.status] ?? "active";

    await this.subRepo.update(row.id, {
      status: newStatus,
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      canceledAt: stripeSub.canceled_at
        ? new Date(stripeSub.canceled_at * 1000)
        : null,
    });
  }

  private async onSubscriptionDeleted(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    const row = await this.subRepo.findByStripeSubscriptionId(stripeSub.id);
    if (!row) return;

    const canDowngrade = await this.canDowngradeToFree(row.academyId);
    if (canDowngrade) {
      await this.subRepo.update(row.id, {
        plan: "free",
        status: "active",
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        canceledAt: null,
      });
    } else {
      await this.subRepo.update(row.id, {
        status: "canceled",
        canceledAt: new Date(),
      });
    }
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;
    if (!subId) return;

    const row = await this.subRepo.findByStripeSubscriptionId(subId);
    if (!row) return;

    await this.subRepo.update(row.id, { status: "active" });
  }

  private async onInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    const subId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;
    if (!subId) return;

    const row = await this.subRepo.findByStripeSubscriptionId(subId);
    if (!row) return;

    await this.subRepo.update(row.id, { status: "past_due" });
  }

  private async canDowngradeToFree(academyId: string): Promise<boolean> {
    const students = await this.memRepo.findByAcademy(academyId, {
      role: "student",
      status: "active",
    });
    if (students.length > FREE_STUDENT_LIMIT) return false;

    const plans = await this.planRepo.findByAcademy(academyId, {
      includeInactive: false,
    });
    if (plans.length > FREE_PLAN_LIMIT) return false;

    const instructors = await this.memRepo.findByAcademy(academyId, {
      role: "instructor",
      status: "active",
    });
    if (instructors.length > 0) return false;

    for (let day = 0; day <= 6; day++) {
      const classes = await this.classRepo.findByAcademyId(academyId, {
        dayOfWeek: day,
        includeInactive: false,
      });
      if (classes.length > FREE_DAILY_SCHEDULE_LIMIT) return false;
    }

    return true;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/manager-subscription/stripe-webhook.handler.ts
git commit -m "feat: add Stripe webhook handler for subscription lifecycle events"
```

---

## Task 7: Create API routes and middleware

**Files:**
- Create: `apps/api/src/middleware/require-active-plan.ts`
- Create: `apps/api/src/middleware/require-plan-feature.ts`
- Create: `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts`
- Modify: `apps/api/src/router.ts`
- Modify: `apps/api/src/app.ts`

- [x] **Step 1: Create requireActivePlan middleware**

Create `apps/api/src/middleware/require-active-plan.ts`:

```typescript
import type { NextFunction, Request, Response } from "express";
import { getDb } from "../lib/db.js";
import { PostgresManagerSubscriptionRepository } from "../modules/manager-subscription/manager-subscription.repository.postgres.js";

const subRepo = new PostgresManagerSubscriptionRepository(getDb());

export function requireActivePlan(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  void (async () => {
    const academyId = req.appAuth?.activeAcademyId;
    if (!academyId) {
      next();
      return;
    }

    // Only enforce for managers
    if (req.appAuth?.role !== "manager") {
      next();
      return;
    }

    try {
      const sub = await subRepo.findByAcademyId(academyId);
      if (!sub) {
        res.status(403).json({
          error: "Nenhuma assinatura encontrada. Selecione um plano.",
          code: "NO_SUBSCRIPTION",
        });
        return;
      }

      if (sub.status === "active" || sub.status === "incomplete") {
        req.appAuth = {
          ...req.appAuth!,
          managerPlan: sub.plan,
          managerSubscriptionStatus: sub.status,
        };
        next();
        return;
      }

      // past_due or canceled
      res.status(403).json({
        error:
          sub.status === "past_due"
            ? "Seu pagamento está atrasado. Atualize seus dados de pagamento para continuar usando o app."
            : "Sua assinatura foi cancelada. Reative o plano Pro para continuar usando o app.",
        code: "SUBSCRIPTION_BLOCKED",
      });
    } catch (e) {
      next(e);
    }
  })();
}
```

- [x] **Step 2: Create requirePlanFeature middleware**

Create `apps/api/src/middleware/require-plan-feature.ts`:

```typescript
import type { NextFunction, Request, Response } from "express";

export type PlanFeature =
  | "approve_student"
  | "approve_instructor"
  | "create_plan"
  | "create_class";

export function requirePlanFeature(feature: PlanFeature) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const plan = req.appAuth?.managerPlan;

    // If not a manager or plan not loaded, skip (other middleware handles this)
    if (!plan || plan === "pro") {
      next();
      return;
    }

    // Free plan — feature check is handled by the service layer
    // This middleware just attaches the plan; actual limit checks happen in service
    next();
  };
}
```

- [x] **Step 3: Create routes**

Create `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts`:

```typescript
import { Router } from "express";
import { loadEnv } from "@tatame/config";
import { Role } from "@tatame/types";
import { authorize } from "../../middleware/authorize.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { getDb } from "../../lib/db.js";
import { getStripe } from "../../lib/stripe.js";
import { HttpError } from "../../lib/http-error.js";
import { PostgresManagerSubscriptionRepository } from "./manager-subscription.repository.postgres.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresClassRepository } from "../class/class.repository.postgres.js";
import { PostgresSubscriptionPlanRepository } from "../subscription/subscription.repository.postgres.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { ManagerSubscriptionService } from "./manager-subscription.service.js";
import { StripeWebhookHandler } from "./stripe-webhook.handler.js";

const db = getDb();
const subRepo = new PostgresManagerSubscriptionRepository(db);
const acadRepo = new PostgresAcademyRepository(db);
const memRepo = new PostgresMembershipRepository(db);
const classRepo = new PostgresClassRepository(db);
const planRepo = new PostgresSubscriptionPlanRepository(db);

const service = new ManagerSubscriptionService(
  subRepo,
  acadRepo,
  memRepo,
  classRepo,
  planRepo,
);

const webhookHandler = new StripeWebhookHandler(
  subRepo,
  memRepo,
  classRepo,
  planRepo,
);

export const managerSubscriptionRouter = Router();

// POST /manager-subscriptions/free
managerSubscriptionRouter.post(
  "/free",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const result = await service.selectFree(
        req.appAuth!.userId,
        req.appAuth!.activeAcademyId!,
      );
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  },
);

// POST /manager-subscriptions/pro
managerSubscriptionRouter.post(
  "/pro",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRO_PRICE_ID) {
        throw new HttpError(503, "Stripe is not configured");
      }

      const stripe = getStripe();
      const academyId = req.appAuth!.activeAcademyId!;
      const userId = req.appAuth!.userId;

      // Get or create subscription row
      let sub = await service.getSubscription(academyId);

      // Create Stripe Customer if needed
      let stripeCustomerId = sub?.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          metadata: { academyId, userId },
        });
        stripeCustomerId = customer.id;

        if (sub) {
          await subRepo.update(sub.id, { stripeCustomerId });
        } else {
          sub = await subRepo.create({
            academyId,
            plan: "free",
            status: "incomplete",
            stripeCustomerId,
          });
        }
      }

      // Create Stripe Subscription
      const stripeSub = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: env.STRIPE_PRO_PRICE_ID }],
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
      });

      const invoice = stripeSub.latest_invoice as Stripe.Invoice;
      const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

      await subRepo.update(sub!.id, {
        stripeSubscriptionId: stripeSub.id,
        status: "incomplete",
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        subscriptionId: stripeSub.id,
      });
    } catch (e) {
      next(e);
    }
  },
);

// GET /manager-subscriptions/me
managerSubscriptionRouter.get(
  "/me",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const sub = await service.getSubscription(
        req.appAuth!.activeAcademyId!,
      );
      if (!sub) {
        res.status(404).json({ error: "No subscription found" });
        return;
      }
      res.json(sub);
    } catch (e) {
      next(e);
    }
  },
);

// GET /manager-subscriptions/limits
managerSubscriptionRouter.get(
  "/limits",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const limits = await service.getLimits(req.appAuth!.activeAcademyId!);
      res.json(limits);
    } catch (e) {
      next(e);
    }
  },
);

// POST /manager-subscriptions/portal
managerSubscriptionRouter.post(
  "/portal",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const env = loadEnv();
      const stripe = getStripe();
      const sub = await service.getSubscription(
        req.appAuth!.activeAcademyId!,
      );
      if (!sub?.stripeCustomerId) {
        throw new HttpError(400, "No Stripe customer found");
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: env.API_PUBLIC_URL ?? "tatame://finances",
      });

      res.json({ url: session.url });
    } catch (e) {
      next(e);
    }
  },
);

// POST /manager-subscriptions/reactivate
managerSubscriptionRouter.post(
  "/reactivate",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRO_PRICE_ID) {
        throw new HttpError(503, "Stripe is not configured");
      }

      const stripe = getStripe();
      const academyId = req.appAuth!.activeAcademyId!;
      const sub = await service.getSubscription(academyId);

      if (!sub) {
        throw new HttpError(404, "No subscription found");
      }
      if (sub.status === "active") {
        throw new HttpError(409, "Subscription is already active");
      }

      let stripeCustomerId = sub.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          metadata: { academyId, userId: req.appAuth!.userId },
        });
        stripeCustomerId = customer.id;
        await subRepo.update(sub.id, { stripeCustomerId });
      }

      const stripeSub = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: env.STRIPE_PRO_PRICE_ID }],
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
      });

      const invoice = stripeSub.latest_invoice as Stripe.Invoice;
      const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

      await subRepo.update(sub.id, {
        stripeSubscriptionId: stripeSub.id,
        status: "incomplete",
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        subscriptionId: stripeSub.id,
      });
    } catch (e) {
      next(e);
    }
  },
);

// Webhook route — exported separately, needs raw body
export function createWebhookRouter() {
  const webhookRouter = Router();

  webhookRouter.post("/stripe", async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.STRIPE_WEBHOOK_SECRET) {
        throw new HttpError(503, "Stripe webhook secret not configured");
      }

      const stripe = getStripe();
      const sig = req.headers["stripe-signature"];
      if (!sig) {
        res.status(400).json({ error: "Missing stripe-signature header" });
        return;
      }

      const event = stripe.webhooks.constructEvent(
        (req as any).rawBody,
        sig,
        env.STRIPE_WEBHOOK_SECRET,
      );

      await webhookHandler.handleEvent(event);
      res.json({ received: true });
    } catch (e) {
      if (e instanceof Error && e.message.includes("signature")) {
        res.status(400).json({ error: "Invalid webhook signature" });
        return;
      }
      next(e);
    }
  });

  return webhookRouter;
}
```

- [x] **Step 4: Register routes in router.ts**

In `apps/api/src/router.ts`, add import:

```typescript
import { managerSubscriptionRouter } from "./modules/manager-subscription/manager-subscription.routes.js";
```

Add route registration:

```typescript
apiRouter.use("/manager-subscriptions", managerSubscriptionRouter);
```

- [x] **Step 5: Add raw body parsing and webhook route in app.ts**

In `apps/api/src/app.ts`, add import:

```typescript
import { createWebhookRouter } from "./modules/manager-subscription/manager-subscription.routes.js";
```

Add raw body middleware BEFORE `express.json()`:

```typescript
app.use(
  "/v1/webhooks",
  express.raw({ type: "application/json" }),
  (req, _res, next) => {
    (req as any).rawBody = req.body;
    req.body = JSON.parse(req.body.toString());
    next();
  },
);
```

Add webhook router AFTER the raw body middleware and BEFORE the main `/v1` router:

```typescript
app.use("/v1/webhooks", createWebhookRouter());
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/middleware/require-active-plan.ts apps/api/src/middleware/require-plan-feature.ts apps/api/src/modules/manager-subscription/manager-subscription.routes.ts apps/api/src/router.ts apps/api/src/app.ts
git commit -m "feat: add manager subscription API routes, webhook handler, and plan enforcement middleware"
```

---

## Task 8: Wire plan enforcement into existing routes

**Files:**
- Modify: `apps/api/src/modules/membership/membership.routes.ts`
- Modify: `apps/api/src/modules/subscription/subscription.routes.ts`
- Modify: `apps/api/src/modules/class/class.routes.ts`

- [x] **Step 1: Add plan check to membership approve route**

In `apps/api/src/modules/membership/membership.routes.ts`, add import at the top:

```typescript
import { getDb } from "../../lib/db.js";
import { PostgresManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.postgres.js";
import { PostgresClassRepository } from "../class/class.repository.postgres.js";
import { PostgresSubscriptionPlanRepository } from "../subscription/subscription.repository.postgres.js";
import { ManagerSubscriptionService } from "../manager-subscription/manager-subscription.service.js";
```

Add service instantiation (after existing service setup):

```typescript
const managerSubService = new ManagerSubscriptionService(
  new PostgresManagerSubscriptionRepository(getDb()),
  new PostgresAcademyRepository(getDb()),
  membershipRepo,
  new PostgresClassRepository(getDb()),
  new PostgresSubscriptionPlanRepository(getDb()),
);
```

In the approve handler, add plan check BEFORE calling `membershipService.approve()`:

```typescript
// Check plan limits before approval
const pending = await membershipRepo.findById(params.data.membershipId);
if (pending && req.appAuth?.role === "manager") {
  if (pending.role === "instructor") {
    await managerSubService.canApproveInstructor(req.appAuth!.activeAcademyId!);
  } else if (pending.role === "student") {
    await managerSubService.canApproveStudent(req.appAuth!.activeAcademyId!);
  }
}
```

- [x] **Step 2: Add plan check to subscription plan creation**

In `apps/api/src/modules/subscription/subscription.routes.ts`, add similar imports and service instantiation, then add in the `POST /plans` handler BEFORE `subscriptionService.createPlan()`:

```typescript
if (req.appAuth?.role === "manager") {
  await managerSubService.canCreatePlan(req.appAuth!.activeAcademyId!);
}
```

- [x] **Step 3: Add plan check to class creation**

In `apps/api/src/modules/class/class.routes.ts`, add similar imports and service instantiation, then add in the `POST /` handler BEFORE `classService.create()`:

```typescript
if (req.appAuth?.role === "manager") {
  const body = req.validatedBody as CreateClassBody;
  await managerSubService.canCreateClass(req.appAuth!.activeAcademyId!, body.dayOfWeek);
}
```

- [x] **Step 4: Verify build**

Run: `pnpm --filter api build`

Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/membership/membership.routes.ts apps/api/src/modules/subscription/subscription.routes.ts apps/api/src/modules/class/class.routes.ts
git commit -m "feat: wire plan enforcement checks into membership, subscription, and class routes"
```

---

## Task 9: Create mobile hooks for manager subscription

**Files:**
- Create: `apps/mobile/lib/hooks/use-manager-subscription.ts`

- [x] **Step 1: Create the hooks file**

Create `apps/mobile/lib/hooks/use-manager-subscription.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

type ManagerSubscription = {
  id: string;
  academyId: string;
  plan: "free" | "pro";
  status: "active" | "past_due" | "canceled" | "incomplete";
  stripeCustomerId: string | null;
  currentPeriodEnd: string | null;
  subscribedAt: string;
  canceledAt: string | null;
};

type ManagerLimits = {
  plan: "free" | "pro";
  students: { used: number; limit: number | null };
  plans: { used: number; limit: number | null };
  schedulesPerDay: { maxUsed: number; limit: number | null };
  instructors: { allowed: boolean };
  blocked: boolean;
};

type StripeCheckoutResponse = {
  clientSecret: string;
  subscriptionId: string;
};

type StripePortalResponse = {
  url: string;
};

export function useManagerSubscription() {
  const api = useApi();

  return useQuery({
    queryKey: ["manager-subscription"],
    queryFn: () => api.get<ManagerSubscription>("/manager-subscriptions/me"),
    retry: false,
  });
}

export function useManagerLimits() {
  const api = useApi();

  return useQuery({
    queryKey: ["manager-limits"],
    queryFn: () => api.get<ManagerLimits>("/manager-subscriptions/limits"),
  });
}

export function useSelectFreePlan() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<ManagerSubscription>("/manager-subscriptions/free"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
      queryClient.invalidateQueries({ queryKey: ["user/me"] });
    },
  });
}

export function useStartProSubscription() {
  const api = useApi();

  return useMutation({
    mutationFn: () =>
      api.post<StripeCheckoutResponse>("/manager-subscriptions/pro"),
  });
}

export function useReactivateSubscription() {
  const api = useApi();

  return useMutation({
    mutationFn: () =>
      api.post<StripeCheckoutResponse>("/manager-subscriptions/reactivate"),
  });
}

export function useStripePortal() {
  const api = useApi();

  return useMutation({
    mutationFn: () =>
      api.post<StripePortalResponse>("/manager-subscriptions/portal"),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/lib/hooks/use-manager-subscription.ts
git commit -m "feat: add React Query hooks for manager subscription"
```

---

## Task 10: Install Stripe React Native SDK

**Files:**
- Modify: `apps/mobile/package.json`

- [x] **Step 1: Install @stripe/stripe-react-native**

Run: `pnpm --filter mobile add @stripe/stripe-react-native`

- [x] **Step 2: Verify Expo compatibility**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/mobile && npx expo install --check`

Expected: No critical incompatibilities

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat: install @stripe/stripe-react-native"
```

---

## Task 11: Build plan selection gate screen

> **Pencil design reference:** Node `moPBD` (M-MGR-02: Choose Plan). Use `mcp__pencil__get_screenshot` and `mcp__pencil__batch_get` with nodeId `moPBD` to inspect the exact design.

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/plan-selection.tsx`
- Modify: `apps/mobile/app/(app)/_layout.tsx`

- [x] **Step 1: Create the plan selection screen**

Create `apps/mobile/app/(app)/(manager)/plan-selection.tsx`. This screen follows the design in Pencil node `moPBD`:
- Header: "Escolha seu plano" + subtitle
- Free card: R$ 0/mês, features list, "Começar grátis" button
- Pro card: R$ 49/mês with "MAIS POPULAR" badge, features list, select button → Stripe Payment Sheet
- No back button, cannot be skipped

```typescript
import {
  useManagerSubscription,
  useSelectFreePlan,
  useStartProSubscription,
} from "@/lib/hooks/use-manager-subscription";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";
import { useQueryClient } from "@tanstack/react-query";

function FeatureItem({ text }: { text: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 8 }}>
      <Check size={16} color="#32D74B" />
      <Text className="font-poppins text-sm text-primary">{text}</Text>
    </View>
  );
}

export default function PlanSelectionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const selectFree = useSelectFreePlan();
  const startPro = useStartProSubscription();
  const [loading, setLoading] = useState(false);

  async function handleSelectFree() {
    try {
      await selectFree.mutateAsync();
      router.replace("/(app)/(manager)/(home)");
    } catch {
      Alert.alert("Erro", "Não foi possível selecionar o plano gratuito.");
    }
  }

  async function handleSelectPro() {
    setLoading(true);
    try {
      const { clientSecret } = await startPro.mutateAsync();

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "Tatame",
      });
      if (initError) {
        Alert.alert("Erro", initError.message);
        setLoading(false);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== "Canceled") {
          Alert.alert("Erro", presentError.message);
        }
        setLoading(false);
        return;
      }

      // Payment succeeded — invalidate and navigate
      await queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      await queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
      await queryClient.invalidateQueries({ queryKey: ["user/me"] });
      router.replace("/(app)/(manager)/(home)");
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar a assinatura Pro.");
    } finally {
      setLoading(false);
    }
  }

  const isLoading = selectFree.isPending || loading;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: 40,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 8 }}>
          <Text className="font-poppins-bold text-2xl text-primary">
            Escolha seu plano
          </Text>
          <Text className="font-poppins text-sm" style={{ color: "#ABABAB" }}>
            Selecione o plano ideal para sua academia e comece agora
          </Text>
        </View>

        {/* Free Plan Card */}
        <View
          className="rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 20, gap: 16 }}
        >
          <View style={{ gap: 4 }}>
            <Text className="font-poppins-bold text-lg text-primary">
              Gratuito
            </Text>
            <Text className="font-poppins text-xs" style={{ color: "#ABABAB" }}>
              Para academias começando no digital
            </Text>
          </View>
          <View className="flex-row items-baseline" style={{ gap: 4 }}>
            <Text className="font-poppins-bold text-3xl text-primary">
              R$ 0
            </Text>
            <Text className="font-poppins text-sm" style={{ color: "#ABABAB" }}>
              /mês
            </Text>
          </View>
          <View style={{ gap: 10 }}>
            <FeatureItem text="Até 50 alunos" />
            <FeatureItem text="Agenda de aulas" />
            <FeatureItem text="Check-in de alunos" />
            <FeatureItem text="Controle de graduações" />
          </View>
          <Pressable
            onPress={handleSelectFree}
            disabled={isLoading}
            className="items-center rounded-xl bg-white"
            style={{ paddingVertical: 14 }}
          >
            {selectFree.isPending ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="font-poppins-semibold text-sm text-black">
                Começar grátis
              </Text>
            )}
          </Pressable>
        </View>

        {/* Pro Plan Card */}
        <View
          className="rounded-2xl border-2 bg-surface"
          style={{ padding: 20, gap: 16, borderColor: "#A078E8" }}
        >
          <View
            className="self-start rounded-full"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              backgroundColor: "#A078E8",
            }}
          >
            <Text className="font-poppins-bold text-[10px] text-white">
              MAIS POPULAR
            </Text>
          </View>
          <View style={{ gap: 4 }}>
            <Text className="font-poppins-bold text-lg text-primary">Pro</Text>
            <Text className="font-poppins text-xs" style={{ color: "#ABABAB" }}>
              Para academias que querem crescer
            </Text>
          </View>
          <View className="flex-row items-baseline" style={{ gap: 4 }}>
            <Text className="font-poppins-bold text-3xl text-primary">
              R$ 49
            </Text>
            <Text className="font-poppins text-sm" style={{ color: "#ABABAB" }}>
              /mês
            </Text>
          </View>
          <View style={{ gap: 10 }}>
            <FeatureItem text="Alunos ilimitados" />
            <FeatureItem text="Tudo do plano Gratuito" />
            <FeatureItem text="Dashboard web completo" />
          </View>
          <Pressable
            onPress={handleSelectPro}
            disabled={isLoading}
            className="items-center rounded-xl"
            style={{ paddingVertical: 14, backgroundColor: "#A078E8" }}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text className="font-poppins-semibold text-sm text-white">
                Assinar Pro
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Add subscription gate to app layout**

In `apps/mobile/app/(app)/_layout.tsx`, add import:

```typescript
import { useManagerSubscription } from "@/lib/hooks/use-manager-subscription";
```

In the `AppRouter` component, after the existing user checks for manager with academy (line 34), add subscription gate:

```typescript
} else if (user.activeRole === "manager" && user.activeAcademy) {
  // Check if manager has a subscription
  const sub = await ... // This needs to be a hook-based check
```

Actually, the gate should be done differently since we can't use async in the effect. Instead, modify the effect block for manager with academy:

Replace line 34-35:
```typescript
} else if (user.activeRole === "manager" && user.activeAcademy) {
  router.replace("/(app)/(manager)/(home)");
```

With:
```typescript
} else if (user.activeRole === "manager" && user.activeAcademy) {
  // Subscription gate is handled in the (manager) layout
  router.replace("/(app)/(manager)/(home)");
```

The actual gate will be in the manager `_layout.tsx` — see Task 12.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/plan-selection.tsx
git commit -m "feat: add plan selection gate screen (M-MGR-02, Pencil node moPBD)"
```

---

## Task 12: Add subscription gate to manager layout

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/_layout.tsx`

- [x] **Step 1: Add subscription gate to manager layout**

In `apps/mobile/app/(app)/(manager)/_layout.tsx`, wrap the existing layout with a subscription check:

```typescript
import { Tabs, useRouter } from "expo-router";
import { Calendar, CreditCard, Home, Users } from "lucide-react-native";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useManagerSubscription } from "@/lib/hooks/use-manager-subscription";

export default function ManagerLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: subscription, isPending, isError } = useManagerSubscription();

  useEffect(() => {
    if (isPending) return;
    // If no subscription found (404), redirect to plan selection
    if (isError || !subscription) {
      router.replace("/(app)/(manager)/plan-selection");
    }
  }, [isPending, isError, subscription, router]);

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  if (isError || !subscription) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: "#0C0C0C",
        },
        tabBarStyle: {
          backgroundColor: "#1A1A1A",
          borderTopColor: "#2A2A2A",
          borderTopWidth: 1,
          height: 56 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#A078E8",
        tabBarInactiveTintColor: "#ABABAB",
        tabBarLabelStyle: {
          fontFamily: "Poppins_500Medium",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(members)"
        options={{
          title: "Membros",
          href: "/(app)/(manager)/(members)",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(classes)"
        options={{
          title: "Aulas",
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(finances)"
        options={{
          title: "Finanças",
          href: "/(app)/(manager)/(finances)",
          tabBarIcon: ({ color, size }) => (
            <CreditCard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan-selection"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/_layout.tsx
git commit -m "feat: add subscription gate to manager layout — redirects to plan selection if no subscription"
```

---

## Task 13: Build plan details and update financial overview screens

> **Pencil design references:**
> - Node `vqoDI` (M-MGR-18: Plan Details) — use `mcp__pencil__get_screenshot` and `mcp__pencil__batch_get` with nodeId `vqoDI`
> - Node `3sIUB` (M-MGR-17: Financial Overview) — use `mcp__pencil__get_screenshot` and `mcp__pencil__batch_get` with nodeId `3sIUB`

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(finances)/my-plan.tsx`
- Modify: `apps/mobile/app/(app)/(manager)/(finances)/index.tsx`

- [ ] **Step 1: Create the plan details screen**

Create `apps/mobile/app/(app)/(manager)/(finances)/my-plan.tsx`. This screen follows the design in Pencil node `vqoDI`:
- Current plan card with badge and price
- Next billing date and subscriber since date
- "Alterar plano" link → navigates to plan-selection
- Payment history (Stripe invoices)
- "Cancelar assinatura" → opens Stripe Customer Portal

```typescript
import { BackButton } from "@/components/BackButton";
import {
  useManagerSubscription,
  useStripePortal,
} from "@/lib/hooks/use-manager-subscription";
import { useRouter } from "expo-router";
import { Calendar, ChevronRight, CreditCard, XCircle } from "lucide-react-native";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";

function formatDate(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function MyPlanScreen() {
  const router = useRouter();
  const { data: sub } = useManagerSubscription();
  const portal = useStripePortal();

  const isPro = sub?.plan === "pro";
  const planLabel = isPro ? "Pro" : "Gratuito";
  const planPrice = isPro ? "R$ 49" : "R$ 0";

  async function handleOpenPortal() {
    try {
      const { url } = await portal.mutateAsync();
      await Linking.openURL(url);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o portal de pagamento.");
    }
  }

  function handleChangePlan() {
    router.push("/(app)/(manager)/plan-selection");
  }

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 40,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="flex-row items-center gap-3"
          style={{ minHeight: 62, paddingTop: 8 }}
        >
          <BackButton />
          <Text className="flex-1 text-center font-poppins-bold text-lg text-primary">
            Meu Plano
          </Text>
          <View className="h-10 w-10" />
        </View>

        {/* Current Plan Card */}
        <View
          className="rounded-2xl border bg-surface"
          style={{
            padding: 20,
            gap: 12,
            borderColor: isPro ? "#A078E8" : "#2A2A2A",
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <Text className="font-poppins-semibold text-base text-primary">
                Plano atual
              </Text>
              <View
                className="rounded-full"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 2,
                  backgroundColor: isPro ? "#A078E8" : "#32D74B",
                }}
              >
                <Text className="font-poppins-bold text-[10px] text-white">
                  {isPro ? "PRO" : "FREE"}
                </Text>
              </View>
            </View>
            <View className="flex-row items-baseline" style={{ gap: 2 }}>
              <Text className="font-poppins-bold text-xl text-primary">
                {planPrice}
              </Text>
              <Text
                className="font-poppins text-xs"
                style={{ color: TEXT_SECONDARY }}
              >
                /mês
              </Text>
            </View>
          </View>

          {isPro && sub?.currentPeriodEnd && (
            <View style={{ gap: 6 }}>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Calendar size={14} color={TEXT_SECONDARY} />
                <Text
                  className="font-poppins text-xs"
                  style={{ color: TEXT_SECONDARY }}
                >
                  Próxima cobrança em {formatDate(sub.currentPeriodEnd)}
                </Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Calendar size={14} color={TEXT_SECONDARY} />
                <Text
                  className="font-poppins text-xs"
                  style={{ color: TEXT_SECONDARY }}
                >
                  Assinante desde {formatDate(sub.subscribedAt)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Change Plan */}
        <Pressable
          onPress={handleChangePlan}
          className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 16 }}
        >
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <CreditCard size={18} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-sm text-primary">
              Alterar plano
            </Text>
          </View>
          <ChevronRight size={18} color={TEXT_SECONDARY} />
        </Pressable>

        {/* Cancel Subscription (Pro only) */}
        {isPro && (
          <Pressable
            onPress={handleOpenPortal}
            className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 16 }}
          >
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <XCircle size={18} color="#FF453A" />
              <Text
                className="font-poppins-semibold text-sm"
                style={{ color: "#FF453A" }}
              >
                Cancelar assinatura
              </Text>
            </View>
            <ChevronRight size={18} color={TEXT_SECONDARY} />
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Add "Plano atual" card to financial overview**

In `apps/mobile/app/(app)/(manager)/(finances)/index.tsx`, add import:

```typescript
import { useManagerSubscription } from "@/lib/hooks/use-manager-subscription";
import { Crown } from "lucide-react-native";
```

Add the hook call inside the component:

```typescript
const { data: subscription } = useManagerSubscription();
```

Add the "Plano atual" card JSX after the "Membros ativos" card (after line 162) and before the "Ações rápidas" text. This card follows Pencil node `3sIUB`:

```tsx
{/* Plano atual card */}
<Pressable
  onPress={() => router.push("/(app)/(manager)/(finances)/my-plan")}
  className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
  style={{ padding: 14 }}
>
  <View style={{ gap: 4 }}>
    <View className="flex-row items-center" style={{ gap: 8 }}>
      <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
        Plano atual
      </Text>
      <View
        className="rounded-full"
        style={{
          paddingHorizontal: 8,
          paddingVertical: 2,
          backgroundColor:
            subscription?.plan === "pro" ? "#A078E8" : "#32D74B",
        }}
      >
        <Text className="font-poppins-bold text-[9px] text-white">
          {subscription?.plan === "pro" ? "PRO" : "FREE"}
        </Text>
      </View>
    </View>
    <Text className="font-poppins-bold text-lg text-primary">
      {subscription?.plan === "pro" ? "R$ 49" : "R$ 0"}
      <Text
        className="font-poppins text-sm"
        style={{ color: TEXT_SECONDARY }}
      >
        {" "}/mês
      </Text>
    </Text>
    {subscription?.currentPeriodEnd && (
      <Text
        className="font-poppins text-[11px]"
        style={{ color: TEXT_SECONDARY }}
      >
        Próxima cobrança: {formatDate(subscription.currentPeriodEnd)}
      </Text>
    )}
  </View>
  <View
    className="items-center justify-center rounded-lg"
    style={{
      width: 40,
      height: 40,
      backgroundColor: "#A078E820",
    }}
  >
    <Crown size={20} color="#A078E8" />
  </View>
</Pressable>
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(finances)/my-plan.tsx apps/mobile/app/(app)/(manager)/(finances)/index.tsx
git commit -m "feat: add plan details screen (M-MGR-18, Pencil node vqoDI) and plan card to financial overview (Pencil node 3sIUB)"
```

---

## Task Completion Summary

After completing all tasks, run:

```bash
pnpm --filter api build && pnpm --filter api test -- --run
```

Expected: Build succeeds and all tests pass.
