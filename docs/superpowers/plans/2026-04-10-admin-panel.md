# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal admin panel for platform-wide operational control — tracking academies, payments, and fund transfers to managers.

**Architecture:** New `admin` module in the Express API with a dedicated `adminOnly` middleware that validates the Clerk user's email against `ADMIN_EMAIL` env var. Frontend pages live under `apps/web/app/admin/` with Next.js middleware protecting the routes. A single `transferredAt` column is added to the `payments` table to track fund transfers.

**Tech Stack:** Express, Drizzle ORM, Clerk, Next.js 15, Tailwind CSS 4, Recharts, lucide-react

---

### Task 1: Add `ADMIN_EMAIL` env variable and `transferredAt` column to payments

**Files:**
- Modify: `packages/config/src/env.ts`
- Modify: `packages/db/src/schema/index.ts`
- Create: `packages/db/drizzle/0005_admin_transferred_at.sql`
- Modify: `apps/api/src/testing/factories/index.ts`

- [ ] **Step 1: Add `ADMIN_EMAIL` to env schema**

In `packages/config/src/env.ts`, add inside the `envSchema` object, after `OTEL_COLLECTOR_URL`:

```typescript
ADMIN_EMAIL: z.string().email().optional(),
```

- [ ] **Step 2: Add `transferredAt` column to payments table**

In `packages/db/src/schema/index.ts`, add a new column to the `payments` table definition, after the `createdAt` column:

```typescript
transferredAt: timestamp("transferred_at", { withTimezone: true }),
```

- [ ] **Step 3: Create the migration SQL**

Create file `packages/db/drizzle/0005_admin_transferred_at.sql`:

```sql
ALTER TABLE "payments" ADD COLUMN "transferred_at" timestamp with time zone;
```

- [ ] **Step 4: Update the drizzle migration metadata**

Run:
```bash
cd packages/db && npx drizzle-kit generate
```

If drizzle-kit generated a different migration file, delete the manually created `0005_admin_transferred_at.sql` and use the generated one instead. Check that the generated SQL matches the expected `ALTER TABLE` statement.

- [ ] **Step 5: Update `makePayment` factory**

In `apps/api/src/testing/factories/index.ts`, add `transferredAt: null` to the `makePayment` return object, after `createdAt`:

```typescript
export function makePayment(overrides: Partial<PaymentRow> = {}): PaymentRow {
  const t = faker.date.recent({ days: 14 });
  const ref = faker.date.recent({ days: 90 });
  return {
    id: rid(),
    subscriptionId: rid(),
    userId: rid(),
    academyId: rid(),
    amountCents: faker.number.int({ min: 5_000, max: 50_000 }),
    method: "manual",
    confirmedBy: rid(),
    stripePaymentId: null,
    referenceMonth: utcIsoDate(
      new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1)),
    ),
    notes:
      faker.helpers.maybe(() => faker.lorem.sentence(), {
        probability: 0.25,
      }) ?? null,
    paidAt: t,
    createdAt: t,
    transferredAt: null,
    ...overrides,
  };
}
```

- [ ] **Step 6: Update `InMemoryPaymentRepository` to include `transferredAt` in `create`**

In `apps/api/src/modules/payment/payment.repository.in-memory.ts`, add `transferredAt: null` to the `row` object in the `create` method, after `createdAt`:

```typescript
const row: PaymentRow = {
  id: randomUUID(),
  subscriptionId: data.subscriptionId,
  userId: data.userId,
  academyId: data.academyId,
  amountCents: data.amountCents,
  method: data.method,
  confirmedBy: data.confirmedBy,
  stripePaymentId: data.stripePaymentId,
  referenceMonth: data.referenceMonth,
  notes: data.notes,
  paidAt: data.paidAt,
  createdAt: t,
  transferredAt: null,
};
```

- [ ] **Step 7: Prevent `transferredAt` from leaking in existing APIs**

The existing `findByAcademy` method in `apps/api/src/modules/payment/payment.repository.postgres.ts` uses `this.db.select().from(payments)` which auto-selects ALL columns. Once `transferredAt` is added, it would be returned in `GET /v1/payments/me`. Fix by using explicit column selection.

Replace the `select()` call in the `findByAcademy` method with explicit columns:

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
    })
    .from(payments)
    .where(whereClause)
    .orderBy(desc(payments.paidAt));
  if (opts.limit) {
    return query.limit(opts.limit);
  }
  return query;
}
```

Note: This changes the return type — `PaymentRow` from `InferSelectModel` includes `transferredAt`, but this query omits it. To keep types aligned, update the `PaymentRow` type in `payment.repository.ts` to omit `transferredAt`:

```typescript
export type PaymentRow = Omit<InferSelectModel<typeof payments>, "transferredAt">;
```

Also update the `findByAcademyWithUser` return type accordingly — it already uses explicit columns so no query change needed, but add `transferredAt` exclusion from `PaymentWithUser`:

```typescript
export type PaymentWithUser = PaymentRow & {
  userName: string;
};
```

This stays the same since `PaymentRow` now omits `transferredAt`.

- [ ] **Step 8: Run existing tests to verify nothing broke**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter api test`
Expected: All existing tests pass.

- [ ] **Step 9: Run the migration against the database**

Run: `cd packages/db && npx drizzle-kit push`
Expected: Migration applies successfully.

- [ ] **Step 10: Commit**

```bash
git add packages/config/src/env.ts packages/db/src/schema/index.ts packages/db/drizzle/ apps/api/src/testing/factories/index.ts apps/api/src/modules/payment/payment.repository.in-memory.ts
git commit -m "feat(db): add ADMIN_EMAIL env and transferredAt column to payments"
```

---

### Task 2: Create `adminOnly` middleware

**Files:**
- Create: `apps/api/src/middleware/admin-only.ts`

- [ ] **Step 1: Create the `adminOnly` middleware**

