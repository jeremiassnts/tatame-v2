# Manager Financial Screens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete financial management module for the manager role — subscription plans CRUD, student subscriptions browsing, payment confirmation, and a financial dashboard.

**Architecture:** Backend-first — extend existing subscription/payment modules with new repository methods, service layer, routes, and validators. Then build mobile hooks and screens following the existing Expo Router / NativeWind / React Query patterns. Each task produces a working, testable increment.

**Tech Stack:** Express + Drizzle ORM (API), React Native + Expo Router + NativeWind + React Query + React Hook Form + Zod (mobile), Vitest + Supertest (tests)

### Linear tracking

| Task | Linear |
|------|--------|
| 1 | [TAT-14](https://linear.app/tatame/issue/TAT-14/manager-finances-task-1-extend-validators-for-new-query-schemas) |
| 2 | [TAT-15](https://linear.app/tatame/issue/TAT-15/manager-finances-task-2-extend-subscription-repository-with-academy) |
| 3 | [TAT-16](https://linear.app/tatame/issue/TAT-16/manager-finances-task-3-extend-payment-repository-with-limit-and-user) |
| 4 | [TAT-17](https://linear.app/tatame/issue/TAT-17/manager-finances-task-4-add-subscription-service-methods-and-routes) |
| 5 | [TAT-18](https://linear.app/tatame/issue/TAT-18/manager-finances-task-5-create-finance-summary-endpoint) |
| 6 | [TAT-19](https://linear.app/tatame/issue/TAT-19/manager-finances-task-6-add-integration-tests-for-new-endpoints) |
| 7 | [TAT-20](https://linear.app/tatame/issue/TAT-20/manager-finances-task-7-create-mobile-hooks) |
| 8 | [TAT-21](https://linear.app/tatame/issue/TAT-21/manager-finances-task-8-create-finances-layout-and-add-tab) |
| 9 | [TAT-22](https://linear.app/tatame/issue/TAT-22/manager-finances-task-9-plans-list-screen-m-mgr-10) |
| 10 | [TAT-23](https://linear.app/tatame/issue/TAT-23/manager-finances-task-10-plan-detail-screen-m-mgr-11) |
| 11 | [TAT-24](https://linear.app/tatame/issue/TAT-24/manager-finances-task-11-create-and-edit-plan-screens-m-mgr-12) |
| 12 | [TAT-25](https://linear.app/tatame/issue/TAT-25/manager-finances-task-12-subscriptions-list-screen-m-mgr-13) |
| 13 | [TAT-26](https://linear.app/tatame/issue/TAT-26/manager-finances-task-13-subscription-detail-screen-m-mgr-14) |
| 14 | [TAT-27](https://linear.app/tatame/issue/TAT-27/manager-finances-task-14-confirm-payment-screen) |
| 15 | [TAT-28](https://linear.app/tatame/issue/TAT-28/manager-finances-task-15-financial-dashboard-screen-m-mgr-17) |
| 16 | [TAT-29](https://linear.app/tatame/issue/TAT-29/manager-finances-task-16-verify-full-build-and-run-tests) |

Issues are linked with **blocked by** in Linear following task order (1 → 2 → … → 16), except Task 3 also waits on Task 2.

---

## File Map

### API (backend)

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/validators/src/subscription.schema.ts` | Modify | Add `listAcademySubscriptionsQuerySchema` |
| `packages/validators/src/payment.schema.ts` | Modify | Add `limit` to `listPaymentsQuerySchema` |
| `packages/validators/src/index.ts` | Modify | Export new schemas |
| `apps/api/src/modules/subscription/subscription.repository.ts` | Modify | Add `listByAcademy`, `findByIdForManager` interfaces |
| `apps/api/src/modules/subscription/subscription.repository.postgres.ts` | Modify | Implement new queries with user+plan+payment joins |
| `apps/api/src/modules/subscription/subscription.repository.in-memory.ts` | Modify | Add stubs for new interface methods |
| `apps/api/src/modules/subscription/subscription.service.ts` | Modify | Add `listAcademySubscriptions`, `getAcademySubscription` |
| `apps/api/src/modules/subscription/subscription.service.test.ts` | Modify | Add unit tests for new service methods |
| `apps/api/src/modules/subscription/subscription.routes.ts` | Modify | Add `GET /academy`, `GET /academy/:subscriptionId` |
| `apps/api/src/modules/payment/payment.repository.ts` | Modify | Add `limit` to `findByAcademy`, add `findByAcademyWithUser` |
| `apps/api/src/modules/payment/payment.repository.postgres.ts` | Modify | Implement with limit + user join |
| `apps/api/src/modules/finance/finance.service.ts` | Create | `getFinancialSummary` method |
| `apps/api/src/modules/finance/finance.routes.ts` | Create | `GET /finances/summary` |
| `apps/api/src/router.ts` | Modify | Register `financeRouter` |
| `apps/api/src/subscription-payment.integration.test.ts` | Modify | Add tests for new endpoints |

### Mobile (frontend)

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/mobile/lib/hooks/use-subscription-plans.ts` | Create | Plans CRUD hooks |
| `apps/mobile/lib/hooks/use-academy-subscriptions.ts` | Create | Academy subscription list/detail hooks |
| `apps/mobile/lib/hooks/use-finances.ts` | Create | Summary, payment history, confirm payment hooks |
| `apps/mobile/app/(app)/(manager)/(finances)/_layout.tsx` | Create | Stack navigator for finances group |
| `apps/mobile/app/(app)/(manager)/(finances)/index.tsx` | Create | Dashboard screen (M-MGR-17) |
| `apps/mobile/app/(app)/(manager)/(finances)/plans/index.tsx` | Create | Plans list screen (M-MGR-10) |
| `apps/mobile/app/(app)/(manager)/(finances)/plans/[planId].tsx` | Create | Plan detail screen (M-MGR-11) |
| `apps/mobile/app/(app)/(manager)/(finances)/plans/create.tsx` | Create | Create plan form (M-MGR-12) |
| `apps/mobile/app/(app)/(manager)/(finances)/plans/edit/[planId].tsx` | Create | Edit plan form (M-MGR-12) |
| `apps/mobile/app/(app)/(manager)/(finances)/subscriptions/index.tsx` | Create | Subscriptions list screen (M-MGR-13) |
| `apps/mobile/app/(app)/(manager)/(finances)/subscriptions/[subscriptionId].tsx` | Create | Subscription detail screen (M-MGR-14) |
| `apps/mobile/app/(app)/(manager)/(finances)/confirm-payment.tsx` | Create | Confirm payment form (new) |
| `apps/mobile/app/(app)/(manager)/_layout.tsx` | Modify | Add Finanças tab |

---

## Task 1: Extend validators for new query schemas

**Linear:** [TAT-14](https://linear.app/tatame/issue/TAT-14/manager-finances-task-1-extend-validators-for-new-query-schemas)

**Files:**
- Modify: `packages/validators/src/subscription.schema.ts`
- Modify: `packages/validators/src/payment.schema.ts`
- Modify: `packages/validators/src/index.ts`

- [x] **Step 1: Add academy subscriptions query schema**

In `packages/validators/src/subscription.schema.ts`, add at the end of the file:

```typescript
export const listAcademySubscriptionsQuerySchema = z.object({
  status: z.enum(["active", "expired", "cancelled"]).optional(),
  planId: z.string().uuid().optional(),
  pendingPayment: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type ListAcademySubscriptionsQuery = z.infer<
  typeof listAcademySubscriptionsQuerySchema
>;

export const subscriptionIdParamSchema = z.object({
  subscriptionId: z.string().uuid(),
});
```

- [x] **Step 2: Add limit to payments query schema**

In `packages/validators/src/payment.schema.ts`, replace `listPaymentsQuerySchema`:

```typescript
export const listPaymentsQuerySchema = z.object({
  subscriptionId: z.string().uuid().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(1).max(100).optional()),
});
```

- [x] **Step 3: Export new schemas from index**

In `packages/validators/src/index.ts`, update the subscription export block:

```typescript
export {
  createSubscriptionPlanBodySchema,
  listAcademySubscriptionsQuerySchema,
  listPlansQuerySchema,
  planIdParamSchema,
  recurrenceMonthsSchema,
  selectStudentPlanBodySchema,
  subscriptionIdParamSchema,
  updateSubscriptionPlanBodySchema,
  type CreateSubscriptionPlanBody,
  type ListAcademySubscriptionsQuery,
  type SelectStudentPlanBody,
  type UpdateSubscriptionPlanBody,
} from "./subscription.schema.js";
```

- [x] **Step 4: Build validators package**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo build --filter=@tatame/validators`
Expected: build succeeds

- [x] **Step 5: Commit**

```bash
git add packages/validators/src/subscription.schema.ts packages/validators/src/payment.schema.ts packages/validators/src/index.ts
git commit -m "feat(validators): add academy subscriptions query and limit schemas"
```

---

## Task 2: Extend subscription repository with academy-level queries

**Linear:** [TAT-15](https://linear.app/tatame/issue/TAT-15/manager-finances-task-2-extend-subscription-repository-with-academy)

**Files:**
- Modify: `apps/api/src/modules/subscription/subscription.repository.ts`
- Modify: `apps/api/src/modules/subscription/subscription.repository.postgres.ts`
- Modify: `apps/api/src/modules/subscription/subscription.repository.in-memory.ts`

- [x] **Step 1: Add types and interface methods to repository.ts**

In `apps/api/src/modules/subscription/subscription.repository.ts`, add after the existing `StudentSubscriptionWithPlan` type:

```typescript
export type AcademySubscriptionItem = {
  subscription: StudentSubscriptionRow;
  plan: SubscriptionPlanRow;
  user: { id: string; name: string; email: string; profileImageUrl: string | null };
  lastPayment: {
    referenceMonth: string;
    paidAt: Date;
    amountCents: number;
  } | null;
};
```

Add to the `IStudentSubscriptionRepository` interface:

```typescript
  listByAcademy(
    academyId: string,
    opts: { status?: string; planId?: string },
  ): Promise<AcademySubscriptionItem[]>;

  findByIdForManager(
    subscriptionId: string,
    academyId: string,
  ): Promise<AcademySubscriptionItem | undefined>;
```

- [x] **Step 2: Implement listByAcademy in postgres repository**

In `apps/api/src/modules/subscription/subscription.repository.postgres.ts`, add the import for `users` and `payments` tables at the top:

```typescript
import {
  studentSubscriptions,
  subscriptionPlans,
  users,
  payments,
  type Database,
} from "@tatame/db";
```

Then add the `listByAcademy` method to `PostgresStudentSubscriptionRepository`:

```typescript
  async listByAcademy(
    academyId: string,
    opts: { status?: string; planId?: string },
  ): Promise<AcademySubscriptionItem[]> {
    const conditions = [eq(subscriptionPlans.academyId, academyId)];
    if (opts.status) {
      conditions.push(
        eq(studentSubscriptions.status, opts.status as "active" | "expired" | "cancelled"),
      );
    }
    if (opts.planId) {
      conditions.push(eq(studentSubscriptions.planId, opts.planId));
    }

    const rows = await this.db
      .select({
        subscription: studentSubscriptions,
        plan: subscriptionPlans,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(studentSubscriptions)
      .innerJoin(subscriptionPlans, eq(studentSubscriptions.planId, subscriptionPlans.id))
      .innerJoin(users, eq(studentSubscriptions.userId, users.id))
      .where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      .orderBy(desc(studentSubscriptions.createdAt));

    const subIds = rows.map((r) => r.subscription.id);
    const lastPayments = subIds.length > 0
      ? await this.db
          .selectDistinctOn([payments.subscriptionId], {
            subscriptionId: payments.subscriptionId,
            referenceMonth: payments.referenceMonth,
            paidAt: payments.paidAt,
            amountCents: payments.amountCents,
          })
          .from(payments)
          .where(inArray(payments.subscriptionId, subIds))
          .orderBy(payments.subscriptionId, desc(payments.paidAt))
      : [];

    const paymentMap = new Map(lastPayments.map((p) => [p.subscriptionId, p]));

    return rows.map((r) => {
      const lp = paymentMap.get(r.subscription.id);
      return {
        subscription: r.subscription,
        plan: r.plan,
        user: r.user,
        lastPayment: lp
          ? { referenceMonth: lp.referenceMonth, paidAt: lp.paidAt, amountCents: lp.amountCents }
          : null,
      };
    });
  }
```

- [x] **Step 3: Implement findByIdForManager in postgres repository**

Add to `PostgresStudentSubscriptionRepository`:

```typescript
  async findByIdForManager(
    subscriptionId: string,
    academyId: string,
  ): Promise<AcademySubscriptionItem | undefined> {
    const [row] = await this.db
      .select({
        subscription: studentSubscriptions,
        plan: subscriptionPlans,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(studentSubscriptions)
      .innerJoin(subscriptionPlans, eq(studentSubscriptions.planId, subscriptionPlans.id))
      .innerJoin(users, eq(studentSubscriptions.userId, users.id))
      .where(
        and(
          eq(studentSubscriptions.id, subscriptionId),
          eq(subscriptionPlans.academyId, academyId),
        ),
      )
      .limit(1);

    if (!row) return undefined;

    const lastPayments = await this.db
      .select({
        referenceMonth: payments.referenceMonth,
        paidAt: payments.paidAt,
        amountCents: payments.amountCents,
      })
      .from(payments)
      .where(eq(payments.subscriptionId, subscriptionId))
      .orderBy(desc(payments.paidAt))
      .limit(1);

    return {
      subscription: row.subscription,
      plan: row.plan,
      user: row.user,
      lastPayment: lastPayments[0]
        ? {
            referenceMonth: lastPayments[0].referenceMonth,
            paidAt: lastPayments[0].paidAt,
            amountCents: lastPayments[0].amountCents,
          }
        : null,
    };
  }
```

- [x] **Step 4: Add stubs to in-memory repository**

In `apps/api/src/modules/subscription/subscription.repository.in-memory.ts`, add to the in-memory class:

```typescript
  async listByAcademy(
    _academyId: string,
    _opts: { status?: string; planId?: string },
  ): Promise<AcademySubscriptionItem[]> {
    return [];
  }

  async findByIdForManager(
    _subscriptionId: string,
    _academyId: string,
  ): Promise<AcademySubscriptionItem | undefined> {
    return undefined;
  }
```

Make sure to import the `AcademySubscriptionItem` type.

- [x] **Step 5: Verify API compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo build --filter=@tatame/api`
Expected: build succeeds

- [x] **Step 6: Commit**

```bash
git add apps/api/src/modules/subscription/
git commit -m "feat(api): add academy-level subscription repository queries"
```

---

## Task 3: Extend payment repository with limit and user join

**Linear:** [TAT-16](https://linear.app/tatame/issue/TAT-16/manager-finances-task-3-extend-payment-repository-with-limit-and-user)

**Files:**
- Modify: `apps/api/src/modules/payment/payment.repository.ts`
- Modify: `apps/api/src/modules/payment/payment.repository.postgres.ts`

- [x] **Step 1: Update interface with limit option and new method**

In `apps/api/src/modules/payment/payment.repository.ts`, update `findByAcademy` signature and add a new type and method:

```typescript
export type PaymentWithUser = PaymentRow & {
  userName: string;
};

export interface IPaymentRepository {
  create(data: {
    subscriptionId: string;
    userId: string;
    academyId: string;
    amountCents: number;
    method: "manual";
    confirmedBy: string;
    referenceMonth: string;
    notes: string | null;
    paidAt: Date;
  }): Promise<PaymentRow>;

  findByAcademy(
    academyId: string,
    opts: { subscriptionId?: string; userId?: string; limit?: number },
  ): Promise<PaymentRow[]>;

  findByAcademyWithUser(
    academyId: string,
    opts: { limit?: number },
  ): Promise<PaymentWithUser[]>;

  existsForSubscriptionReferenceMonth(
    subscriptionId: string,
    referenceMonth: string,
  ): Promise<boolean>;

  sumByAcademyForMonth(
    academyId: string,
    referenceMonth: string,
  ): Promise<number>;
}
```

- [x] **Step 2: Implement in postgres repository**

In `apps/api/src/modules/payment/payment.repository.postgres.ts`, add `users` import:

```typescript
import { and, desc, eq, sum, sql } from "drizzle-orm";
import { payments, users, type Database } from "@tatame/db";
```

Update `findByAcademy` to support `limit`:

```typescript
  async findByAcademy(
    academyId: string,
    opts: { subscriptionId?: string; userId?: string; limit?: number },
  ): Promise<PaymentRow[]> {
    const conditions = [eq(payments.academyId, academyId)];
    if (opts.subscriptionId) {
      conditions.push(eq(payments.subscriptionId, opts.subscriptionId));
    }
    if (opts.userId) {
      conditions.push(eq(payments.userId, opts.userId));
    }
    const whereClause =
      conditions.length === 1 ? conditions[0]! : and(...conditions);
    const query = this.db
      .select()
      .from(payments)
      .where(whereClause)
      .orderBy(desc(payments.paidAt));
    if (opts.limit) {
      return query.limit(opts.limit);
    }
    return query;
  }
```

Add `findByAcademyWithUser`:

```typescript
  async findByAcademyWithUser(
    academyId: string,
    opts: { limit?: number },
  ): Promise<PaymentWithUser[]> {
    const query = this.db
      .select({
        id: payments.id,
        subscriptionId: payments.subscriptionId,
        userId: payments.userId,
        academyId: payments.academyId,
        amountCents: payments.amountCents,
        method: payments.method,
        confirmedBy: payments.confirmedBy,
        stripePaymentId: payments.stripePaymentId,
        referenceMonth: payments.referenceMonth,
        notes: payments.notes,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        userName: users.name,
      })
      .from(payments)
      .innerJoin(users, eq(payments.userId, users.id))
      .where(eq(payments.academyId, academyId))
      .orderBy(desc(payments.paidAt));
    if (opts.limit) {
      return query.limit(opts.limit);
    }
    return query;
  }
```

Add `sumByAcademyForMonth`:

```typescript
  async sumByAcademyForMonth(
    academyId: string,
    referenceMonth: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(payments.amountCents) })
      .from(payments)
      .where(
        and(
          eq(payments.academyId, academyId),
          eq(payments.referenceMonth, referenceMonth),
        ),
      );
    return Number(row?.total ?? 0);
  }
```

- [x] **Step 3: Update payment service to pass limit**

In `apps/api/src/modules/payment/payment.service.ts`, update `listForManager`:

```typescript
  async listForManager(
    managerUserId: string,
    academyId: string,
    opts: { subscriptionId?: string; limit?: number },
  ): Promise<PaymentRow[]> {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);
    return this.paymentRepo.findByAcademy(academyId, {
      subscriptionId: opts.subscriptionId,
      limit: opts.limit,
    });
  }
```

- [x] **Step 4: Update payment route to pass limit**

In `apps/api/src/modules/payment/payment.routes.ts`, update the GET `/` handler to pass limit:

```typescript
      const items = await paymentService.listForManager(
        managerUserId,
        academyId,
        { subscriptionId: query.data.subscriptionId, limit: query.data.limit },
      );
```

- [x] **Step 5: Verify API compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo build --filter=@tatame/api`
Expected: build succeeds

- [x] **Step 6: Commit**

```bash
git add apps/api/src/modules/payment/ packages/validators/src/payment.schema.ts
git commit -m "feat(api): add limit to payments list and payment-with-user query"
```

---

## Task 4: Add subscription service methods and routes for academy-level access

**Linear:** [TAT-17](https://linear.app/tatame/issue/TAT-17/manager-finances-task-4-add-subscription-service-methods-and-routes)

**Files:**
- Modify: `apps/api/src/modules/subscription/subscription.service.ts`
- Modify: `apps/api/src/modules/subscription/subscription.routes.ts`

- [x] **Step 1: Add service methods**

In `apps/api/src/modules/subscription/subscription.service.ts`, add these imports at the top:

```typescript
import type { AcademySubscriptionItem } from "./subscription.repository.js";
```

Add two new methods to the `SubscriptionService` class:

```typescript
  async listAcademySubscriptions(
    managerUserId: string,
    academyId: string,
    opts: { status?: string; planId?: string; pendingPayment?: boolean },
  ): Promise<
    (AcademySubscriptionItem & {
      effectiveStatus: "active" | "expired" | "cancelled";
      hasPaidCurrentMonth: boolean;
    })[]
  > {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);

    const items = await this.studentSubRepo.listByAcademy(academyId, {
      status: opts.status,
      planId: opts.planId,
    });

    const today = utcTodayDateString();
    const currentMonth = today.slice(0, 7) + "-01";

    const enriched = items.map((item) => {
      const expiredByDate = isExpiredByDate(item.subscription.expiresAt, today);
      let effectiveStatus: "active" | "expired" | "cancelled" = item.subscription.status as "active" | "expired" | "cancelled";
      if (item.subscription.status === "active" && expiredByDate) {
        effectiveStatus = "expired";
      }
      const hasPaidCurrentMonth =
        item.lastPayment?.referenceMonth === currentMonth;
      return { ...item, effectiveStatus, hasPaidCurrentMonth };
    });

    if (opts.pendingPayment) {
      return enriched.filter(
        (e) => e.effectiveStatus === "active" && !e.hasPaidCurrentMonth,
      );
    }

    return enriched;
  }

  async getAcademySubscription(
    managerUserId: string,
    academyId: string,
    subscriptionId: string,
  ): Promise<
    AcademySubscriptionItem & {
      effectiveStatus: "active" | "expired" | "cancelled";
      hasPaidCurrentMonth: boolean;
    }
  > {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);

    const item = await this.studentSubRepo.findByIdForManager(
      subscriptionId,
      academyId,
    );
    if (!item) {
      throw new HttpError(404, "Subscription not found");
    }

    const today = utcTodayDateString();
    const currentMonth = today.slice(0, 7) + "-01";
    const expiredByDate = isExpiredByDate(item.subscription.expiresAt, today);
    let effectiveStatus: "active" | "expired" | "cancelled" = item.subscription.status as "active" | "expired" | "cancelled";
    if (item.subscription.status === "active" && expiredByDate) {
      effectiveStatus = "expired";
    }
    const hasPaidCurrentMonth =
      item.lastPayment?.referenceMonth === currentMonth;

    return { ...item, effectiveStatus, hasPaidCurrentMonth };
  }
```

- [x] **Step 2: Add routes**

In `apps/api/src/modules/subscription/subscription.routes.ts`, add the new imports at the top:

```typescript
import type { ListAcademySubscriptionsQuery } from "@tatame/validators";
import {
  createSubscriptionPlanBodySchema,
  listAcademySubscriptionsQuerySchema,
  listPlansQuerySchema,
  planIdParamSchema,
  selectStudentPlanBodySchema,
  subscriptionIdParamSchema,
  updateSubscriptionPlanBodySchema,
} from "@tatame/validators";
```

Add these two routes after the existing `/me` route:

```typescript
subscriptionRouter.get(
  "/academy",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const query = listAcademySubscriptionsQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Invalid query");
      }
      const managerUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const items = await subscriptionService.listAcademySubscriptions(
        managerUserId,
        academyId,
        {
          status: query.data.status,
          planId: query.data.planId,
          pendingPayment: query.data.pendingPayment,
        },
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

subscriptionRouter.get(
  "/academy/:subscriptionId",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const params = subscriptionIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid subscription id");
      }
      const managerUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const item = await subscriptionService.getAcademySubscription(
        managerUserId,
        academyId,
        params.data.subscriptionId,
      );
      res.json(item);
    } catch (e) {
      next(e);
    }
  },
);
```

**IMPORTANT:** These routes must be placed BEFORE the `/me/plan` POST route. Express matches routes top-down, so `/academy` must come before `/:param` patterns. Currently there are no `/:param` patterns at the subscription router root level, so placing after `/me` is fine.

- [x] **Step 3: Verify API compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo build --filter=@tatame/api`
Expected: build succeeds

- [x] **Step 4: Commit**

```bash
git add apps/api/src/modules/subscription/
git commit -m "feat(api): add academy-level subscription list and detail endpoints"
```

---

## Task 5: Create finance summary endpoint

**Linear:** [TAT-18](https://linear.app/tatame/issue/TAT-18/manager-finances-task-5-create-finance-summary-endpoint)

**Files:**
- Create: `apps/api/src/modules/finance/finance.service.ts`
- Create: `apps/api/src/modules/finance/finance.routes.ts`
- Modify: `apps/api/src/router.ts`

- [x] **Step 1: Create finance service**

Create `apps/api/src/modules/finance/finance.service.ts`:

```typescript
import { HttpError } from "../../lib/http-error.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IPaymentRepository } from "../payment/payment.repository.js";
import type { IStudentSubscriptionRepository } from "../subscription/subscription.repository.js";

export type FinancialSummary = {
  revenueCurrentMonth: number;
  revenuePreviousMonth: number;
  pendingPaymentsCount: number;
  pendingPaymentsTotal: number;
  activeSubscriptionsCount: number;
};

function currentAndPreviousMonth(): {
  currentMonth: string;
  previousMonth: string;
} {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const currentMonth = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const prevDate = new Date(Date.UTC(y, m - 1, 1));
  const previousMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return { currentMonth, previousMonth };
}

export class FinanceService {
  constructor(
    private readonly paymentRepo: IPaymentRepository,
    private readonly studentSubRepo: IStudentSubscriptionRepository,
    private readonly academyRepo: IAcademyRepository,
  ) {}

  async getSummary(
    managerUserId: string,
    academyId: string,
  ): Promise<FinancialSummary> {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);

    const { currentMonth, previousMonth } = currentAndPreviousMonth();

    const [revenueCurrentMonth, revenuePreviousMonth, allSubs] =
      await Promise.all([
        this.paymentRepo.sumByAcademyForMonth(academyId, currentMonth),
        this.paymentRepo.sumByAcademyForMonth(academyId, previousMonth),
        this.studentSubRepo.listByAcademy(academyId, { status: "active" }),
      ]);

    const today = new Date().toISOString().slice(0, 10);
    const activeSubs = allSubs.filter(
      (s) => s.subscription.expiresAt >= today,
    );

    const pendingSubs = activeSubs.filter(
      (s) => s.lastPayment?.referenceMonth !== currentMonth,
    );

    return {
      revenueCurrentMonth,
      revenuePreviousMonth,
      pendingPaymentsCount: pendingSubs.length,
      pendingPaymentsTotal: pendingSubs.reduce(
        (sum, s) => sum + s.plan.priceCents,
        0,
      ),
      activeSubscriptionsCount: activeSubs.length,
    };
  }

  private async assertManagerOwnsAcademy(userId: string, academyId: string) {
    const academy = await this.academyRepo.findById(academyId);
    if (!academy) {
      throw new HttpError(404, "Academy not found");
    }
    if (academy.ownerId !== userId) {
      throw new HttpError(403, "You do not manage this academy");
    }
  }
}
```

- [x] **Step 2: Create finance routes**

Create `apps/api/src/modules/finance/finance.routes.ts`:

```typescript
import { Router } from "express";
import { Role } from "@tatame/types";
import { getDb } from "../../lib/db.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { PostgresPaymentRepository } from "../payment/payment.repository.postgres.js";
import { PostgresStudentSubscriptionRepository } from "../subscription/subscription.repository.postgres.js";
import { FinanceService } from "./finance.service.js";

export const financeRouter = Router();

const db = getDb();
const financeService = new FinanceService(
  new PostgresPaymentRepository(db),
  new PostgresStudentSubscriptionRepository(db),
  new PostgresAcademyRepository(db),
);

financeRouter.get(
  "/summary",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const managerUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const summary = await financeService.getSummary(managerUserId, academyId);
      res.json(summary);
    } catch (e) {
      next(e);
    }
  },
);
```

- [x] **Step 3: Register finance router**

In `apps/api/src/router.ts`, add the import:

```typescript
import { financeRouter } from "./modules/finance/finance.routes.js";
```

And add the route after the payments line:

```typescript
apiRouter.use("/finances", financeRouter);
```

- [x] **Step 4: Verify API compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo build --filter=@tatame/api`
Expected: build succeeds

- [x] **Step 5: Commit**

```bash
git add apps/api/src/modules/finance/ apps/api/src/router.ts
git commit -m "feat(api): add financial summary endpoint"
```

---

## Task 6: Add integration tests for new endpoints

**Linear:** [TAT-19](https://linear.app/tatame/issue/TAT-19/manager-finances-task-6-add-integration-tests-for-new-endpoints)

**Files:**
- Modify: `apps/api/src/subscription-payment.integration.test.ts`

- [x] **Step 1: Add tests for academy subscription list and financial summary**

Add these test cases inside the existing `describe` block in `apps/api/src/subscription-payment.integration.test.ts`, after the existing test:

```typescript
  it("manager lists academy subscriptions and views detail", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Sub Dojo" });
    expect(ac.status).toBe(201);
    const academyId = ac.body.id as string;

    asClerkUser(CLERK_STUDENT);
    const join = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId });
    expect(join.status).toBe(201);

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${join.body.id}/approve`);

    const plan = await request(app).post("/v1/subscriptions/plans").send({
      name: "Monthly",
      recurrenceMonths: 1,
      priceCents: 15_000,
      weeklyCheckinLimit: null,
    });
    expect(plan.status).toBe(201);

    asClerkUser(CLERK_STUDENT);
    const enroll = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: plan.body.id });
    expect(enroll.status).toBe(201);
    const subscriptionId = enroll.body.subscription.id as string;

    asClerkUser(CLERK_MANAGER);

    const list = await request(app).get("/v1/subscriptions/academy");
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBe(1);
    expect(list.body.items[0].user.name).toBeTruthy();
    expect(list.body.items[0].plan.name).toBe("Monthly");
    expect(list.body.items[0].effectiveStatus).toBe("active");
    expect(list.body.items[0].hasPaidCurrentMonth).toBe(false);

    const detail = await request(app).get(
      `/v1/subscriptions/academy/${subscriptionId}`,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.subscription.id).toBe(subscriptionId);
    expect(detail.body.user.name).toBeTruthy();

    const pending = await request(app).get(
      "/v1/subscriptions/academy?pendingPayment=true",
    );
    expect(pending.status).toBe(200);
    expect(pending.body.items.length).toBe(1);
  });

  it("manager gets financial summary", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Finance Dojo" });
    expect(ac.status).toBe(201);

    asClerkUser(CLERK_STUDENT);
    const join = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId: ac.body.id });
    expect(join.status).toBe(201);

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${join.body.id}/approve`);

    const plan = await request(app).post("/v1/subscriptions/plans").send({
      name: "Basic",
      recurrenceMonths: 1,
      priceCents: 10_000,
      weeklyCheckinLimit: null,
    });

    asClerkUser(CLERK_STUDENT);
    const enroll = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: plan.body.id });

    asClerkUser(CLERK_MANAGER);
    await request(app).post("/v1/payments").send({
      subscriptionId: enroll.body.subscription.id,
      amountCents: 10_000,
      referenceMonth: utcMonthFirstIso(),
    });

    const summary = await request(app).get("/v1/finances/summary");
    expect(summary.status).toBe(200);
    expect(summary.body.revenueCurrentMonth).toBe(10_000);
    expect(summary.body.activeSubscriptionsCount).toBe(1);
    expect(summary.body.pendingPaymentsCount).toBe(0);
  });

  it("payments list supports limit param", async () => {
    await insertUserWithGlobalRole(ctx.db, CLERK_MANAGER, "manager");
    await insertUserWithGlobalRole(ctx.db, CLERK_STUDENT, "student");

    asClerkUser(CLERK_MANAGER);
    const ac = await request(app)
      .post("/v1/academies")
      .send({ name: "Limit Dojo" });

    asClerkUser(CLERK_STUDENT);
    const join = await request(app)
      .post("/v1/memberships/requests")
      .send({ academyId: ac.body.id });

    asClerkUser(CLERK_MANAGER);
    await request(app).patch(`/v1/memberships/${join.body.id}/approve`);

    const plan = await request(app).post("/v1/subscriptions/plans").send({
      name: "Limit Plan",
      recurrenceMonths: 1,
      priceCents: 5_000,
      weeklyCheckinLimit: null,
    });

    asClerkUser(CLERK_STUDENT);
    const enroll = await request(app)
      .post("/v1/subscriptions/me/plan")
      .send({ planId: plan.body.id });

    asClerkUser(CLERK_MANAGER);
    await request(app).post("/v1/payments").send({
      subscriptionId: enroll.body.subscription.id,
      amountCents: 5_000,
      referenceMonth: utcMonthFirstIso(),
    });
    await request(app).post("/v1/payments").send({
      subscriptionId: enroll.body.subscription.id,
      amountCents: 5_000,
      referenceMonth: "2026-02-01",
    });

    const limited = await request(app).get("/v1/payments?limit=1");
    expect(limited.status).toBe(200);
    expect(limited.body.items.length).toBe(1);

    const all = await request(app).get("/v1/payments");
    expect(all.status).toBe(200);
    expect(all.body.items.length).toBe(2);
  });
```

- [x] **Step 2: Run integration tests**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/api && npx vitest run src/subscription-payment.integration.test.ts`
Expected: all tests pass

- [x] **Step 3: Commit**

```bash
git add apps/api/src/subscription-payment.integration.test.ts
git commit -m "test(api): add integration tests for academy subscriptions and financial summary"
```

---

## Task 7: Create mobile hooks

**Linear:** [TAT-20](https://linear.app/tatame/issue/TAT-20/manager-finances-task-7-create-mobile-hooks)

**Files:**
- Create: `apps/mobile/lib/hooks/use-subscription-plans.ts`
- Create: `apps/mobile/lib/hooks/use-academy-subscriptions.ts`
- Create: `apps/mobile/lib/hooks/use-finances.ts`

- [x] **Step 1: Create subscription plans hooks**

Create `apps/mobile/lib/hooks/use-subscription-plans.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

type SubscriptionPlan = {
  id: string;
  academyId: string;
  name: string;
  recurrenceMonths: number;
  priceCents: number;
  weeklyCheckinLimit: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PlansResponse = { items: SubscriptionPlan[] };

export function useSubscriptionPlans() {
  const api = useApi();

  return useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () =>
      api.get<PlansResponse>("/subscriptions/plans?includeInactive=true"),
    select: (data) => data.items,
  });
}

export function useSubscriptionPlan(planId: string | undefined) {
  const api = useApi();

  return useQuery({
    queryKey: ["subscription-plans", planId],
    queryFn: () => api.get<SubscriptionPlan>(`/subscriptions/plans/${planId}`),
    enabled: !!planId,
  });
}

export function useCreatePlan() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      name: string;
      recurrenceMonths: number;
      priceCents: number;
      weeklyCheckinLimit: number | null;
    }) => api.post<SubscriptionPlan>("/subscriptions/plans", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
    },
  });
}

export function useUpdatePlan(planId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      name?: string;
      recurrenceMonths?: number;
      priceCents?: number;
      weeklyCheckinLimit?: number | null;
      isActive?: boolean;
    }) => api.patch<SubscriptionPlan>(`/subscriptions/plans/${planId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
    },
  });
}
```

- [x] **Step 2: Create academy subscriptions hooks**

Create `apps/mobile/lib/hooks/use-academy-subscriptions.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export type AcademySubscriptionItem = {
  subscription: {
    id: string;
    userId: string;
    planId: string;
    status: string;
    startsAt: string;
    expiresAt: string;
  };
  plan: {
    id: string;
    name: string;
    priceCents: number;
    recurrenceMonths: number;
    weeklyCheckinLimit: number | null;
    isActive: boolean;
  };
  user: {
    id: string;
    name: string;
    email: string;
    profileImageUrl: string | null;
  };
  lastPayment: {
    referenceMonth: string;
    paidAt: string;
    amountCents: number;
  } | null;
  effectiveStatus: "active" | "expired" | "cancelled";
  hasPaidCurrentMonth: boolean;
};

type AcademySubscriptionsResponse = { items: AcademySubscriptionItem[] };

export function useAcademySubscriptions(filter?: {
  status?: string;
  planId?: string;
  pendingPayment?: boolean;
}) {
  const api = useApi();

  const params = new URLSearchParams();
  if (filter?.status) params.set("status", filter.status);
  if (filter?.planId) params.set("planId", filter.planId);
  if (filter?.pendingPayment) params.set("pendingPayment", "true");
  const qs = params.toString();

  return useQuery({
    queryKey: ["academy-subscriptions", filter],
    queryFn: () =>
      api.get<AcademySubscriptionsResponse>(
        `/subscriptions/academy${qs ? `?${qs}` : ""}`,
      ),
    select: (data) => data.items,
  });
}

export function useAcademySubscription(subscriptionId: string | undefined) {
  const api = useApi();

  return useQuery({
    queryKey: ["academy-subscriptions", subscriptionId],
    queryFn: () =>
      api.get<AcademySubscriptionItem>(
        `/subscriptions/academy/${subscriptionId}`,
      ),
    enabled: !!subscriptionId,
  });
}
```

- [x] **Step 3: Create finances hooks**

Create `apps/mobile/lib/hooks/use-finances.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

type FinancialSummary = {
  revenueCurrentMonth: number;
  revenuePreviousMonth: number;
  pendingPaymentsCount: number;
  pendingPaymentsTotal: number;
  activeSubscriptionsCount: number;
};

type PaymentItem = {
  id: string;
  subscriptionId: string;
  userId: string;
  academyId: string;
  amountCents: number;
  method: string;
  confirmedBy: string | null;
  referenceMonth: string;
  notes: string | null;
  paidAt: string;
  createdAt: string;
  userName: string;
};

type PaymentsResponse = { items: PaymentItem[] };

export function useFinancialSummary() {
  const api = useApi();

  return useQuery({
    queryKey: ["financial-summary"],
    queryFn: () => api.get<FinancialSummary>("/finances/summary"),
  });
}

export function usePaymentHistory(opts?: {
  subscriptionId?: string;
  limit?: number;
}) {
  const api = useApi();

  const params = new URLSearchParams();
  if (opts?.subscriptionId) params.set("subscriptionId", opts.subscriptionId);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: ["payments", opts],
    queryFn: () =>
      api.get<PaymentsResponse>(`/payments${qs ? `?${qs}` : ""}`),
    select: (data) => data.items,
  });
}

export function useConfirmPayment() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      subscriptionId: string;
      amountCents: number;
      referenceMonth: string;
      notes?: string | null;
    }) => api.post("/payments", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["academy-subscriptions"] });
    },
  });
}
```

- [x] **Step 4: Commit**

```bash
git add apps/mobile/lib/hooks/use-subscription-plans.ts apps/mobile/lib/hooks/use-academy-subscriptions.ts apps/mobile/lib/hooks/use-finances.ts
git commit -m "feat(mobile): add hooks for subscription plans, academy subscriptions, and finances"
```

---

## Task 8: Create finances layout and add tab

**Linear:** [TAT-21](https://linear.app/tatame/issue/TAT-21/manager-finances-task-8-create-finances-layout-and-add-tab)

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(finances)/_layout.tsx`
- Modify: `apps/mobile/app/(app)/(manager)/_layout.tsx`

- [x] **Step 1: Create finances stack layout**

Create `apps/mobile/app/(app)/(manager)/(finances)/_layout.tsx`:

```typescript
import { Stack } from "expo-router";

export default function FinancesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0C0C0C" },
        animation: "slide_from_right",
      }}
    />
  );
}
```

- [x] **Step 2: Add Finanças tab to manager layout**

In `apps/mobile/app/(app)/(manager)/_layout.tsx`, add the `CreditCard` import and the new tab:

```typescript
import { Tabs } from "expo-router";
import { Calendar, CreditCard, Home, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ManagerLayout() {
  const insets = useSafeAreaInsets();

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
          title: "Home",
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
          tabBarIcon: ({ color, size }) => (
            <CreditCard size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [x] **Step 3: Create placeholder index screen to verify tab works**

Create `apps/mobile/app/(app)/(manager)/(finances)/index.tsx`:

```typescript
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FinancialDashboard() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-primary">Financeiro</Text>
      </View>
    </SafeAreaView>
  );
}
```

- [x] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(finances)/_layout.tsx apps/mobile/app/(app)/(manager)/(finances)/index.tsx apps/mobile/app/(app)/(manager)/_layout.tsx
git commit -m "feat(mobile): add finances tab and stack layout"
```