Create `apps/api/src/middleware/admin-only.ts`:

```typescript
import { getAuth } from "@clerk/express";
import { loadEnv } from "@tatame/config";
import type { NextFunction, Request, Response } from "express";
import { clerkClient } from "../lib/clerk.js";

/**
 * Middleware that restricts access to the platform admin.
 * Validates the authenticated Clerk user's email against ADMIN_EMAIL env var.
 */
export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    const env = loadEnv();
    if (!env.CLERK_SECRET_KEY || !env.ADMIN_EMAIL) {
      res.status(503).json({ error: "Admin not configured" });
      return;
    }

    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress;

      if (!email || email !== env.ADMIN_EMAIL) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      next();
    } catch (e) {
      next(e);
    }
  })();
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter api build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/middleware/admin-only.ts
git commit -m "feat(api): add adminOnly middleware"
```

---

### Task 3: Create admin repository

**Files:**
- Create: `apps/api/src/modules/admin/admin.repository.ts`
- Create: `apps/api/src/modules/admin/admin.repository.postgres.ts`

- [ ] **Step 1: Define the admin repository interface**

Create `apps/api/src/modules/admin/admin.repository.ts`:

```typescript
export type AcademySummaryRow = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  managerPlan: "free" | "pro" | null;
  managerPlanStatus: "active" | "past_due" | "canceled" | "incomplete" | null;
  studentCount: number;
  pendingTransferCents: number;
};

export type AcademyDetailRow = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  managerPlan: "free" | "pro" | null;
  managerPlanStatus: "active" | "past_due" | "canceled" | "incomplete" | null;
};

export type AdminPaymentRow = {
  id: string;
  userName: string;
  amountCents: number;
  method: "manual" | "stripe" | "pix";
  referenceMonth: string;
  paidAt: Date;
  transferredAt: Date | null;
};

export type DailyCheckinCount = {
  date: string;
  count: number;
};

export interface IAdminRepository {
  countActiveSubscribers(): Promise<number>;
  countTotalUsers(): Promise<number>;
  sumAppRevenueCents(): Promise<number>;
  sumTransferredCents(): Promise<number>;
  sumPendingTransferCents(): Promise<number>;
  getDailyCheckins(days: number): Promise<DailyCheckinCount[]>;
  listAcademies(): Promise<AcademySummaryRow[]>;
  getAcademyDetail(academyId: string): Promise<AcademyDetailRow | undefined>;
  countStudentsByAcademy(academyId: string): Promise<number>;
  sumAcademyRevenueCentsForMonth(academyId: string, referenceMonth: string): Promise<number>;
  sumAcademyTransferredCents(academyId: string): Promise<number>;
  sumAcademyPendingTransferCents(academyId: string): Promise<number>;
  listAcademyPayments(academyId: string, opts: { limit: number; offset: number }): Promise<{ items: AdminPaymentRow[]; total: number }>;
  markTransferred(paymentIds: string[]): Promise<number>;
}
```

- [ ] **Step 2: Create the Postgres implementation**

Create `apps/api/src/modules/admin/admin.repository.postgres.ts`:

```typescript
import { and, count, eq, sql, sum, isNull, desc, inArray } from "drizzle-orm";
import {
  academies,
  academyMemberships,
  checkins,
  managerSubscriptions,
  payments,
  studentSubscriptions,
  users,
  type Database,
} from "@tatame/db";
import type {
  AcademyDetailRow,
  AcademySummaryRow,
  AdminPaymentRow,
  DailyCheckinCount,
  IAdminRepository,
} from "./admin.repository.js";

export class PostgresAdminRepository implements IAdminRepository {
  constructor(private readonly db: Database) {}

  async countActiveSubscribers(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const [row] = await this.db
      .select({ count: count() })
      .from(studentSubscriptions)
      .where(
        and(
          eq(studentSubscriptions.status, "active"),
          sql`${studentSubscriptions.expiresAt} >= ${today}`,
        ),
      );
    return row?.count ?? 0;
  }

  async countTotalUsers(): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(users)
      .where(isNull(users.deletedAt));
    return row?.count ?? 0;
  }

  async sumAppRevenueCents(): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(payments.amountCents) })
      .from(payments)
      .where(
        sql`${payments.method} IN ('stripe', 'pix')`,
      );
    return Number(row?.total ?? 0);
  }

  async sumTransferredCents(): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(payments.amountCents) })
      .from(payments)
      .where(
        and(
          sql`${payments.method} IN ('stripe', 'pix')`,
          sql`${payments.transferredAt} IS NOT NULL`,
        ),
      );
    return Number(row?.total ?? 0);
  }

  async sumPendingTransferCents(): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(payments.amountCents) })
      .from(payments)
      .where(
        and(
          sql`${payments.method} IN ('stripe', 'pix')`,
          isNull(payments.transferredAt),
        ),
      );
    return Number(row?.total ?? 0);
  }

  async getDailyCheckins(days: number): Promise<DailyCheckinCount[]> {
    const rows = await this.db
      .select({
        date: checkins.date,
        count: count(),
      })
      .from(checkins)
      .where(sql`${checkins.date} >= CURRENT_DATE - ${days}`)
      .groupBy(checkins.date)
      .orderBy(checkins.date);
    return rows.map((r) => ({ date: r.date, count: r.count }));
  }

  async listAcademies(): Promise<AcademySummaryRow[]> {
    const rows = await this.db
      .select({
        id: academies.id,
        name: academies.name,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerPhone: users.phone,
        managerPlan: managerSubscriptions.plan,
        managerPlanStatus: managerSubscriptions.status,
      })
      .from(academies)
      .innerJoin(users, eq(academies.ownerId, users.id))
      .leftJoin(managerSubscriptions, eq(academies.id, managerSubscriptions.academyId));

    const result: AcademySummaryRow[] = [];
    for (const row of rows) {
      const [studentsRow] = await this.db
        .select({ count: count() })
        .from(academyMemberships)
        .where(
          and(
            eq(academyMemberships.academyId, row.id),
            eq(academyMemberships.role, "student"),
            eq(academyMemberships.status, "active"),
          ),
        );

      const [pendingRow] = await this.db
        .select({ total: sum(payments.amountCents) })
        .from(payments)
        .where(
          and(
            eq(payments.academyId, row.id),
            sql`${payments.method} IN ('stripe', 'pix')`,
            isNull(payments.transferredAt),
          ),
        );

      result.push({
        ...row,
        studentCount: studentsRow?.count ?? 0,
        pendingTransferCents: Number(pendingRow?.total ?? 0),
      });
    }

    return result;
  }

  async getAcademyDetail(academyId: string): Promise<AcademyDetailRow | undefined> {
    const [row] = await this.db
      .select({
        id: academies.id,
        name: academies.name,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerPhone: users.phone,
        managerPlan: managerSubscriptions.plan,
        managerPlanStatus: managerSubscriptions.status,
      })
      .from(academies)
      .innerJoin(users, eq(academies.ownerId, users.id))
      .leftJoin(managerSubscriptions, eq(academies.id, managerSubscriptions.academyId))
      .where(eq(academies.id, academyId));
    return row ?? undefined;
  }

  async countStudentsByAcademy(academyId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(academyMemberships)
      .where(
        and(
          eq(academyMemberships.academyId, academyId),
          eq(academyMemberships.role, "student"),
          eq(academyMemberships.status, "active"),
        ),
      );
    return row?.count ?? 0;
  }

  async sumAcademyRevenueCentsForMonth(academyId: string, referenceMonth: string): Promise<number> {
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

  async sumAcademyTransferredCents(academyId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(payments.amountCents) })
      .from(payments)
      .where(
        and(
          eq(payments.academyId, academyId),
          sql`${payments.method} IN ('stripe', 'pix')`,
          sql`${payments.transferredAt} IS NOT NULL`,
        ),
      );
    return Number(row?.total ?? 0);
  }

  async sumAcademyPendingTransferCents(academyId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(payments.amountCents) })
      .from(payments)
      .where(
        and(
          eq(payments.academyId, academyId),
          sql`${payments.method} IN ('stripe', 'pix')`,
          isNull(payments.transferredAt),
        ),
      );
    return Number(row?.total ?? 0);
  }

  async listAcademyPayments(
    academyId: string,
    opts: { limit: number; offset: number },
  ): Promise<{ items: AdminPaymentRow[]; total: number }> {
    const [totalRow] = await this.db
      .select({ count: count() })
      .from(payments)
      .where(eq(payments.academyId, academyId));

    const items = await this.db
      .select({
        id: payments.id,
        userName: users.name,
        amountCents: payments.amountCents,
        method: payments.method,
        referenceMonth: payments.referenceMonth,
        paidAt: payments.paidAt,
        transferredAt: payments.transferredAt,
      })
      .from(payments)
      .innerJoin(users, eq(payments.userId, users.id))
      .where(eq(payments.academyId, academyId))
      .orderBy(desc(payments.paidAt))
      .limit(opts.limit)
      .offset(opts.offset);

    return { items, total: totalRow?.count ?? 0 };
  }

  async markTransferred(paymentIds: string[]): Promise<number> {
    if (paymentIds.length === 0) return 0;

    const result = await this.db
      .update(payments)
      .set({ transferredAt: new Date() })
      .where(
        and(
          inArray(payments.id, paymentIds),
          sql`${payments.method} IN ('stripe', 'pix')`,
          isNull(payments.transferredAt),
        ),
      )
      .returning({ id: payments.id });

    return result.length;
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter api build`
Expected: Compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/admin/
git commit -m "feat(api): add admin repository with transfer tracking queries"
```

---

### Task 4: Create admin service with tests

**Files:**
- Create: `apps/api/src/modules/admin/admin.service.ts`
- Create: `apps/api/src/modules/admin/admin.service.test.ts`

- [ ] **Step 1: Create the admin service**

Create `apps/api/src/modules/admin/admin.service.ts`:

```typescript
import { HttpError } from "../../lib/http-error.js";
import type {
  AcademyDetailRow,
  AcademySummaryRow,
  AdminPaymentRow,
  DailyCheckinCount,
  IAdminRepository,
} from "./admin.repository.js";

export type DashboardData = {
  activeSubscribers: number;
  totalUsers: number;
  appRevenueCents: number;
  transferredCents: number;
};

export type FinancialSummaryData = {
  transferredCents: number;
  pendingTransferCents: number;
};