---

## Task 9: Plans list screen (M-MGR-10)

**Linear:** [TAT-22](https://linear.app/tatame/issue/TAT-22/manager-finances-task-9-plans-list-screen-m-mgr-10)

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(finances)/plans/index.tsx`

- [x] **Step 1: Create plans list screen**

Create `apps/mobile/app/(app)/(manager)/(finances)/plans/index.tsx`:

```typescript
import { useSubscriptionPlans } from "@/lib/hooks/use-subscription-plans";
import { useRouter } from "expo-router";
import { ArrowLeft, Plus } from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const RECURRENCE_LABELS: Record<number, string> = {
  1: "mês",
  3: "trimestre",
  6: "semestre",
  12: "ano",
};

const RECURRENCE_BADGE: Record<number, string> = {
  1: "1 mês",
  3: "3 meses",
  6: "6 meses",
  12: "12 meses",
};

function formatPrice(cents: number, recurrenceMonths: number): string {
  const reais = (cents / 100).toFixed(2).replace(".", ",");
  const suffix = RECURRENCE_LABELS[recurrenceMonths] ?? `${recurrenceMonths}m`;
  return `R$${reais}/${suffix}`;
}

export default function PlansListScreen() {
  const router = useRouter();
  const { data: plans, isPending } = useSubscriptionPlans();

  const activePlans = plans?.filter((p) => p.isActive) ?? [];

  if (isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">Planos</Text>
          <Pressable
            onPress={() =>
              router.push("/(app)/(manager)/(finances)/plans/create")
            }
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "#A078E8" }}
          >
            <Plus size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <Text
          className="font-poppins-medium text-[13px]"
          style={{ color: "#ABABAB", marginTop: 20 }}
        >
          {activePlans.length} planos ativos
        </Text>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingTop: 12, paddingBottom: 100 }}
        >
          {(plans ?? []).map((plan) => (
            <Pressable
              key={plan.id}
              onPress={() =>
                router.push(`/(app)/(manager)/(finances)/plans/${plan.id}`)
              }
              className="rounded-2xl border border-surface-border bg-surface"
              style={{ padding: 16, gap: 10 }}
            >
              <View className="flex-row items-center justify-between">
                <Text className="font-poppins-semibold text-base text-primary">
                  {plan.name}
                </Text>
                <View
                  className="rounded-full px-2.5 py-0.5"
                  style={{
                    backgroundColor: plan.isActive ? "#1A3A1A" : "#3A1A1A",
                  }}
                >
                  <Text
                    className="font-poppins-medium text-[10px]"
                    style={{
                      color: plan.isActive ? "#4ADE80" : "#F87171",
                    }}
                  >
                    {plan.isActive ? "Ativo" : "Inativo"}
                  </Text>
                </View>
              </View>

              <Text
                className="font-poppins-bold text-2xl text-primary"
              >
                {formatPrice(plan.priceCents, plan.recurrenceMonths)}
              </Text>

              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                <View className="rounded-full bg-background px-2.5 py-1">
                  <Text className="font-poppins text-[11px] text-muted">
                    {RECURRENCE_BADGE[plan.recurrenceMonths] ?? `${plan.recurrenceMonths} meses`}
                  </Text>
                </View>
                <View className="rounded-full bg-background px-2.5 py-1">
                  <Text className="font-poppins text-[11px] text-muted">
                    {plan.weeklyCheckinLimit
                      ? `${plan.weeklyCheckinLimit} check-ins/sem`
                      : "Ilimitado"}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Pressable
        onPress={() =>
          router.push("/(app)/(manager)/(finances)/plans/create")
        }
        className="absolute items-center justify-center rounded-full"
        style={{
          backgroundColor: "#A078E8",
          width: 56,
          height: 56,
          bottom: 30,
          right: 24,
        }}
      >
        <Plus size={22} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(finances)/plans/index.tsx
git commit -m "feat(mobile): add subscription plans list screen"
```

---

## Task 10: Plan detail screen (M-MGR-11)

**Linear:** [TAT-23](https://linear.app/tatame/issue/TAT-23/manager-finances-task-10-plan-detail-screen-m-mgr-11)

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(finances)/plans/[planId].tsx`

- [x] **Step 1: Create plan detail screen**

Create `apps/mobile/app/(app)/(manager)/(finances)/plans/[planId].tsx`:

```typescript
import { Avatar } from "@/components/Avatar";
import {
  useSubscriptionPlan,
  useUpdatePlan,
} from "@/lib/hooks/use-subscription-plans";
import { useAcademySubscriptions } from "@/lib/hooks/use-academy-subscriptions";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Pencil,
  RefreshCw,
  Repeat,
  Users,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";

const RECURRENCE_LABELS: Record<number, string> = {
  1: "/mês",
  3: "/trimestre",
  6: "/semestre",
  12: "/ano",
};

function formatCurrency(cents: number): string {
  return `R$${(cents / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function PlanDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();

  const { data: plan, isPending } = useSubscriptionPlan(planId);
  const { data: subscribers } = useAcademySubscriptions({
    planId,
    status: "active",
  });
  const updatePlan = useUpdatePlan(planId!);

  const handleToggleActive = () => {
    if (!plan) return;

    const action = plan.isActive ? "Desativar" : "Ativar";
    Alert.alert(
      `${action} plano`,
      `Deseja realmente ${action.toLowerCase()} o plano "${plan.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: action,
          style: plan.isActive ? "destructive" : "default",
          onPress: () => {
            updatePlan.mutate({ isActive: !plan.isActive });
          },
        },
      ],
    );
  };

  if (isPending || !plan) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const activeSubscribers = (subscribers ?? []).filter(
    (s) => s.effectiveStatus === "active",
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 24 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">
            Detalhes do plano
          </Text>
          <Pressable
            onPress={() =>
              router.push(`/(app)/(manager)/(finances)/plans/edit/${planId}`)
            }
            className="h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-surface"
          >
            <Pencil size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 24, paddingBottom: 24 }}
        >
          <View className="rounded-2xl border border-surface-border bg-surface p-5" style={{ gap: 16 }}>
            <View className="flex-row items-center justify-between">
              <Text className="font-poppins-bold text-xl text-primary">
                {plan.name}
              </Text>
              <View
                className="rounded-full px-2.5 py-0.5"
                style={{
                  backgroundColor: plan.isActive ? "#1A3A1A" : "#3A1A1A",
                }}
              >
                <Text
                  className="font-poppins-medium text-[10px]"
                  style={{
                    color: plan.isActive ? "#4ADE80" : "#F87171",
                  }}
                >
                  {plan.isActive ? "Ativo" : "Inativo"}
                </Text>
              </View>
            </View>

            <View className="flex-row items-end" style={{ gap: 4 }}>
              <Text className="font-poppins-bold text-3xl text-primary">
                {formatCurrency(plan.priceCents)}
              </Text>
              <Text
                className="font-poppins text-base"
                style={{ color: TEXT_SECONDARY, marginBottom: 2 }}
              >
                {RECURRENCE_LABELS[plan.recurrenceMonths] ?? `/${plan.recurrenceMonths}m`}
              </Text>
            </View>

            <View className="h-px" style={{ backgroundColor: "#2A2A2A" }} />

            <View className="flex-row flex-wrap" style={{ gap: 16 }}>
              <View style={{ gap: 2, minWidth: "40%" }}>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Repeat size={12} color={TEXT_MUTED} />
                  <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                    Recorrência
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-sm text-primary">
                  Mensal
                </Text>
              </View>
              <View style={{ gap: 2 }}>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <RefreshCw size={12} color={TEXT_MUTED} />
                  <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                    Check-ins/sem
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {plan.weeklyCheckinLimit ?? "Ilimitado"}
                </Text>
              </View>
              <View style={{ gap: 2, minWidth: "40%" }}>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Calendar size={12} color={TEXT_MUTED} />
                  <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                    Criado em
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {formatDate(plan.createdAt)}
                </Text>
              </View>
              <View style={{ gap: 2 }}>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Users size={12} color={TEXT_MUTED} />
                  <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                    Assinantes
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {activeSubscribers.length} ativos
                </Text>
              </View>
            </View>
          </View>

          <Text
            className="font-poppins-semibold text-sm"
            style={{ color: TEXT_SECONDARY }}
          >
            Assinantes ativos
          </Text>

          <View style={{ gap: 10 }}>
            {activeSubscribers.map((sub) => (
              <Pressable
                key={sub.subscription.id}
                onPress={() =>
                  router.push(
                    `/(app)/(manager)/(finances)/subscriptions/${sub.subscription.id}`,
                  )
                }
                className="flex-row items-center rounded-xl border border-surface-border bg-surface"
                style={{ padding: 12, paddingHorizontal: 14, gap: 12 }}
              >
                <Avatar
                  variant="user"
                  imageUrl={sub.user.profileImageUrl}
                  fallbackLetter={sub.user.name}
                  size={40}
                />
                <View className="flex-1" style={{ gap: 2 }}>
                  <Text className="font-poppins-semibold text-sm text-primary">
                    {sub.user.name}
                  </Text>
                  <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                    Expira em {formatDate(sub.subscription.expiresAt)}
                  </Text>
                </View>
                <View
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: "#4ADE80" }}
                />
              </Pressable>
            ))}
            {activeSubscribers.length === 0 && (
              <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                Nenhum assinante ativo
              </Text>
            )}
          </View>
        </ScrollView>

        <View style={{ paddingBottom: 24 }}>
          <Pressable
            onPress={handleToggleActive}
            disabled={updatePlan.isPending}
            className="flex-row items-center justify-center rounded-xl"
            style={{
              height: 52,
              gap: 8,
              backgroundColor: plan.isActive ? "#FF453A15" : "#32D74B15",
              borderWidth: 1,
              borderColor: plan.isActive ? "#FF453A40" : "#32D74B40",
            }}
          >
            <Text
              className="font-poppins-semibold text-[15px]"
              style={{ color: plan.isActive ? "#FF453A" : "#32D74B" }}
            >
              {plan.isActive ? "Desativar plano" : "Ativar plano"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(finances)/plans/\[planId\].tsx
git commit -m "feat(mobile): add subscription plan detail screen"
```

---

## Task 11: Create and edit plan screens (M-MGR-12)

**Linear:** [TAT-24](https://linear.app/tatame/issue/TAT-24/manager-finances-task-11-create-and-edit-plan-screens-m-mgr-12)

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(finances)/plans/create.tsx`
- Create: `apps/mobile/app/(app)/(manager)/(finances)/plans/edit/[planId].tsx`

- [x] **Step 1: Create plan form (create screen)**

Create `apps/mobile/app/(app)/(manager)/(finances)/plans/create.tsx`:

```typescript
import { FormInput } from "@/components/FormInput";
import { ModalSelect } from "@/components/ModalSelect";
import { ApiError } from "@/lib/api";
import { useCreatePlan } from "@/lib/hooks/use-subscription-plans";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  priceCents: z.string().min(1, "Valor é obrigatório"),
  recurrenceMonths: z.string(),
  weeklyCheckinLimit: z.string().optional(),
  unlimited: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const RECURRENCE_OPTIONS = [
  { value: "1", label: "1 mês" },
  { value: "3", label: "3 meses" },
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
];

export default function CreatePlanScreen() {
  const router = useRouter();
  const createPlan = useCreatePlan();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      priceCents: "",
      recurrenceMonths: "1",
      weeklyCheckinLimit: "",
      unlimited: false,
    },
  });

  const isUnlimited = watch("unlimited");

  const onSubmit = async (data: FormData) => {
    const priceText = data.priceCents.replace(",", ".");
    const cents = Math.round(parseFloat(priceText) * 100);

    if (isNaN(cents) || cents < 0) {
      Alert.alert("Erro", "Valor inválido");
      return;
    }

    try {
      await createPlan.mutateAsync({
        name: data.name,
        priceCents: cents,
        recurrenceMonths: parseInt(data.recurrenceMonths, 10) as 1 | 3 | 6 | 12,
        weeklyCheckinLimit: data.unlimited
          ? null
          : parseInt(data.weeklyCheckinLimit || "0", 10) || null,
      });
      router.back();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erro ao criar plano";
      Alert.alert("Erro", msg);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 24 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">
            Novo plano
          </Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 16 }}
        >
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Nome do plano"
                placeholder="Plano Gold"
                value={value}
                onChangeText={onChange}
                error={errors.name?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="priceCents"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Valor (R$)"
                placeholder="199,00"
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
                error={errors.priceCents?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="recurrenceMonths"
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 6 }}>
                <Text className="font-poppins-medium text-[13px] text-muted">
                  Recorrência (meses)
                </Text>
                <ModalSelect
                  value={value}
                  onChange={onChange}
                  options={RECURRENCE_OPTIONS}
                />
              </View>
            )}
          />

          <View style={{ gap: 6 }}>
            <Text className="font-poppins-medium text-[13px] text-muted">
              Check-ins por semana
            </Text>
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="weeklyCheckinLimit"
                  render={({ field: { onChange, value } }) => (
                    <FormInput
                      label=""
                      placeholder="5"
                      value={isUnlimited ? "" : value ?? ""}
                      onChangeText={onChange}
                      keyboardType="number-pad"
                      editable={!isUnlimited}
                    />
                  )}
                />
              </View>
              <Controller
                control={control}
                name="unlimited"
                render={({ field: { onChange, value } }) => (
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <Switch
                      value={value}
                      onValueChange={onChange}
                      trackColor={{ false: "#2A2A2A", true: "#A078E8" }}
                      thumbColor="#FFFFFF"
                    />
                    <Text className="font-poppins text-xs text-muted">
                      Ilimitado
                    </Text>
                  </View>
                )}
              />
            </View>
          </View>
        </ScrollView>

        <View style={{ paddingBottom: 24 }}>
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={createPlan.isPending}
            className="flex-row items-center justify-center rounded-xl"
            style={{ backgroundColor: "#A078E8", height: 56, gap: 8 }}
          >
            <Check size={20} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-base text-white">
              Salvar plano
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Create edit plan screen**

Create `apps/mobile/app/(app)/(manager)/(finances)/plans/edit/[planId].tsx`:

```typescript
import { FormInput } from "@/components/FormInput";
import { ModalSelect } from "@/components/ModalSelect";
import { ApiError } from "@/lib/api";
import {
  useSubscriptionPlan,
  useUpdatePlan,
} from "@/lib/hooks/use-subscription-plans";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  priceCents: z.string().min(1, "Valor é obrigatório"),
  recurrenceMonths: z.string(),
  weeklyCheckinLimit: z.string().optional(),
  unlimited: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const RECURRENCE_OPTIONS = [
  { value: "1", label: "1 mês" },
  { value: "3", label: "3 meses" },
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
];

export default function EditPlanScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();

  const { data: plan, isPending } = useSubscriptionPlan(planId);
  const updatePlan = useUpdatePlan(planId!);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      priceCents: "",
      recurrenceMonths: "1",
      weeklyCheckinLimit: "",
      unlimited: false,
    },
  });

  useEffect(() => {
    if (plan) {
      reset({
        name: plan.name,
        priceCents: (plan.priceCents / 100).toFixed(2).replace(".", ","),
        recurrenceMonths: String(plan.recurrenceMonths),
        weeklyCheckinLimit: plan.weeklyCheckinLimit
          ? String(plan.weeklyCheckinLimit)
          : "",
        unlimited: plan.weeklyCheckinLimit === null,
      });
    }
  }, [plan, reset]);

  const isUnlimited = watch("unlimited");

  const onSubmit = async (data: FormData) => {
    const priceText = data.priceCents.replace(",", ".");
    const cents = Math.round(parseFloat(priceText) * 100);

    if (isNaN(cents) || cents < 0) {
      Alert.alert("Erro", "Valor inválido");
      return;
    }

    try {
      await updatePlan.mutateAsync({
        name: data.name,
        priceCents: cents,
        recurrenceMonths: parseInt(data.recurrenceMonths, 10) as 1 | 3 | 6 | 12,
        weeklyCheckinLimit: data.unlimited
          ? null
          : parseInt(data.weeklyCheckinLimit || "0", 10) || null,
      });
      router.back();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erro ao atualizar plano";
      Alert.alert("Erro", msg);
    }
  };

  if (isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 24 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">
            Editar plano
          </Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 16 }}
        >
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Nome do plano"
                placeholder="Plano Gold"
                value={value}
                onChangeText={onChange}
                error={errors.name?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="priceCents"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Valor (R$)"
                placeholder="199,00"
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
                error={errors.priceCents?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="recurrenceMonths"
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 6 }}>
                <Text className="font-poppins-medium text-[13px] text-muted">
                  Recorrência (meses)
                </Text>
                <ModalSelect
                  value={value}
                  onChange={onChange}
                  options={RECURRENCE_OPTIONS}
                />
              </View>
            )}
          />

          <View style={{ gap: 6 }}>
            <Text className="font-poppins-medium text-[13px] text-muted">
              Check-ins por semana
            </Text>
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="weeklyCheckinLimit"
                  render={({ field: { onChange, value } }) => (
                    <FormInput
                      label=""
                      placeholder="5"
                      value={isUnlimited ? "" : value ?? ""}
                      onChangeText={onChange}
                      keyboardType="number-pad"
                      editable={!isUnlimited}
                    />
                  )}
                />
              </View>
              <Controller
                control={control}
                name="unlimited"
                render={({ field: { onChange, value } }) => (
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <Switch
                      value={value}
                      onValueChange={onChange}
                      trackColor={{ false: "#2A2A2A", true: "#A078E8" }}
                      thumbColor="#FFFFFF"
                    />
                    <Text className="font-poppins text-xs text-muted">
                      Ilimitado
                    </Text>
                  </View>
                )}
              />
            </View>
          </View>
        </ScrollView>

        <View style={{ paddingBottom: 24 }}>
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={updatePlan.isPending}
            className="flex-row items-center justify-center rounded-xl"
            style={{ backgroundColor: "#A078E8", height: 56, gap: 8 }}
          >
            <Check size={20} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-base text-white">
              Salvar plano
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

- [x] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(finances)/plans/create.tsx apps/mobile/app/(app)/(manager)/(finances)/plans/edit/
git commit -m "feat(mobile): add create and edit plan screens"
```

---

## Task 12: Subscriptions list screen (M-MGR-13)

**Linear:** [TAT-25](https://linear.app/tatame/issue/TAT-25/manager-finances-task-12-subscriptions-list-screen-m-mgr-13)

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(finances)/subscriptions/index.tsx`

- [x] **Step 1: Create subscriptions list screen**

Create `apps/mobile/app/(app)/(manager)/(finances)/subscriptions/index.tsx`:

```typescript
import { Avatar } from "@/components/Avatar";
import {
  useAcademySubscriptions,
  type AcademySubscriptionItem,
} from "@/lib/hooks/use-academy-subscriptions";
import { useRouter } from "expo-router";
import { ArrowLeft, ChevronRight, Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";

type FilterKey = "all" | "active" | "expired" | "pending";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativos" },
  { key: "expired", label: "Expirados" },
  { key: "pending", label: "Pgto. pendente" },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "#1A3A1A", text: "#4ADE80", label: "Ativo" },
  expired: { bg: "#3A3A1A", text: "#FFD60A", label: "Expirado" },
  cancelled: { bg: "#3A1A1A", text: "#F87171", label: "Cancelado" },
  pending: { bg: "#3A3A1A", text: "#FFD60A", label: "Pgto. pendente" },
};

function formatDate(value: string): string {
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getDisplayStatus(item: AcademySubscriptionItem): string {
  if (item.effectiveStatus === "active" && !item.hasPaidCurrentMonth) {
    return "pending";
  }
  return item.effectiveStatus;
}

export default function SubscriptionsListScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const { data: subscriptions, isPending } = useAcademySubscriptions();

  const filtered = useMemo(() => {
    let items = subscriptions ?? [];

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((s) => s.user.name.toLowerCase().includes(q));
    }

    switch (filter) {
      case "active":
        return items.filter((s) => s.effectiveStatus === "active");
      case "expired":
        return items.filter((s) => s.effectiveStatus === "expired");
      case "pending":
        return items.filter(
          (s) => s.effectiveStatus === "active" && !s.hasPaidCurrentMonth,
        );
      default:
        return items;
    }
  }, [subscriptions, filter, search]);

  if (isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 20 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">
            Assinaturas
          </Text>
          <View className="h-10 w-10" />
        </View>

        <View
          className="flex-row items-center rounded-lg border border-surface-border bg-surface"
          style={{ height: 48, paddingHorizontal: 16, gap: 10 }}
        >
          <Search size={18} color={TEXT_MUTED} />
          <TextInput
            className="flex-1 font-poppins text-sm text-primary"
            placeholder="Buscar aluno..."
            placeholderTextColor={TEXT_MUTED}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                className="items-center justify-center rounded-full"
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  backgroundColor: active ? "#A078E8" : "#1A1A1A",
                  borderWidth: active ? 0 : 1,
                  borderColor: "#2A2A2A",
                }}
              >
                <Text
                  className="font-poppins-medium text-xs"
                  style={{ color: active ? "#FFFFFF" : TEXT_SECONDARY }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        >
          {filtered.map((sub) => {
            const status = getDisplayStatus(sub);
            const style = STATUS_STYLES[status] ?? STATUS_STYLES.active;

            return (
              <Pressable
                key={sub.subscription.id}
                onPress={() =>
                  router.push(
                    `/(app)/(manager)/(finances)/subscriptions/${sub.subscription.id}`,
                  )
                }
                className="flex-row items-center rounded-2xl border border-surface-border bg-surface"
                style={{ padding: 14, gap: 14 }}
              >
                <Avatar
                  variant="user"
                  imageUrl={sub.user.profileImageUrl}
                  fallbackLetter={sub.user.name}
                  size={44}
                />
                <View className="flex-1" style={{ gap: 4 }}>
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <Text className="font-poppins-semibold text-sm text-primary">
                      {sub.user.name}
                    </Text>
                    <View
                      className="rounded-full px-2 py-0.5"
                      style={{ backgroundColor: "#A078E820" }}
                    >
                      <Text
                        className="font-poppins-medium text-[10px]"
                        style={{ color: "#A078E8" }}
                      >
                        {sub.plan.name}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <View
                      className="rounded-full px-2 py-0.5"
                      style={{ backgroundColor: style.bg }}
                    >
                      <Text
                        className="font-poppins-medium text-[10px]"
                        style={{ color: style.text }}
                      >
                        {style.label}
                      </Text>
                    </View>
                    <Text
                      className="font-poppins text-[11px]"
                      style={{ color: TEXT_MUTED }}
                    >
                      Exp. {formatDate(sub.subscription.expiresAt)}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={16} color={TEXT_MUTED} />
              </Pressable>
            );
          })}
          {filtered.length === 0 && (
            <Text className="font-poppins text-sm text-center" style={{ color: TEXT_MUTED, marginTop: 32 }}>
              Nenhuma assinatura encontrada
            </Text>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(finances)/subscriptions/index.tsx
git commit -m "feat(mobile): add student subscriptions list screen"
```

---

## Task 13: Subscription detail screen (M-MGR-14)

**Linear:** [TAT-26](https://linear.app/tatame/issue/TAT-26/manager-finances-task-13-subscription-detail-screen-m-mgr-14)

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(finances)/subscriptions/[subscriptionId].tsx`

- [x] **Step 1: Create subscription detail screen**

Create `apps/mobile/app/(app)/(manager)/(finances)/subscriptions/[subscriptionId].tsx`:

```typescript
import { Avatar } from "@/components/Avatar";
import { useAcademySubscription } from "@/lib/hooks/use-academy-subscriptions";
import { usePaymentHistory } from "@/lib/hooks/use-finances";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Check,
  CreditCard,
  Shield,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";

function formatDate(value: string): string {
  const d = new Date(value.includes("T") ? value : value + "T00:00:00");
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(cents: number): string {
  return `R$${(cents / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function formatMonthLabel(referenceMonth: string): string {
  const d = new Date(referenceMonth + "T00:00:00");
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "#1A3A1A", text: "#4ADE80", label: "Ativo" },
  expired: { bg: "#3A3A1A", text: "#FFD60A", label: "Expirado" },
  cancelled: { bg: "#3A1A1A", text: "#F87171", label: "Cancelado" },
};

export default function SubscriptionDetailScreen() {
  const { subscriptionId } = useLocalSearchParams<{
    subscriptionId: string;
  }>();
  const router = useRouter();

  const { data: sub, isPending } = useAcademySubscription(subscriptionId);
  const { data: payments } = usePaymentHistory({
    subscriptionId,
  });

  if (isPending || !sub) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const statusStyle =
    STATUS_COLORS[sub.effectiveStatus] ?? STATUS_COLORS.active;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 24 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">
            Assinatura do aluno
          </Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 24, paddingBottom: 24 }}
        >
          <View
            className="rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 20, gap: 16 }}
          >
            <View className="flex-row items-center" style={{ gap: 14 }}>
              <Avatar
                variant="user"
                imageUrl={sub.user.profileImageUrl}
                fallbackLetter={sub.user.name}
                size={48}
              />
              <View style={{ gap: 2 }}>
                <Text className="font-poppins-bold text-base text-primary">
                  {sub.user.name}
                </Text>
                <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                  {sub.user.email}
                </Text>
              </View>
            </View>

            <View className="h-px" style={{ backgroundColor: "#2A2A2A" }} />

            <View className="flex-row flex-wrap" style={{ gap: 16 }}>
              <View style={{ gap: 2, minWidth: "40%" }}>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Shield size={12} color={TEXT_MUTED} />
                  <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                    Plano
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {sub.plan.name}
                </Text>
              </View>
              <View style={{ gap: 2 }}>
                <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                  Status
                </Text>
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: statusStyle.bg }}
                >
                  <Text
                    className="font-poppins-medium text-[10px]"
                    style={{ color: statusStyle.text }}
                  >
                    {statusStyle.label}
                  </Text>
                </View>
              </View>
              <View style={{ gap: 2, minWidth: "40%" }}>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Calendar size={12} color={TEXT_MUTED} />
                  <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                    Início
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {formatDate(sub.subscription.startsAt)}
                </Text>
              </View>
              <View style={{ gap: 2 }}>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Calendar size={12} color={TEXT_MUTED} />
                  <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                    Expiração
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {formatDate(sub.subscription.expiresAt)}
                </Text>
              </View>
            </View>

            {sub.hasPaidCurrentMonth && sub.lastPayment ? (
              <View
                className="flex-row items-center rounded-lg"
                style={{
                  backgroundColor: "#32D74B15",
                  padding: 10,
                  paddingHorizontal: 14,
                  gap: 8,
                }}
              >
                <Check size={14} color="#32D74B" />
                <Text className="font-poppins-medium text-xs" style={{ color: "#32D74B" }}>
                  Pagamento em dia
                </Text>
                <Text className="font-poppins text-[10px]" style={{ color: TEXT_MUTED }}>
                  Último: {formatDate(sub.lastPayment.paidAt)}
                </Text>
              </View>
            ) : (
              <View
                className="flex-row items-center rounded-lg"
                style={{
                  backgroundColor: "#FFD60A15",
                  padding: 10,
                  paddingHorizontal: 14,
                  gap: 8,
                }}
              >
                <CreditCard size={14} color="#FFD60A" />
                <Text className="font-poppins-medium text-xs" style={{ color: "#FFD60A" }}>
                  Pagamento pendente
                </Text>
              </View>
            )}
          </View>

          <Text
            className="font-poppins-semibold text-sm"
            style={{ color: TEXT_SECONDARY }}
          >
            Histórico de pagamentos
          </Text>

          <View style={{ gap: 10 }}>
            {(payments ?? []).map((p) => (
              <View
                key={p.id}
                className="flex-row items-center justify-between rounded-xl border border-surface-border bg-surface"
                style={{ padding: 14, paddingHorizontal: 16 }}
              >
                <View style={{ gap: 2 }}>
                  <Text className="font-poppins-semibold text-sm text-primary">
                    {formatMonthLabel(p.referenceMonth)}
                  </Text>
                  <Text className="font-poppins text-[11px]" style={{ color: TEXT_MUTED }}>
                    Confirmado em {formatDate(p.paidAt)} · Manual
                  </Text>
                </View>
                <Text
                  className="font-poppins-bold text-sm"
                  style={{ color: "#32D74B" }}
                >
                  {formatCurrency(p.amountCents)}
                </Text>
              </View>
            ))}
            {(payments ?? []).length === 0 && (
              <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                Nenhum pagamento registrado
              </Text>
            )}
          </View>
        </ScrollView>

        <View style={{ paddingBottom: 24 }}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(app)/(manager)/(finances)/confirm-payment",
                params: { subscriptionId },
              })
            }
            className="flex-row items-center justify-center rounded-xl"
            style={{ backgroundColor: "#A078E8", height: 56, gap: 8 }}
          >
            <Check size={20} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-base text-white">
              Confirmar pagamento
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(finances)/subscriptions/\[subscriptionId\].tsx
git commit -m "feat(mobile): add student subscription detail screen"
```

---

## Task 14: Confirm payment screen

**Linear:** [TAT-27](https://linear.app/tatame/issue/TAT-27/manager-finances-task-14-confirm-payment-screen)

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(finances)/confirm-payment.tsx`

- [x] **Step 1: Create confirm payment screen**

Create `apps/mobile/app/(app)/(manager)/(finances)/confirm-payment.tsx`:

```typescript
import { FormInput } from "@/components/FormInput";
import { ModalSelect } from "@/components/ModalSelect";
import { ApiError } from "@/lib/api";
import { useAcademySubscriptions } from "@/lib/hooks/use-academy-subscriptions";
import { useConfirmPayment } from "@/lib/hooks/use-finances";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

const schema = z.object({
  subscriptionId: z.string().min(1, "Selecione um aluno"),
  amountCents: z.string().min(1, "Valor é obrigatório"),
  referenceMonth: z.string().min(1, "Selecione o mês"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function getRecentMonths(): { value: string; label: string }[] {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const label = d
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      .replace(/^./, (c) => c.toUpperCase());
    months.push({ value, label });
  }
  return months;
}

export default function ConfirmPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subscriptionId?: string }>();
  const confirmPayment = useConfirmPayment();

  const { data: subscriptions } = useAcademySubscriptions({
    status: "active",
  });

  const studentOptions = useMemo(() => {
    return (subscriptions ?? []).map((s) => ({
      value: s.subscription.id,
      label: `${s.user.name} — ${s.plan.name}`,
    }));
  }, [subscriptions]);

  const monthOptions = useMemo(() => getRecentMonths(), []);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      subscriptionId: params.subscriptionId ?? "",
      amountCents: "",
      referenceMonth: getCurrentMonth(),
      notes: "",
    },
  });

  const selectedSubId = watch("subscriptionId");

  useEffect(() => {
    if (selectedSubId && subscriptions) {
      const match = subscriptions.find(
        (s) => s.subscription.id === selectedSubId,
      );
      if (match) {
        const formatted = (match.plan.priceCents / 100)
          .toFixed(2)
          .replace(".", ",");
        setValue("amountCents", formatted);
      }
    }
  }, [selectedSubId, subscriptions, setValue]);

  const onSubmit = async (data: FormData) => {
    const priceText = data.amountCents.replace(",", ".");
    const cents = Math.round(parseFloat(priceText) * 100);

    if (isNaN(cents) || cents < 0) {
      Alert.alert("Erro", "Valor inválido");
      return;
    }

    try {
      await confirmPayment.mutateAsync({
        subscriptionId: data.subscriptionId,
        amountCents: cents,
        referenceMonth: data.referenceMonth,
        notes: data.notes || null,
      });
      Alert.alert("Sucesso", "Pagamento confirmado com sucesso!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Erro ao confirmar pagamento";
      Alert.alert("Erro", msg);
    }
  };

  const isPreselected = !!params.subscriptionId;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 24 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">
            Confirmar pagamento
          </Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 16 }}
        >
          <Controller
            control={control}
            name="subscriptionId"
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 6 }}>
                <Text className="font-poppins-medium text-[13px] text-muted">
                  Aluno
                </Text>
                <ModalSelect
                  value={value}
                  onChange={onChange}
                  options={studentOptions}
                  placeholder="Selecionar aluno"
                  disabled={isPreselected}
                />
                {errors.subscriptionId?.message && (
                  <Text className="font-poppins text-xs text-red-500">
                    {errors.subscriptionId.message}
                  </Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="amountCents"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Valor (R$)"
                placeholder="199,00"
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
                error={errors.amountCents?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="referenceMonth"
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 6 }}>
                <Text className="font-poppins-medium text-[13px] text-muted">
                  Mês de referência
                </Text>
                <ModalSelect
                  value={value}
                  onChange={onChange}
                  options={monthOptions}
                />
              </View>
            )}
          />

          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Observações"
                placeholder="Opcional"
                value={value ?? ""}
                onChangeText={onChange}
                multiline
              />
            )}
          />
        </ScrollView>

        <View style={{ paddingBottom: 24 }}>
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={confirmPayment.isPending}
            className="flex-row items-center justify-center rounded-xl"
            style={{ backgroundColor: "#A078E8", height: 56, gap: 8 }}
          >
            <Check size={20} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-base text-white">
              Confirmar pagamento
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(finances)/confirm-payment.tsx
git commit -m "feat(mobile): add confirm payment screen"
```

---

## Task 15: Financial dashboard screen (M-MGR-17)

**Linear:** [TAT-28](https://linear.app/tatame/issue/TAT-28/manager-finances-task-15-financial-dashboard-screen-m-mgr-17)

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/(finances)/index.tsx`

- [x] **Step 1: Replace placeholder with full dashboard**

Replace the content of `apps/mobile/app/(app)/(manager)/(finances)/index.tsx`:

```typescript
import { useFinancialSummary, usePaymentHistory } from "@/lib/hooks/use-finances";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  CreditCard,
  FileText,
  Receipt,
  Users,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";

function formatCurrency(cents: number): string {
  return `R$${(cents / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function formatCurrencyFull(cents: number): string {
  const str = (cents / 100).toFixed(2).replace(".", ",");
  return `R$ ${str.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function formatDate(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function percentChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

export default function FinancialDashboard() {
  const router = useRouter();
  const {
    data: summary,
    isPending,
    refetch,
  } = useFinancialSummary();
  const { data: recentPayments } = usePaymentHistory({ limit: 10 });

  if (isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const pctLabel = summary
    ? percentChange(summary.revenueCurrentMonth, summary.revenuePreviousMonth)
    : "";
  const pctColor =
    pctLabel.startsWith("+") || pctLabel === "0%" ? "#32D74B" : "#FF453A";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 24,
          gap: 18,
        }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => refetch()}
            tintColor="#A078E8"
          />
        }
      >
        <View className="flex-row items-center justify-between" style={{ height: 62 }}>
          <View className="h-10 w-10" />
          <Text className="font-poppins-bold text-lg text-primary">
            Financeiro
          </Text>
          <View className="h-10 w-10" />
        </View>

        <View className="flex-row" style={{ gap: 10 }}>
          <View
            className="flex-1 rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 14, gap: 6 }}
          >
            <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
              Receita (mês)
            </Text>
            <Text className="font-poppins-bold text-xl text-primary">
              {formatCurrencyFull(summary?.revenueCurrentMonth ?? 0)}
            </Text>
            <Text
              className="font-poppins text-[11px]"
              style={{ color: pctColor }}
            >
              {pctLabel} vs mês anterior
            </Text>
          </View>
          <View
            className="flex-1 rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 14, gap: 6 }}
          >
            <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
              Pagamentos em atraso
            </Text>
            <Text className="font-poppins-bold text-xl" style={{ color: "#FF453A" }}>
              {summary?.pendingPaymentsCount ?? 0}
            </Text>
            <Text className="font-poppins text-[11px]" style={{ color: "#FF453A" }}>
              {formatCurrency(summary?.pendingPaymentsTotal ?? 0)} pendente
            </Text>
          </View>
        </View>

        <View
          className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 14 }}
        >
          <View style={{ gap: 4 }}>
            <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
              Membros ativos
            </Text>
            <Text className="font-poppins-bold text-2xl text-primary">
              {summary?.activeSubscriptionsCount ?? 0}
            </Text>
          </View>
          <View
            className="items-center justify-center rounded-lg"
            style={{
              width: 40,
              height: 40,
              backgroundColor: "#A078E820",
            }}
          >
            <Users size={20} color="#A078E8" />
          </View>
        </View>

        <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
          Ações rápidas
        </Text>
        <View className="flex-row" style={{ gap: 8 }}>
          {[
            {
              icon: FileText,
              label: "Planos",
              href: "/(app)/(manager)/(finances)/plans" as const,
            },
            {
              icon: Receipt,
              label: "Assinaturas",
              href: "/(app)/(manager)/(finances)/subscriptions" as const,
            },
            {
              icon: CreditCard,
              label: "Confirmar\nPagamento",
              href: "/(app)/(manager)/(finances)/confirm-payment" as const,
            },
          ].map((action) => (
            <Pressable
              key={action.label}
              onPress={() => router.push(action.href)}
              className="flex-1 items-center justify-center rounded-xl border border-surface-border bg-surface"
              style={{ paddingVertical: 14, gap: 6 }}
            >
              <action.icon size={20} color="#FFFFFF" />
              <Text className="font-poppins-medium text-[11px] text-primary text-center">
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
          Histórico de pagamentos
        </Text>
        <View style={{ gap: 10 }}>
          {(recentPayments ?? []).map((p) => (
            <View
              key={p.id}
              className="rounded-xl border border-surface-border bg-surface"
              style={{ padding: 12, paddingHorizontal: 14, gap: 4 }}
            >
              <View className="flex-row items-center justify-between">
                <Text className="font-poppins-semibold text-sm text-primary">
                  {p.userName}
                </Text>
                <Text
                  className="font-poppins-bold text-sm"
                  style={{ color: "#32D74B" }}
                >
                  {formatCurrency(p.amountCents)}
                </Text>
              </View>
              <Text className="font-poppins text-[11px]" style={{ color: TEXT_MUTED }}>
                {formatDate(p.paidAt)} · Manual · Ref. {p.referenceMonth.slice(0, 7)}
              </Text>
            </View>
          ))}
          {(recentPayments ?? []).length === 0 && (
            <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
              Nenhum pagamento registrado
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(finances)/index.tsx
git commit -m "feat(mobile): add financial dashboard screen"
```

---

## Task 16: Verify full build and run tests

**Linear:** [TAT-29](https://linear.app/tatame/issue/TAT-29/manager-finances-task-16-verify-full-build-and-run-tests)

- [ ] **Step 1: Run API integration tests**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/api && npx vitest run src/subscription-payment.integration.test.ts`
Expected: all tests pass

- [ ] **Step 2: Run API unit tests**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/api && npx vitest run`
Expected: all tests pass

- [ ] **Step 3: Build full project**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo build`
Expected: all packages build successfully

- [ ] **Step 4: Verify TypeScript types in mobile**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/mobile && npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 5: Fix any issues found and commit**

If there are issues, fix them and commit with a descriptive message.