export type AcademyDetailData = {
  academy: AcademyDetailRow;
  studentCount: number;
  revenueCentsCurrentMonth: number;
  transferredCents: number;
  pendingTransferCents: number;
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export class AdminService {
  constructor(private readonly repo: IAdminRepository) {}

  async getDashboard(): Promise<DashboardData> {
    const [activeSubscribers, totalUsers, appRevenueCents, transferredCents] =
      await Promise.all([
        this.repo.countActiveSubscribers(),
        this.repo.countTotalUsers(),
        this.repo.sumAppRevenueCents(),
        this.repo.sumTransferredCents(),
      ]);

    return { activeSubscribers, totalUsers, appRevenueCents, transferredCents };
  }

  async getCheckins(): Promise<DailyCheckinCount[]> {
    return this.repo.getDailyCheckins(7);
  }

  async getFinancialSummary(): Promise<FinancialSummaryData> {
    const [transferredCents, pendingTransferCents] = await Promise.all([
      this.repo.sumTransferredCents(),
      this.repo.sumPendingTransferCents(),
    ]);
    return { transferredCents, pendingTransferCents };
  }

  async listAcademies(): Promise<AcademySummaryRow[]> {
    return this.repo.listAcademies();
  }

  async getAcademyDetail(academyId: string): Promise<AcademyDetailData> {
    const academy = await this.repo.getAcademyDetail(academyId);
    if (!academy) {
      throw new HttpError(404, "Academy not found");
    }

    const month = currentMonth();
    const [studentCount, revenueCentsCurrentMonth, transferredCents, pendingTransferCents] =
      await Promise.all([
        this.repo.countStudentsByAcademy(academyId),
        this.repo.sumAcademyRevenueCentsForMonth(academyId, month),
        this.repo.sumAcademyTransferredCents(academyId),
        this.repo.sumAcademyPendingTransferCents(academyId),
      ]);

    return { academy, studentCount, revenueCentsCurrentMonth, transferredCents, pendingTransferCents };
  }

  async listAcademyPayments(
    academyId: string,
    opts: { limit: number; offset: number },
  ): Promise<{ items: AdminPaymentRow[]; total: number }> {
    return this.repo.listAcademyPayments(academyId, opts);
  }

  async confirmTransfer(paymentIds: string[]): Promise<number> {
    if (paymentIds.length === 0) {
      throw new HttpError(400, "No payment IDs provided");
    }
    return this.repo.markTransferred(paymentIds);
  }
}
```

- [ ] **Step 2: Write the test file**

Create `apps/api/src/modules/admin/admin.service.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { AdminService } from "./admin.service.js";
import type { IAdminRepository, AcademyDetailRow, AcademySummaryRow, AdminPaymentRow, DailyCheckinCount } from "./admin.repository.js";

function makeFakeRepo(overrides: Partial<IAdminRepository> = {}): IAdminRepository {
  return {
    countActiveSubscribers: async () => 10,
    countTotalUsers: async () => 50,
    sumAppRevenueCents: async () => 100_000,
    sumTransferredCents: async () => 60_000,
    sumPendingTransferCents: async () => 40_000,
    getDailyCheckins: async () => [],
    listAcademies: async () => [],
    getAcademyDetail: async () => undefined,
    countStudentsByAcademy: async () => 0,
    sumAcademyRevenueCentsForMonth: async () => 0,
    sumAcademyTransferredCents: async () => 0,
    sumAcademyPendingTransferCents: async () => 0,
    listAcademyPayments: async () => ({ items: [], total: 0 }),
    markTransferred: async () => 0,
    ...overrides,
  };
}

describe("AdminService", () => {
  it("getDashboard returns aggregated KPIs", async () => {
    const svc = new AdminService(makeFakeRepo());
    const result = await svc.getDashboard();
    expect(result).toEqual({
      activeSubscribers: 10,
      totalUsers: 50,
      appRevenueCents: 100_000,
      transferredCents: 60_000,
    });
  });

  it("getFinancialSummary returns transfer totals", async () => {
    const svc = new AdminService(makeFakeRepo());
    const result = await svc.getFinancialSummary();
    expect(result).toEqual({
      transferredCents: 60_000,
      pendingTransferCents: 40_000,
    });
  });

  it("getAcademyDetail throws 404 when academy not found", async () => {
    const svc = new AdminService(makeFakeRepo());
    await expect(svc.getAcademyDetail("nonexistent")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("getAcademyDetail returns detail with KPIs", async () => {
    const academy: AcademyDetailRow = {
      id: "a1",
      name: "Test Academy",
      ownerName: "Owner",
      ownerEmail: "owner@test.com",
      ownerPhone: null,
      managerPlan: "pro",
      managerPlanStatus: "active",
    };
    const svc = new AdminService(
      makeFakeRepo({
        getAcademyDetail: async () => academy,
        countStudentsByAcademy: async () => 25,
        sumAcademyRevenueCentsForMonth: async () => 50_000,
        sumAcademyTransferredCents: async () => 30_000,
        sumAcademyPendingTransferCents: async () => 20_000,
      }),
    );
    const result = await svc.getAcademyDetail("a1");
    expect(result.academy.name).toBe("Test Academy");
    expect(result.studentCount).toBe(25);
    expect(result.pendingTransferCents).toBe(20_000);
  });

  it("confirmTransfer throws 400 for empty array", async () => {
    const svc = new AdminService(makeFakeRepo());
    await expect(svc.confirmTransfer([])).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("confirmTransfer delegates to repo", async () => {
    const svc = new AdminService(
      makeFakeRepo({ markTransferred: async (ids) => ids.length }),
    );
    const updated = await svc.confirmTransfer(["p1", "p2"]);
    expect(updated).toBe(2);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter api test -- --run apps/api/src/modules/admin/admin.service.test.ts`
Expected: All 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/admin/admin.service.ts apps/api/src/modules/admin/admin.service.test.ts
git commit -m "feat(api): add admin service with unit tests"
```

---

### Task 5: Create admin API routes

**Files:**
- Create: `apps/api/src/modules/admin/admin.routes.ts`
- Modify: `apps/api/src/router.ts`

- [ ] **Step 1: Create the admin routes file**

Create `apps/api/src/modules/admin/admin.routes.ts`:

```typescript
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import { adminOnly } from "../../middleware/admin-only.js";
import { PostgresAdminRepository } from "./admin.repository.postgres.js";
import { AdminService } from "./admin.service.js";

export const adminRouter = Router();

const db = getDb();
const adminService = new AdminService(new PostgresAdminRepository(db));

adminRouter.use(adminOnly);

adminRouter.get("/dashboard", async (_req, res, next) => {
  try {
    const data = await adminService.getDashboard();
    res.json(data);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/dashboard/checkins", async (_req, res, next) => {
  try {
    const data = await adminService.getCheckins();
    res.json({ items: data });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/dashboard/financial-summary", async (_req, res, next) => {
  try {
    const data = await adminService.getFinancialSummary();
    res.json(data);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/dashboard/academies", async (_req, res, next) => {
  try {
    const data = await adminService.listAcademies();
    res.json({ items: data });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/academies/:id", async (req, res, next) => {
  try {
    const data = await adminService.getAcademyDetail(req.params.id!);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

const listPaymentsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

adminRouter.get("/academies/:id/payments", async (req, res, next) => {
  try {
    const query = listPaymentsQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new HttpError(400, "Invalid query");
    }
    const data = await adminService.listAcademyPayments(req.params.id!, {
      limit: query.data.limit,
      offset: query.data.offset,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

const transferBodySchema = z.object({
  paymentIds: z.array(z.string().uuid()).min(1),
});

adminRouter.patch("/payments/transfer", async (req, res, next) => {
  try {
    const body = transferBodySchema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, "Invalid body: paymentIds must be a non-empty array of UUIDs");
    }
    const updated = await adminService.confirmTransfer(body.data.paymentIds);
    res.json({ updated });
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/payments/:id/transfer", async (req, res, next) => {
  try {
    const updated = await adminService.confirmTransfer([req.params.id!]);
    res.json({ updated });
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 2: Mount the admin router**

In `apps/api/src/router.ts`, add the import at the top with the other imports:

```typescript
import { adminRouter } from "./modules/admin/admin.routes.js";
```

And add the route at the end, after `apiRouter.use("/uploads", uploadRouter);`:

```typescript
apiRouter.use("/admin", adminRouter);
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter api build`
Expected: Compiles without errors.

- [ ] **Step 4: Run all tests to verify nothing broke**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter api test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/admin/admin.routes.ts apps/api/src/router.ts
git commit -m "feat(api): add admin API routes for dashboard, academies, and transfers"
```

---

### Task 6: Install Clerk and Recharts in the web app

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install dependencies**

Run:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/web add @clerk/nextjs recharts
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add @clerk/nextjs and recharts dependencies"
```

---

### Task 7: Create Next.js Clerk provider and admin middleware

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/middleware.ts`
- Create: `apps/web/lib/api.ts`

- [ ] **Step 1: Wrap root layout with ClerkProvider**

Modify `apps/web/app/layout.tsx` to add the ClerkProvider. Add the import at the top:

```typescript
import { ClerkProvider } from "@clerk/nextjs";
```

Wrap the `<html>` element inside `<ClerkProvider>`:

```typescript
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="pt-BR" className={`${sora.variable} ${inter.variable}`}>
        <body className="font-[family-name:var(--font-inter)] antialiased">
          <Header />
          {children}
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Create Next.js middleware for admin route protection**

Create `apps/web/middleware.ts`:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isAdminLoginRoute = createRouteMatcher(["/admin/login(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req) && !isAdminLoginRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 3: Create API helper for admin requests**

Create `apps/web/lib/api.ts`:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

export async function adminFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}/admin${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Admin API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/web build`
Expected: Compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/middleware.ts apps/web/lib/api.ts
git commit -m "feat(web): add Clerk provider, admin route protection, and API helper"
```

---

### Task 8: Create admin layout and login page

**Files:**
- Create: `apps/web/app/admin/layout.tsx`
- Create: `apps/web/app/admin/login/[[...sign-in]]/page.tsx`

- [ ] **Step 1: Create admin layout with sidebar**

Create `apps/web/app/admin/layout.tsx`:

```tsx
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { LayoutDashboard, LogOut, Grid3x3 } from "lucide-react";

export const metadata = {
  title: "Tatame — Admin",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-[260px] flex-col border-r border-border bg-surface py-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-border px-6 pb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-[#242424]">
            <Grid3x3 className="h-[18px] w-[18px] text-primary" />
          </div>
          <span className="font-[family-name:var(--font-sora)] text-base font-bold tracking-[1px] text-text-primary">
            TATAME
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-0.5 px-3 pt-4">
          <Link
            href="/admin"
            className="flex h-[42px] items-center gap-2.5 rounded-[10px] bg-primary/[0.125] px-3 text-sm font-medium text-primary"
          >
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </Link>
        </nav>

        {/* Logout */}
        <div className="px-3">
          <SignOutButton redirectUrl="/admin/login">
            <button className="flex h-[42px] w-full items-center gap-2.5 rounded-[10px] px-3 text-sm text-text-secondary hover:bg-white/5">
              <LogOut className="h-5 w-5" />
              Sair
            </button>
          </SignOutButton>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create admin login page**

Create `apps/web/app/admin/login/[[...sign-in]]/page.tsx`:

```tsx
import { SignIn } from "@clerk/nextjs";
import { Grid3x3 } from "lucide-react";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8 rounded-[20px] border border-border bg-surface p-10">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-[14px] border border-border bg-[#242424]">
            <Grid3x3 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-[family-name:var(--font-sora)] text-[22px] font-extrabold tracking-[2px] text-text-primary">
            TATAME
          </h1>
          <p className="text-sm text-text-secondary">Painel Administrativo</p>
        </div>

        {/* Clerk SignIn */}
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "shadow-none bg-transparent",
              card: "bg-transparent shadow-none p-0",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton: "hidden",
              dividerRow: "hidden",
              formButtonPrimary:
                "bg-primary hover:bg-primary-dark rounded-xl h-[52px] text-base font-semibold",
              formFieldInput:
                "bg-background border-border rounded-xl h-[52px] text-text-primary",
              formFieldLabel: "text-text-secondary text-[13px] font-medium",
              footerAction: "hidden",
            },
          }}
          forceRedirectUrl="/admin"
          signUpUrl="/admin/login"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/web build`
Expected: Compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/admin/
git commit -m "feat(web): add admin layout with sidebar and login page"
```

---

### Task 9: Create admin dashboard page

**Files:**
- Create: `apps/web/app/admin/page.tsx`
- Create: `apps/web/app/admin/components/kpi-card.tsx`
- Create: `apps/web/app/admin/components/checkins-chart.tsx`

- [ ] **Step 1: Create reusable KPI card component**

Create `apps/web/app/admin/components/kpi-card.tsx`:

```tsx
type KpiCardProps = {
  label: string;
  value: string;
  subtitle?: string;
  valueColor?: string;
};

export function KpiCard({ label, value, subtitle, valueColor = "text-text-primary" }: KpiCardProps) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-[14px] border border-border bg-surface p-5">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <span className={`text-[28px] font-bold tracking-tight ${valueColor}`}>
        {value}
      </span>
      {subtitle && (
        <span className="text-xs font-medium text-text-muted">{subtitle}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create check-ins line chart component**

Create `apps/web/app/admin/components/checkins-chart.tsx`:

```tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type CheckinDataPoint = {
  date: string;
  count: number;
};

export function CheckinsChart({ data }: { data: CheckinDataPoint[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00Z").toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
    }),
  }));

  return (
    <div className="rounded-[14px] border border-border bg-surface p-5">
      <h3 className="mb-4 text-[13px] font-medium text-text-secondary">
        Check-ins diários (últimos 7 dias)
      </h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#ABABAB", fontSize: 12 }}
              axisLine={{ stroke: "#2A2A2A" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#ABABAB", fontSize: 12 }}
              axisLine={{ stroke: "#2A2A2A" }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1A1A1A",
                border: "1px solid #2A2A2A",
                borderRadius: 8,
                color: "#FFFFFF",
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#A078E8"
              strokeWidth={2}
              dot={{ fill: "#A078E8", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the dashboard page**

Create `apps/web/app/admin/page.tsx`:

```tsx
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { adminFetch } from "@/lib/api";
import { KpiCard } from "./components/kpi-card";
import { CheckinsChart } from "./components/checkins-chart";

type DashboardData = {
  activeSubscribers: number;
  totalUsers: number;
  appRevenueCents: number;
  transferredCents: number;
};

type FinancialSummary = {
  transferredCents: number;
  pendingTransferCents: number;
};

type CheckinItem = { date: string; count: number };

type AcademyItem = {
  id: string;
  name: string;
  managerPlan: string | null;
  managerPlanStatus: string | null;
  studentCount: number;
  pendingTransferCents: number;
};

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

export default async function AdminDashboardPage() {
  const { getToken } = await auth();
  const token = (await getToken()) ?? "";

  const [dashboard, financial, checkins, academies] = await Promise.all([
    adminFetch<DashboardData>("/dashboard", token),
    adminFetch<FinancialSummary>("/dashboard/financial-summary", token),
    adminFetch<{ items: CheckinItem[] }>("/dashboard/checkins", token),
    adminFetch<{ items: AcademyItem[] }>("/dashboard/academies", token),
  ]);

  return (
    <div className="flex flex-col gap-7 p-8 px-10">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-sora)] text-[26px] font-bold tracking-tight text-text-primary">
          Dashboard
        </h1>
        <p className="text-sm text-text-secondary">
          Resumo geral da operação Tatame
        </p>
      </div>

      {/* KPI Cards */}
      <div className="flex gap-4">
        <KpiCard
          label="Assinantes"
          value={dashboard.activeSubscribers.toLocaleString("pt-BR")}
        />
        <KpiCard
          label="Usuários"
          value={dashboard.totalUsers.toLocaleString("pt-BR")}
        />
        <KpiCard
          label="Receita Repassada"
          value={formatBRL(dashboard.appRevenueCents)}
        />
        <KpiCard
          label="Total Movimentado"
          value={formatBRL(dashboard.transferredCents)}
        />
      </div>

      {/* Checkins Chart */}
      <CheckinsChart data={checkins.items} />

      {/* Financial Summary */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">
          Resumo Financeiro
        </h2>
        <div className="flex gap-4">
          <KpiCard
            label="Total Repassado"
            value={formatBRL(financial.transferredCents)}
            valueColor="text-success"
          />
          <KpiCard
            label="A Repassar"
            value={formatBRL(financial.pendingTransferCents)}
            valueColor="text-[#FFD60A]"
          />
        </div>
      </div>

      {/* Academies Table */}
      <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
        <div className="flex h-12 items-center bg-[#242424] px-5">
          <span className="flex-1 text-xs font-medium text-text-secondary">
            Academia
          </span>
          <span className="w-24 text-xs font-medium text-text-secondary">
            Status
          </span>
          <span className="w-28 text-xs font-medium text-text-secondary">
            Plano
          </span>
          <span className="w-20 text-xs font-medium text-text-secondary">
            Alunos
          </span>
          <span className="w-32 text-right text-xs font-medium text-text-secondary">
            Pendência
          </span>
        </div>
        {academies.items.map((academy) => (
          <Link
            key={academy.id}
            href={`/admin/academies/${academy.id}`}
            className="flex h-[52px] items-center border-t border-border px-5 hover:bg-white/[0.02]"
          >
            <span className="flex-1 text-sm font-medium text-text-primary">
              {academy.name}
            </span>
            <span className="w-24">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  academy.managerPlanStatus === "active"
                    ? "bg-success/20 text-success"
                    : "bg-[#FFD60A]/20 text-[#FFD60A]"
                }`}
              >
                {academy.managerPlanStatus === "active" ? "Ativo" : "Pendente"}
              </span>
            </span>
            <span className="w-28 text-sm capitalize text-text-secondary">
              {academy.managerPlan ?? "—"}
            </span>
            <span className="w-20 text-sm text-text-secondary">
              {academy.studentCount}
            </span>
            <span
              className={`w-32 text-right text-sm font-semibold ${
                academy.pendingTransferCents > 0
                  ? "text-[#FFD60A]"
                  : "text-text-muted"
              }`}
            >
              {academy.pendingTransferCents > 0
                ? formatBRL(academy.pendingTransferCents)
                : "—"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/web build`
Expected: Compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/page.tsx apps/web/app/admin/components/
git commit -m "feat(web): add admin dashboard page with KPIs, chart, and academies table"
```

---

### Task 10: Create academy detail page with payments table and transfer actions

**Files:**
- Create: `apps/web/app/admin/academies/[id]/page.tsx`
- Create: `apps/web/app/admin/components/payments-table.tsx`
- Create: `apps/web/app/admin/actions.ts`

- [ ] **Step 1: Create server action for confirming transfers**

Create `apps/web/app/admin/actions.ts`:

```typescript
"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { adminFetch } from "@/lib/api";

export async function confirmTransfer(paymentIds: string[], academyId: string) {
  const { getToken } = await auth();
  const token = (await getToken()) ?? "";

  await adminFetch<{ updated: number }>("/payments/transfer", token, {
    method: "PATCH",
    body: JSON.stringify({ paymentIds }),
  });

  revalidatePath(`/admin/academies/${academyId}`);
  revalidatePath("/admin");
}
```

- [ ] **Step 2: Create the payments table client component**

Create `apps/web/app/admin/components/payments-table.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { confirmTransfer } from "../actions";

type Payment = {
  id: string;
  userName: string;
  amountCents: number;
  method: "manual" | "stripe" | "pix";
  referenceMonth: string;
  paidAt: string;
  transferredAt: string | null;
};

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function originLabel(method: string): { label: string; color: string } {
  return method === "manual"
    ? { label: "Manager", color: "bg-[#FFD60A]/20 text-[#FFD60A]" }
    : { label: "App", color: "bg-primary/20 text-primary" };
}

export function PaymentsTable({
  payments,
  academyId,
  total,
  limit,
  offset,
}: {
  payments: Payment[];
  academyId: string;
  total: number;
  limit: number;
  offset: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const appPending = payments.filter(
    (p) => p.method !== "manual" && !p.transferredAt,
  );
  const selectableIds = new Set(appPending.map((p) => p.id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === selectableIds.size) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  }

  function handleBulkTransfer() {
    const ids = Array.from(selected);
    startTransition(async () => {
      await confirmTransfer(ids, academyId);
      setSelected(new Set());
    });
  }

  function handleSingleTransfer(id: string) {
    startTransition(async () => {
      await confirmTransfer([id], academyId);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  const selectedTotal = payments
    .filter((p) => selected.has(p.id))
    .reduce((sum, p) => sum + p.amountCents, 0);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Pagamentos</h2>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex h-12 items-center justify-between rounded-[10px] bg-primary/[0.125] px-4">
          <div className="flex items-center gap-2 text-sm text-primary">
            <span className="font-medium">{selected.size} selecionados</span>
            <span className="text-text-muted">·</span>
            <span>Total: {formatBRL(selectedTotal)}</span>
          </div>
          <button
            onClick={handleBulkTransfer}
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {isPending ? "Processando..." : "Confirmar Repasse"}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
        {/* Header */}
        <div className="flex h-12 items-center bg-[#242424] px-4">
          <span className="w-10">
            {selectableIds.size > 0 && (
              <input
                type="checkbox"
                checked={selected.size === selectableIds.size && selectableIds.size > 0}
                onChange={toggleAll}
                className="accent-primary"
              />
            )}
          </span>
          <span className="flex-1 text-xs font-medium text-text-secondary">Aluno</span>
          <span className="w-24 text-xs font-medium text-text-secondary">Valor</span>
          <span className="w-20 text-xs font-medium text-text-secondary">Método</span>
          <span className="w-20 text-xs font-medium text-text-secondary">Origem</span>
          <span className="w-28 text-xs font-medium text-text-secondary">Repasse</span>
          <span className="w-24 text-xs font-medium text-text-secondary">Status</span>
          <span className="w-28 text-right text-xs font-medium text-text-secondary">Ação</span>
        </div>

        {/* Rows */}
        {payments.map((payment) => {
          const isApp = payment.method !== "manual";
          const isPendingTransfer = isApp && !payment.transferredAt;
          const origin = originLabel(payment.method);

          return (
            <div
              key={payment.id}
              className={`flex h-[52px] items-center border-t border-border px-4 ${
                selected.has(payment.id) ? "bg-primary/[0.06]" : ""
              }`}
            >
              <span className="w-10">
                {isPendingTransfer && (
                  <input
                    type="checkbox"
                    checked={selected.has(payment.id)}
                    onChange={() => toggleSelect(payment.id)}
                    className="accent-primary"
                  />
                )}
              </span>
              <span className="flex-1 text-sm text-text-primary">
                {payment.userName}
              </span>
              <span className="w-24 text-sm text-text-primary">
                {formatBRL(payment.amountCents)}
              </span>
              <span className="w-20">
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                  {payment.method}
                </span>
              </span>
              <span className="w-20">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${origin.color}`}>
                  {origin.label}
                </span>
              </span>
              <span className="w-28 text-sm">
                {payment.transferredAt ? (
                  <span className="text-success">
                    {formatDate(payment.transferredAt)}
                  </span>
                ) : isApp ? (
                  <span className="text-[#FFD60A]">Pendente</span>
                ) : (
                  <span className="text-text-muted">N/A</span>
                )}
              </span>
              <span className="w-24">
                <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-success">
                  Sucesso
                </span>
              </span>
              <span className="w-28 text-right">
                {isPendingTransfer && (
                  <button
                    onClick={() => handleSingleTransfer(payment.id)}
                    disabled={isPending}
                    className="rounded-lg bg-success px-3 py-1 text-xs font-medium text-white hover:bg-success/80 disabled:opacity-50"
                  >
                    Repassar
                  </button>
                )}
              </span>
            </div>
          );
        })}

        {/* Pagination */}
        <div className="flex h-[52px] items-center justify-between border-t border-border px-4">
          <span className="text-xs text-text-muted">
            Mostrando {offset + 1}-{Math.min(offset + limit, total)} de {total} pagamentos
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <a
                href={`?limit=${limit}&offset=${offset - limit}`}
                className="rounded-lg border border-border px-3 py-1 text-xs text-text-secondary hover:bg-white/5"
              >
                Anterior
              </a>
            )}
            {currentPage < totalPages && (
              <a
                href={`?limit=${limit}&offset=${offset + limit}`}
                className="rounded-lg border border-border px-3 py-1 text-xs text-text-secondary hover:bg-white/5"
              >
                Próximo
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the academy detail page**

Create `apps/web/app/admin/academies/[id]/page.tsx`:

```tsx
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { ArrowLeft, User } from "lucide-react";
import { adminFetch } from "@/lib/api";
import { KpiCard } from "../../components/kpi-card";
import { PaymentsTable } from "../../components/payments-table";

type AcademyDetail = {
  academy: {
    id: string;
    name: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string | null;
    managerPlan: string | null;
    managerPlanStatus: string | null;
  };
  studentCount: number;
  revenueCentsCurrentMonth: number;
  transferredCents: number;
  pendingTransferCents: number;
};

type PaymentItem = {
  id: string;
  userName: string;
  amountCents: number;
  method: "manual" | "stripe" | "pix";
  referenceMonth: string;
  paidAt: string;
  transferredAt: string | null;
};

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

export default async function AcademyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ limit?: string; offset?: string }>;
}) {
  const { id } = await params;
  const { limit: limitStr, offset: offsetStr } = await searchParams;
  const limit = Number(limitStr) || 20;
  const offset = Number(offsetStr) || 0;

  const { getToken } = await auth();
  const token = (await getToken()) ?? "";

  const [detail, paymentsData] = await Promise.all([
    adminFetch<AcademyDetail>(`/academies/${id}`, token),
    adminFetch<{ items: PaymentItem[]; total: number }>(
      `/academies/${id}/payments?limit=${limit}&offset=${offset}`,
      token,
    ),
  ]);

  const { academy } = detail;

  return (
    <div className="flex flex-col gap-6 p-8 px-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface"
        >
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <div className="flex flex-col gap-0.5">
          <h1 className="font-[family-name:var(--font-sora)] text-[26px] font-bold tracking-tight text-text-primary">
            {academy.name}
          </h1>
          <p className="text-sm text-text-secondary">Resumo da academia</p>
        </div>
      </div>

      {/* Manager Info */}
      <div className="flex items-center gap-3.5 rounded-[14px] border border-border bg-surface px-5 py-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/[0.125]">
          <User className="h-[22px] w-[22px] text-primary" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-text-muted">Responsável</span>
          <span className="text-[15px] font-semibold text-text-primary">
            {academy.ownerName}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-text-muted">E-mail</span>
          <span className="text-sm text-text-secondary">{academy.ownerEmail}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-text-muted">Telefone</span>
          <span className="text-sm text-text-secondary">
            {academy.ownerPhone ?? "—"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-text-muted">Plano</span>
          <span className="rounded-md bg-primary/[0.125] px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
            {academy.managerPlan ?? "—"}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="flex gap-4">
        <KpiCard label="Alunos" value={detail.studentCount.toLocaleString("pt-BR")} />
        <KpiCard label="Receita no Mês" value={formatBRL(detail.revenueCentsCurrentMonth)} />
        <KpiCard
          label="Já Repassado"
          value={formatBRL(detail.transferredCents)}
          valueColor="text-success"
        />
        <KpiCard
          label="A Repassar"
          value={formatBRL(detail.pendingTransferCents)}
          valueColor="text-[#FFD60A]"
        />
      </div>

      {/* Payments Table */}
      <PaymentsTable
        payments={paymentsData.items}
        academyId={id}
        total={paymentsData.total}
        limit={limit}
        offset={offset}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/web build`
Expected: Compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/academies/ apps/web/app/admin/components/payments-table.tsx apps/web/app/admin/actions.ts
git commit -m "feat(web): add academy detail page with payments table and transfer actions"
```

---

### Task 11: Add `NEXT_PUBLIC_API_URL` and `ADMIN_EMAIL` to `.env`

**Files:**
- Modify: `.env`

- [ ] **Step 1: Add the environment variables**

Add to the `.env` file at the project root:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/v1
ADMIN_EMAIL=<your-email-here>
```

Replace `<your-email-here>` with the actual admin email.

- [ ] **Step 2: Do NOT commit** (`.env` should be in `.gitignore`)

---

### Task 12: End-to-end verification

- [ ] **Step 1: Start the API**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter api dev`
Expected: API starts on port 3001.

- [ ] **Step 2: Start the web app**

Run (in another terminal): `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/web dev`
Expected: Next.js starts on port 3000.

- [ ] **Step 3: Test admin login**

Open `http://localhost:3000/admin` in a browser.
Expected: Redirects to `/admin/login`. After signing in with the admin email, redirects to `/admin` dashboard.

- [ ] **Step 4: Test dashboard loads data**

Expected: KPI cards show numbers, chart renders, academy table shows entries.

- [ ] **Step 5: Test academy detail**

Click on an academy row.
Expected: Navigates to `/admin/academies/:id`, shows manager info, KPIs, and payments table.

- [ ] **Step 6: Test transfer confirmation**

Select a pending payment checkbox and click "Confirmar Repasse".
Expected: Payment moves from "Pendente" to showing the transfer date. KPI values update.

- [ ] **Step 7: Test non-admin access denied**

Sign in with a different email.
Expected: Gets 403 from the API, cannot access admin pages.

- [ ] **Step 8: Run all tests**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter api test`
Expected: All tests pass including the new admin service tests.
