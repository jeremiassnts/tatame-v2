# Manager Subscription — RevenueCat IAP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the manager Pro subscription from Stripe Checkout to RevenueCat-backed In-App Purchase on iOS and Android, passing Apple Guideline 3.1.1, while keeping student payments on their existing flows.

**Architecture:** Mobile uses `react-native-purchases` SDK to drive native IAP (StoreKit / Play Billing). RevenueCat validates receipts and posts webhooks to the API, which mirrors state into the `manager_subscriptions` table. Backend remains the entitlement source of truth for feature-gating; polling `GET /manager-subscriptions/me` is kept as fallback.

**Tech Stack:** Expo 54 / React Native 0.81 / `react-native-purchases` 8.x (mobile). Express 4 / Drizzle / Postgres / vitest (backend). RevenueCat (SaaS) for IAP abstraction.

**Spec:** `docs/superpowers/specs/2026-04-16-manager-revenuecat-iap-design.md`

---

## Operational Prerequisites (run BEFORE implementation)

These happen in external consoles, not in code. The implementation tasks assume these are done (or will be done before deploy).

- [ ] **Bundle / package identifier** — pick final ID (e.g. `br.com.tatame.app`). Update `apps/mobile/app.json` `ios.bundleIdentifier` and `android.package` to match. **Required before creating store apps — once published, the ID is immutable.**
- [ ] **App Store Connect** — register app with final bundle ID → create auto-renewable subscription product (Reference Name `Tatame Pro Monthly`, Product ID `tatame_pro_monthly`, subscription group `tatame_pro`, duration 1 month, price R$ 49,00 for Brazil). Create at least one sandbox tester.
- [ ] **Google Play Console** — register app with final package name → create subscription product `tatame_pro_monthly`, monthly R$ 49,00 base plan. Add license testers.
- [ ] **RevenueCat** — create project "Tatame" → add iOS app (App-Specific Shared Secret + API key) and Android app (Google Cloud Service Account JSON with Play Developer API). Create Entitlement `pro`. Import both products and attach them to `pro`. Create Offering `default` with one Package `$rc_monthly` wired to both products.
- [ ] **RevenueCat API keys** — copy iOS SDK Key → `EXPO_PUBLIC_REVENUECAT_IOS_KEY`. Android SDK Key → `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. Secret API Key → `REVENUECAT_SECRET_API_KEY`.
- [ ] **RevenueCat webhook** — Project Settings → Integrations → Webhooks → URL `https://<API_PUBLIC_URL>/v1/webhooks/revenuecat`. Generate a strong token → `REVENUECAT_WEBHOOK_SECRET` (sent as Authorization header).
- [ ] **Env files** — add `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_WEBHOOK_SECRET` to API `.env` (local + production provider). Add `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` to mobile `.env` and to EAS secrets (`eas secret:create`).
- [ ] **EAS** — run `eas build --profile development --platform ios` and `--platform android` once after adding the dependency, since IAP doesn't run in Expo Go.

---

## Task 1: Schema — add RevenueCat columns to `manager_subscriptions`

**Files:**
- Modify: `packages/db/src/schema/index.ts` (around line 260)

- [ ] **Step 1: Edit the schema**

Replace the current `managerSubscriptions` table block and add the store enum. Keep `managerPlanEnum` and `managerSubscriptionStatusEnum` as they are.

Find (near line 50):
```ts
export const managerSubscriptionStatusEnum = pgEnum(
  "manager_subscription_status",
  ["active", "past_due", "canceled", "incomplete"],
);
```

Add immediately after it:
```ts
export const managerSubscriptionStoreEnum = pgEnum(
  "manager_subscription_store",
  ["app_store", "play_store"],
);
```

Find (line ~260) and replace:
```ts
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

With:
```ts
export const managerSubscriptions = pgTable("manager_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id")
    .notNull()
    .references(() => academies.id, { onDelete: "cascade" })
    .unique(),
  plan: managerPlanEnum("plan").notNull(),
  status: managerSubscriptionStatusEnum("status").notNull(),
  revenuecatAppUserId: text("revenuecat_app_user_id").unique(),
  productId: text("product_id"),
  originalTransactionId: text("original_transaction_id"),
  store: managerSubscriptionStoreEnum("store"),
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

- [ ] **Step 2: Generate the migration**

```bash
pnpm --filter @tatame/db exec drizzle-kit generate
```

Expected: a new file `packages/db/drizzle/0007_*.sql` containing `ALTER TABLE manager_subscriptions DROP COLUMN stripe_customer_id`, `DROP COLUMN stripe_subscription_id`, `ADD COLUMN revenuecat_app_user_id text UNIQUE`, `ADD COLUMN product_id text`, `ADD COLUMN original_transaction_id text`, `ADD COLUMN store manager_subscription_store`, plus a `CREATE TYPE manager_subscription_store AS ENUM ('app_store', 'play_store')` statement.

- [ ] **Step 3: Inspect the migration file**

Open the new `packages/db/drizzle/0007_*.sql` and confirm it drops the two Stripe columns and adds the four new columns + enum. If the generated name is awkward, leave it (Drizzle's auto-naming is fine).

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/index.ts packages/db/drizzle/
git commit -m "feat(db): add RevenueCat columns to manager_subscriptions

Drops stripeCustomerId/stripeSubscriptionId, adds revenuecatAppUserId,
productId, originalTransactionId, store. Safe because there are no
production subscribers yet."
```

---

## Task 2: Repository interface — replace Stripe lookups with RevenueCat

**Files:**
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.repository.ts`

- [ ] **Step 1: Rewrite the interface**

Replace the entire file contents:

```ts
import type { InferSelectModel } from "drizzle-orm";
import type { managerSubscriptions } from "@tatame/db";

export type ManagerSubscriptionRow = InferSelectModel<
  typeof managerSubscriptions
>;

export type ManagerSubscriptionStore = "app_store" | "play_store";

export interface IManagerSubscriptionRepository {
  findByAcademyId(
    academyId: string,
  ): Promise<ManagerSubscriptionRow | undefined>;

  findByRevenueCatAppUserId(
    appUserId: string,
  ): Promise<ManagerSubscriptionRow | undefined>;

  create(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "past_due" | "canceled" | "incomplete";
    revenuecatAppUserId?: string | null;
    productId?: string | null;
    originalTransactionId?: string | null;
    store?: ManagerSubscriptionStore | null;
    currentPeriodEnd?: Date | null;
  }): Promise<ManagerSubscriptionRow>;

  update(
    id: string,
    data: Partial<{
      plan: "free" | "pro";
      status: "active" | "past_due" | "canceled" | "incomplete";
      revenuecatAppUserId: string | null;
      productId: string | null;
      originalTransactionId: string | null;
      store: ManagerSubscriptionStore | null;
      currentPeriodEnd: Date | null;
      canceledAt: Date | null;
      subscribedAt: Date;
    }>,
  ): Promise<ManagerSubscriptionRow | undefined>;

  upsertByAcademy(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "past_due" | "canceled" | "incomplete";
    revenuecatAppUserId?: string | null;
    productId?: string | null;
    originalTransactionId?: string | null;
    store?: ManagerSubscriptionStore | null;
    currentPeriodEnd?: Date | null;
    canceledAt?: Date | null;
    subscribedAt?: Date;
  }): Promise<ManagerSubscriptionRow>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/manager-subscription/manager-subscription.repository.ts
git commit -m "refactor(api): replace Stripe-specific repo methods with RevenueCat equivalents"
```

---

## Task 3: Update in-memory repository

**Files:**
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.repository.in-memory.ts`

- [ ] **Step 1: Rewrite the in-memory repository**

Replace the entire file contents:

```ts
import { randomUUID } from "node:crypto";
import type {
  IManagerSubscriptionRepository,
  ManagerSubscriptionRow,
  ManagerSubscriptionStore,
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

  async findByRevenueCatAppUserId(
    appUserId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    return this.rows.find((r) => r.revenuecatAppUserId === appUserId);
  }

  async create(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "past_due" | "canceled" | "incomplete";
    revenuecatAppUserId?: string | null;
    productId?: string | null;
    originalTransactionId?: string | null;
    store?: ManagerSubscriptionStore | null;
    currentPeriodEnd?: Date | null;
  }): Promise<ManagerSubscriptionRow> {
    const t = new Date();
    const row: ManagerSubscriptionRow = {
      id: randomUUID(),
      academyId: data.academyId,
      plan: data.plan,
      status: data.status,
      revenuecatAppUserId: data.revenuecatAppUserId ?? null,
      productId: data.productId ?? null,
      originalTransactionId: data.originalTransactionId ?? null,
      store: data.store ?? null,
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
      revenuecatAppUserId: string | null;
      productId: string | null;
      originalTransactionId: string | null;
      store: ManagerSubscriptionStore | null;
      currentPeriodEnd: Date | null;
      canceledAt: Date | null;
      subscribedAt: Date;
    }>,
  ): Promise<ManagerSubscriptionRow | undefined> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return undefined;
    if (data.plan !== undefined) row.plan = data.plan;
    if (data.status !== undefined) row.status = data.status;
    if (data.revenuecatAppUserId !== undefined)
      row.revenuecatAppUserId = data.revenuecatAppUserId;
    if (data.productId !== undefined) row.productId = data.productId;
    if (data.originalTransactionId !== undefined)
      row.originalTransactionId = data.originalTransactionId;
    if (data.store !== undefined) row.store = data.store;
    if (data.currentPeriodEnd !== undefined)
      row.currentPeriodEnd = data.currentPeriodEnd;
    if (data.canceledAt !== undefined) row.canceledAt = data.canceledAt;
    if (data.subscribedAt !== undefined) row.subscribedAt = data.subscribedAt;
    row.updatedAt = new Date();
    return row;
  }

  async upsertByAcademy(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "past_due" | "canceled" | "incomplete";
    revenuecatAppUserId?: string | null;
    productId?: string | null;
    originalTransactionId?: string | null;
    store?: ManagerSubscriptionStore | null;
    currentPeriodEnd?: Date | null;
    canceledAt?: Date | null;
    subscribedAt?: Date;
  }): Promise<ManagerSubscriptionRow> {
    const existing = await this.findByAcademyId(data.academyId);
    if (existing) {
      const updated = await this.update(existing.id, {
        plan: data.plan,
        status: data.status,
        revenuecatAppUserId: data.revenuecatAppUserId ?? null,
        productId: data.productId ?? null,
        originalTransactionId: data.originalTransactionId ?? null,
        store: data.store ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        canceledAt: data.canceledAt ?? null,
        ...(data.subscribedAt ? { subscribedAt: data.subscribedAt } : {}),
      });
      return updated!;
    }
    return this.create({
      academyId: data.academyId,
      plan: data.plan,
      status: data.status,
      revenuecatAppUserId: data.revenuecatAppUserId,
      productId: data.productId,
      originalTransactionId: data.originalTransactionId,
      store: data.store,
      currentPeriodEnd: data.currentPeriodEnd,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/manager-subscription/manager-subscription.repository.in-memory.ts
git commit -m "refactor(api): update in-memory manager subscription repo for RevenueCat"
```

---

## Task 4: Update Postgres repository

**Files:**
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.repository.postgres.ts`

- [ ] **Step 1: Rewrite the Postgres repository**

Replace the entire file contents:

```ts
import { eq } from "drizzle-orm";
import { managerSubscriptions, type Database } from "@tatame/db";
import type {
  IManagerSubscriptionRepository,
  ManagerSubscriptionRow,
  ManagerSubscriptionStore,
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

  async findByRevenueCatAppUserId(
    appUserId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(managerSubscriptions)
      .where(eq(managerSubscriptions.revenuecatAppUserId, appUserId))
      .limit(1);
    return row;
  }

  async create(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "past_due" | "canceled" | "incomplete";
    revenuecatAppUserId?: string | null;
    productId?: string | null;
    originalTransactionId?: string | null;
    store?: ManagerSubscriptionStore | null;
    currentPeriodEnd?: Date | null;
  }): Promise<ManagerSubscriptionRow> {
    const rows = await this.db
      .insert(managerSubscriptions)
      .values({
        academyId: data.academyId,
        plan: data.plan,
        status: data.status,
        revenuecatAppUserId: data.revenuecatAppUserId ?? null,
        productId: data.productId ?? null,
        originalTransactionId: data.originalTransactionId ?? null,
        store: data.store ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create manager subscription");
    }
    return row;
  }

  async update(
    id: string,
    data: Partial<{
      plan: "free" | "pro";
      status: "active" | "past_due" | "canceled" | "incomplete";
      revenuecatAppUserId: string | null;
      productId: string | null;
      originalTransactionId: string | null;
      store: ManagerSubscriptionStore | null;
      currentPeriodEnd: Date | null;
      canceledAt: Date | null;
      subscribedAt: Date;
    }>,
  ): Promise<ManagerSubscriptionRow | undefined> {
    const rows = await this.db
      .update(managerSubscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(managerSubscriptions.id, id))
      .returning();
    return rows[0];
  }

  async upsertByAcademy(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "past_due" | "canceled" | "incomplete";
    revenuecatAppUserId?: string | null;
    productId?: string | null;
    originalTransactionId?: string | null;
    store?: ManagerSubscriptionStore | null;
    currentPeriodEnd?: Date | null;
    canceledAt?: Date | null;
    subscribedAt?: Date;
  }): Promise<ManagerSubscriptionRow> {
    const rows = await this.db
      .insert(managerSubscriptions)
      .values({
        academyId: data.academyId,
        plan: data.plan,
        status: data.status,
        revenuecatAppUserId: data.revenuecatAppUserId ?? null,
        productId: data.productId ?? null,
        originalTransactionId: data.originalTransactionId ?? null,
        store: data.store ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        canceledAt: data.canceledAt ?? null,
        ...(data.subscribedAt ? { subscribedAt: data.subscribedAt } : {}),
      })
      .onConflictDoUpdate({
        target: managerSubscriptions.academyId,
        set: {
          plan: data.plan,
          status: data.status,
          revenuecatAppUserId: data.revenuecatAppUserId ?? null,
          productId: data.productId ?? null,
          originalTransactionId: data.originalTransactionId ?? null,
          store: data.store ?? null,
          currentPeriodEnd: data.currentPeriodEnd ?? null,
          canceledAt: data.canceledAt ?? null,
          ...(data.subscribedAt ? { subscribedAt: data.subscribedAt } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("Failed to upsert manager subscription");
    }
    return row;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/manager-subscription/manager-subscription.repository.postgres.ts
git commit -m "refactor(api): update postgres manager subscription repo for RevenueCat"
```

---

## Task 5: Update test factory

**Files:**
- Modify: `apps/api/src/testing/factories/index.ts` (around line 214)

- [ ] **Step 1: Update `makeManagerSubscription`**

Find:
```ts
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

Replace with:
```ts
export function makeManagerSubscription(
  overrides: Partial<ManagerSubscriptionRow> = {},
): ManagerSubscriptionRow {
  const t = faker.date.recent({ days: 14 });
  return {
    id: rid(),
    academyId: rid(),
    plan: "free",
    status: "active",
    revenuecatAppUserId: null,
    productId: null,
    originalTransactionId: null,
    store: null,
    currentPeriodEnd: null,
    subscribedAt: t,
    canceledAt: null,
    createdAt: t,
    updatedAt: t,
    ...overrides,
  };
}
```

- [ ] **Step 2: Run the existing service test to confirm it still passes**

```bash
pnpm --filter @tatame/api test -- manager-subscription.service.test.ts
```

Expected: PASS. If a failure mentions `stripeCustomerId` or `stripeSubscriptionId`, fix that assertion to use the new fields (the existing test in `manager-subscription.service.test.ts` asserts `result.stripeCustomerId` on line 58 — update to assert `result.revenuecatAppUserId` instead).

- [ ] **Step 3: Update the one assertion in service test**

File: `apps/api/src/modules/manager-subscription/manager-subscription.service.test.ts`

Find:
```ts
expect(result.stripeCustomerId).toBeNull();
```

Replace with:
```ts
expect(result.revenuecatAppUserId).toBeNull();
```

Re-run: `pnpm --filter @tatame/api test -- manager-subscription.service.test.ts` → PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/testing/factories/index.ts apps/api/src/modules/manager-subscription/manager-subscription.service.test.ts
git commit -m "test(api): update manager subscription factory and service test for RevenueCat fields"
```

---

## Task 6: Env schema — add RevenueCat vars, remove `STRIPE_PRO_PRICE_ID`

**Files:**
- Modify: `packages/config/src/env.ts`

- [ ] **Step 1: Update the zod schema**

Find:
```ts
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
```

Replace with:
```ts
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  REVENUECAT_SECRET_API_KEY: z.string().optional(),
  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),
```

- [ ] **Step 2: Rebuild config package types**

```bash
pnpm --filter @tatame/config build
```

Expected: success. If the build fails, the error is likely in `packages/config/dist/env.d.ts` — re-run build which regenerates it.

- [ ] **Step 3: Commit**

```bash
git add packages/config/
git commit -m "feat(config): add RevenueCat env vars, remove STRIPE_PRO_PRICE_ID"
```

---

## Task 7: RevenueCat server-side client

**Files:**
- Create: `apps/api/src/modules/manager-subscription/revenuecat-client.ts`

- [ ] **Step 1: Write the client**

```ts
import { logger } from "../../lib/logger.js";

/** Minimal shape of a subscriber response from the RevenueCat REST API. */
export type RevenueCatSubscriber = {
  subscriber: {
    original_app_user_id: string;
    entitlements: Record<
      string,
      {
        expires_date: string | null;
        product_identifier: string;
        grace_period_expires_date: string | null;
        purchase_date: string;
        unsubscribe_detected_at: string | null;
        billing_issues_detected_at: string | null;
      }
    >;
    subscriptions: Record<
      string,
      {
        expires_date: string | null;
        period_type: "normal" | "trial" | "intro";
        store: "app_store" | "play_store" | "promotional" | "stripe";
        unsubscribe_detected_at: string | null;
        billing_issues_detected_at: string | null;
        refunded_at: string | null;
        original_purchase_date: string;
      }
    >;
  };
};

export class RevenueCatClient {
  constructor(
    private readonly secretApiKey: string,
    private readonly baseUrl: string = "https://api.revenuecat.com/v1",
  ) {}

  async getSubscriber(appUserId: string): Promise<RevenueCatSubscriber | null> {
    const res = await fetch(
      `${this.baseUrl}/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${this.secretApiKey}`,
          Accept: "application/json",
        },
      },
    );

    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn(
        { appUserId, status: res.status, body },
        "[revenuecat] getSubscriber non-2xx",
      );
      throw new Error(`RevenueCat getSubscriber failed: ${res.status}`);
    }
    return (await res.json()) as RevenueCatSubscriber;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/manager-subscription/revenuecat-client.ts
git commit -m "feat(api): add RevenueCat server-side client for subscriber lookups"
```

---

## Task 8: Webhook event types

**Files:**
- Create: `apps/api/src/modules/manager-subscription/revenuecat-events.ts`

- [ ] **Step 1: Write the event shape**

```ts
/**
 * Shape of a RevenueCat webhook payload.
 * Reference: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export type RevenueCatEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "PRODUCT_CHANGE"
  | "SUBSCRIPTION_PAUSED"
  | "REFUND"
  | "TEST"
  | "TRANSFER"
  | "SUBSCRIBER_ALIAS"
  | "NON_RENEWING_PURCHASE";

export type RevenueCatStore = "APP_STORE" | "PLAY_STORE" | "PROMOTIONAL" | "STRIPE";

export type RevenueCatEvent = {
  event: {
    type: RevenueCatEventType;
    id: string;
    app_user_id: string;
    original_app_user_id?: string;
    product_id?: string;
    original_transaction_id?: string;
    transaction_id?: string;
    store?: RevenueCatStore;
    /** Unix ms. */
    event_timestamp_ms: number;
    /** Unix ms. */
    expiration_at_ms?: number;
    /** Unix ms. Only on CANCELLATION. */
    cancel_reason?: string;
    environment?: "SANDBOX" | "PRODUCTION";
  };
  api_version: string;
};

export function mapStoreToDb(
  store: RevenueCatStore | undefined,
): "app_store" | "play_store" | null {
  if (store === "APP_STORE") return "app_store";
  if (store === "PLAY_STORE") return "play_store";
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/manager-subscription/revenuecat-events.ts
git commit -m "feat(api): add RevenueCat webhook event type definitions"
```

---

## Task 8b: Add `findByOwnerId` to academy repository

The webhook handler needs to resolve an academy from a Clerk user ID (the webhook has no auth middleware). The current `IAcademyRepository` exposes `existsByOwner` but not a method returning the full row(s). We add one.

**Files:**
- Modify: `apps/api/src/modules/academy/academy.repository.ts`
- Modify: `apps/api/src/modules/academy/academy.repository.postgres.ts`
- Modify: `apps/api/src/modules/academy/academy.repository.in-memory.ts`

- [ ] **Step 1: Extend the interface**

In `academy.repository.ts`, add this method signature to `IAcademyRepository` (between `existsByOwner` and `getStats`):

```ts
  findByOwnerId(ownerId: string): Promise<AcademyRow[]>;
```

- [ ] **Step 2: Implement in Postgres repo**

In `academy.repository.postgres.ts`, add the method. Use the same pattern as `existsByOwner` (which already queries `academies.ownerId === userId`). Example:

```ts
  async findByOwnerId(ownerId: string): Promise<AcademyRow[]> {
    return this.db
      .select()
      .from(academies)
      .where(eq(academies.ownerId, ownerId));
  }
```

- [ ] **Step 3: Implement in in-memory repo**

In `academy.repository.in-memory.ts`, add:

```ts
  async findByOwnerId(ownerId: string): Promise<AcademyRow[]> {
    return this.rows.filter((r) => r.ownerId === ownerId);
  }
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @tatame/api exec tsc --noEmit
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/academy/
git commit -m "feat(api): add findByOwnerId to academy repository"
```

---

## Task 9: Webhook handler — TDD scaffold + INITIAL_PURCHASE

**Files:**
- Create: `apps/api/src/modules/manager-subscription/revenuecat-webhook.handler.ts`
- Create: `apps/api/src/modules/manager-subscription/revenuecat-webhook.handler.test.ts`

- [ ] **Step 1: Write the failing test for INITIAL_PURCHASE**

```ts
// apps/api/src/modules/manager-subscription/revenuecat-webhook.handler.test.ts
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import { InMemoryUserRepository } from "../user/user.repository.in-memory.js";
import {
  makeAcademy,
  makeManagerSubscription,
  makeUser,
} from "../../testing/factories/index.js";
import { InMemoryManagerSubscriptionRepository } from "./manager-subscription.repository.in-memory.js";
import { RevenueCatWebhookHandler } from "./revenuecat-webhook.handler.js";
import type { RevenueCatEvent } from "./revenuecat-events.js";

function setup() {
  const userId = randomUUID();
  const user = makeUser({ id: userId });
  const academy = makeAcademy({ ownerId: userId });
  const existingSub = makeManagerSubscription({
    academyId: academy.id,
    plan: "free",
    status: "active",
  });

  const subRepo = new InMemoryManagerSubscriptionRepository([existingSub]);
  const userRepo = new InMemoryUserRepository([user]);
  const acadRepo = new InMemoryAcademyRepository([academy]);

  const emailService = {
    sendProActivated: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionCanceled: vi.fn().mockResolvedValue(undefined),
  };

  const handler = new RevenueCatWebhookHandler(
    subRepo,
    userRepo,
    acadRepo,
    emailService as any,
  );

  return { handler, subRepo, userRepo, acadRepo, emailService, user, academy };
}

function initialPurchaseEvent(userId: string, overrides: Partial<RevenueCatEvent["event"]> = {}): RevenueCatEvent {
  return {
    event: {
      type: "INITIAL_PURCHASE",
      id: randomUUID(),
      app_user_id: userId,
      product_id: "tatame_pro_monthly",
      original_transaction_id: "1000000000000000",
      store: "APP_STORE",
      event_timestamp_ms: Date.now(),
      expiration_at_ms: Date.now() + 30 * 24 * 3600 * 1000,
      environment: "PRODUCTION",
      ...overrides,
    },
    api_version: "1.0",
  };
}

describe("RevenueCatWebhookHandler", () => {
  describe("INITIAL_PURCHASE", () => {
    it("upserts the subscription to plan=pro, status=active, fills RevenueCat fields", async () => {
      const { handler, subRepo, user, academy } = setup();

      await handler.handleEvent(initialPurchaseEvent(user.id));

      const sub = await subRepo.findByAcademyId(academy.id);
      expect(sub).toBeDefined();
      expect(sub!.plan).toBe("pro");
      expect(sub!.status).toBe("active");
      expect(sub!.revenuecatAppUserId).toBe(user.id);
      expect(sub!.productId).toBe("tatame_pro_monthly");
      expect(sub!.originalTransactionId).toBe("1000000000000000");
      expect(sub!.store).toBe("app_store");
      expect(sub!.canceledAt).toBeNull();
      expect(sub!.currentPeriodEnd).toBeInstanceOf(Date);
    });

    it("enqueues the pro-activated email", async () => {
      const { handler, emailService, user } = setup();

      await handler.handleEvent(initialPurchaseEvent(user.id));

      expect(emailService.sendProActivated).toHaveBeenCalledOnce();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @tatame/api test -- revenuecat-webhook.handler.test.ts
```

Expected: FAIL with `Cannot find module './revenuecat-webhook.handler.js'` or similar.

- [ ] **Step 3: Implement the handler skeleton + INITIAL_PURCHASE**

```ts
// apps/api/src/modules/manager-subscription/revenuecat-webhook.handler.ts
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { EmailService } from "../email/email.service.js";
import type { IUserRepository } from "../user/user.repository.js";
import { logger } from "../../lib/logger.js";
import type { IManagerSubscriptionRepository } from "./manager-subscription.repository.js";
import { mapStoreToDb, type RevenueCatEvent } from "./revenuecat-events.js";

export class RevenueCatWebhookHandler {
  constructor(
    private readonly subRepo: IManagerSubscriptionRepository,
    private readonly userRepo: IUserRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly emailService: EmailService | null,
  ) {}

  async handleEvent(payload: RevenueCatEvent): Promise<void> {
    const { event } = payload;

    logger.info(
      {
        type: event.type,
        app_user_id: event.app_user_id,
        product_id: event.product_id,
        original_transaction_id: event.original_transaction_id,
        environment: event.environment,
      },
      "[revenuecat] webhook event received",
    );

    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "PRODUCT_CHANGE":
        await this.onPurchase(payload, event.type === "INITIAL_PURCHASE");
        break;
      case "CANCELLATION":
        await this.onCancellation(payload);
        break;
      case "UNCANCELLATION":
        await this.onUncancellation(payload);
        break;
      case "EXPIRATION":
      case "REFUND":
        await this.onExpiration(payload);
        break;
      case "BILLING_ISSUE":
      case "SUBSCRIPTION_PAUSED":
        await this.onBillingIssue(payload);
        break;
      default:
        // TEST, TRANSFER, SUBSCRIBER_ALIAS, NON_RENEWING_PURCHASE — ignore.
        break;
    }
  }

  private async resolveAcademyForUser(appUserId: string) {
    const user = await this.userRepo.findById(appUserId);
    if (!user) {
      logger.warn({ appUserId }, "[revenuecat] user not found for app_user_id");
      return null;
    }
    // academies.ownerId → manager's own academy.
    const academies = await this.academyRepo.findByOwnerId(user.id);
    const academy = academies?.[0];
    if (!academy) {
      logger.warn({ userId: user.id }, "[revenuecat] no owned academy for user");
      return null;
    }
    return { user, academy };
  }

  private async onPurchase(
    payload: RevenueCatEvent,
    isInitial: boolean,
  ): Promise<void> {
    const { event } = payload;
    const ctx = await this.resolveAcademyForUser(event.app_user_id);
    if (!ctx) return;

    const currentPeriodEnd =
      typeof event.expiration_at_ms === "number"
        ? new Date(event.expiration_at_ms)
        : null;

    const row = await this.subRepo.upsertByAcademy({
      academyId: ctx.academy.id,
      plan: "pro",
      status: "active",
      revenuecatAppUserId: event.app_user_id,
      productId: event.product_id ?? null,
      originalTransactionId: event.original_transaction_id ?? null,
      store: mapStoreToDb(event.store),
      currentPeriodEnd,
      canceledAt: null,
      subscribedAt: isInitial ? new Date(event.event_timestamp_ms) : undefined,
    });

    if (isInitial && this.emailService) {
      await this.emailService.sendProActivated(
        {
          email: ctx.user.email,
          managerName: ctx.user.name,
          academyName: ctx.academy.name,
        },
        row.originalTransactionId ?? row.id,
      );
    }
  }

  private async onCancellation(_payload: RevenueCatEvent): Promise<void> {
    // TODO next task
  }

  private async onUncancellation(_payload: RevenueCatEvent): Promise<void> {
    // TODO next task
  }

  private async onExpiration(_payload: RevenueCatEvent): Promise<void> {
    // TODO next task
  }

  private async onBillingIssue(_payload: RevenueCatEvent): Promise<void> {
    // TODO next task
  }
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @tatame/api exec tsc --noEmit
```

Expected: success. `findByOwnerId` on `IAcademyRepository` was added in Task 8b.

- [ ] **Step 5: Run the test**

```bash
pnpm --filter @tatame/api test -- revenuecat-webhook.handler.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/manager-subscription/revenuecat-webhook.handler.ts \
        apps/api/src/modules/manager-subscription/revenuecat-webhook.handler.test.ts
git commit -m "feat(api): add RevenueCat webhook handler with INITIAL_PURCHASE support"
```

---

## Task 10: Webhook handler — CANCELLATION + UNCANCELLATION

**Files:**
- Modify: `apps/api/src/modules/manager-subscription/revenuecat-webhook.handler.ts`
- Modify: `apps/api/src/modules/manager-subscription/revenuecat-webhook.handler.test.ts`

- [ ] **Step 1: Write failing tests**

Append to the test file inside `describe("RevenueCatWebhookHandler", ...)`:

```ts
  describe("CANCELLATION", () => {
    it("sets canceledAt while keeping status=active and plan=pro", async () => {
      const { handler, subRepo, user, academy } = setup();
      await handler.handleEvent(initialPurchaseEvent(user.id));

      await handler.handleEvent({
        event: {
          type: "CANCELLATION",
          id: randomUUID(),
          app_user_id: user.id,
          product_id: "tatame_pro_monthly",
          original_transaction_id: "1000000000000000",
          store: "APP_STORE",
          event_timestamp_ms: Date.now(),
          expiration_at_ms: Date.now() + 30 * 24 * 3600 * 1000,
        },
        api_version: "1.0",
      });

      const sub = await subRepo.findByAcademyId(academy.id);
      expect(sub!.plan).toBe("pro");
      expect(sub!.status).toBe("active");
      expect(sub!.canceledAt).toBeInstanceOf(Date);
    });
  });

  describe("UNCANCELLATION", () => {
    it("clears canceledAt", async () => {
      const { handler, subRepo, user, academy } = setup();
      await handler.handleEvent(initialPurchaseEvent(user.id));
      await handler.handleEvent({
        event: {
          type: "CANCELLATION",
          id: randomUUID(),
          app_user_id: user.id,
          event_timestamp_ms: Date.now(),
        },
        api_version: "1.0",
      });

      await handler.handleEvent({
        event: {
          type: "UNCANCELLATION",
          id: randomUUID(),
          app_user_id: user.id,
          event_timestamp_ms: Date.now(),
        },
        api_version: "1.0",
      });

      const sub = await subRepo.findByAcademyId(academy.id);
      expect(sub!.canceledAt).toBeNull();
      expect(sub!.status).toBe("active");
    });
  });
```

- [ ] **Step 2: Run to verify both fail**

```bash
pnpm --filter @tatame/api test -- revenuecat-webhook.handler.test.ts
```

Expected: the two new tests fail.

- [ ] **Step 3: Implement the handlers**

Replace the two stub methods in `revenuecat-webhook.handler.ts`:

```ts
  private async onCancellation(payload: RevenueCatEvent): Promise<void> {
    const { event } = payload;
    const ctx = await this.resolveAcademyForUser(event.app_user_id);
    if (!ctx) return;

    const existing = await this.subRepo.findByAcademyId(ctx.academy.id);
    if (!existing) return;

    await this.subRepo.update(existing.id, {
      canceledAt: new Date(event.event_timestamp_ms),
    });
  }

  private async onUncancellation(payload: RevenueCatEvent): Promise<void> {
    const { event } = payload;
    const ctx = await this.resolveAcademyForUser(event.app_user_id);
    if (!ctx) return;

    const existing = await this.subRepo.findByAcademyId(ctx.academy.id);
    if (!existing) return;

    await this.subRepo.update(existing.id, { canceledAt: null });
  }
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @tatame/api test -- revenuecat-webhook.handler.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/manager-subscription/
git commit -m "feat(api): handle RevenueCat CANCELLATION and UNCANCELLATION events"
```

---

## Task 11: Webhook handler — EXPIRATION + REFUND + BILLING_ISSUE

**Files:**
- Modify: `apps/api/src/modules/manager-subscription/revenuecat-webhook.handler.ts`
- Modify: `apps/api/src/modules/manager-subscription/revenuecat-webhook.handler.test.ts`

- [ ] **Step 1: Write failing tests**

Append to the test file:

```ts
  describe("EXPIRATION", () => {
    it("downgrades to plan=free, status=canceled, keeps currentPeriodEnd", async () => {
      const { handler, subRepo, user, academy, emailService } = setup();
      await handler.handleEvent(initialPurchaseEvent(user.id));
      const before = await subRepo.findByAcademyId(academy.id);
      const periodEndBefore = before!.currentPeriodEnd;

      await handler.handleEvent({
        event: {
          type: "EXPIRATION",
          id: randomUUID(),
          app_user_id: user.id,
          event_timestamp_ms: Date.now(),
          product_id: "tatame_pro_monthly",
          store: "APP_STORE",
        },
        api_version: "1.0",
      });

      const sub = await subRepo.findByAcademyId(academy.id);
      expect(sub!.plan).toBe("free");
      expect(sub!.status).toBe("canceled");
      expect(sub!.currentPeriodEnd).toEqual(periodEndBefore);
      expect(emailService.sendSubscriptionCanceled).toHaveBeenCalledOnce();
    });
  });

  describe("REFUND", () => {
    it("sets plan=free, status=canceled, canceledAt=now()", async () => {
      const { handler, subRepo, user, academy } = setup();
      await handler.handleEvent(initialPurchaseEvent(user.id));

      await handler.handleEvent({
        event: {
          type: "REFUND",
          id: randomUUID(),
          app_user_id: user.id,
          event_timestamp_ms: Date.now(),
        },
        api_version: "1.0",
      });

      const sub = await subRepo.findByAcademyId(academy.id);
      expect(sub!.plan).toBe("free");
      expect(sub!.status).toBe("canceled");
      expect(sub!.canceledAt).toBeInstanceOf(Date);
    });
  });

  describe("BILLING_ISSUE", () => {
    it("sets status=past_due, keeps plan=pro", async () => {
      const { handler, subRepo, user, academy } = setup();
      await handler.handleEvent(initialPurchaseEvent(user.id));

      await handler.handleEvent({
        event: {
          type: "BILLING_ISSUE",
          id: randomUUID(),
          app_user_id: user.id,
          event_timestamp_ms: Date.now(),
        },
        api_version: "1.0",
      });

      const sub = await subRepo.findByAcademyId(academy.id);
      expect(sub!.plan).toBe("pro");
      expect(sub!.status).toBe("past_due");
    });
  });

  describe("idempotency", () => {
    it("applying the same INITIAL_PURCHASE twice yields the same final state", async () => {
      const { handler, subRepo, user, academy } = setup();
      const ev = initialPurchaseEvent(user.id);
      await handler.handleEvent(ev);
      const after1 = { ...(await subRepo.findByAcademyId(academy.id))! };
      await handler.handleEvent(ev);
      const after2 = { ...(await subRepo.findByAcademyId(academy.id))! };
      expect(after2.plan).toBe(after1.plan);
      expect(after2.status).toBe(after1.status);
      expect(after2.productId).toBe(after1.productId);
      expect(after2.originalTransactionId).toBe(after1.originalTransactionId);
    });
  });

  describe("unknown event types", () => {
    it("does not throw on TEST events", async () => {
      const { handler, user } = setup();
      await expect(
        handler.handleEvent({
          event: {
            type: "TEST",
            id: randomUUID(),
            app_user_id: user.id,
            event_timestamp_ms: Date.now(),
          },
          api_version: "1.0",
        }),
      ).resolves.not.toThrow();
    });
  });
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
pnpm --filter @tatame/api test -- revenuecat-webhook.handler.test.ts
```

Expected: the new tests for EXPIRATION/REFUND/BILLING_ISSUE fail.

- [ ] **Step 3: Implement the handlers**

Replace the stub methods:

```ts
  private async onExpiration(payload: RevenueCatEvent): Promise<void> {
    const { event } = payload;
    const ctx = await this.resolveAcademyForUser(event.app_user_id);
    if (!ctx) return;

    const existing = await this.subRepo.findByAcademyId(ctx.academy.id);
    if (!existing) return;

    const isRefund = event.type === "REFUND";

    await this.subRepo.update(existing.id, {
      plan: "free",
      status: "canceled",
      canceledAt: isRefund ? new Date(event.event_timestamp_ms) : (existing.canceledAt ?? new Date(event.event_timestamp_ms)),
    });

    if (!isRefund && this.emailService) {
      await this.emailService.sendSubscriptionCanceled(
        {
          email: ctx.user.email,
          managerName: ctx.user.name,
          academyName: ctx.academy.name,
          endsAt: existing.currentPeriodEnd
            ? existing.currentPeriodEnd.toLocaleDateString("pt-BR")
            : "imediatamente",
        },
        existing.originalTransactionId ?? existing.id,
      );
    }
  }

  private async onBillingIssue(payload: RevenueCatEvent): Promise<void> {
    const { event } = payload;
    const ctx = await this.resolveAcademyForUser(event.app_user_id);
    if (!ctx) return;

    const existing = await this.subRepo.findByAcademyId(ctx.academy.id);
    if (!existing) return;

    await this.subRepo.update(existing.id, { status: "past_due" });
  }
```

- [ ] **Step 4: Run all handler tests**

```bash
pnpm --filter @tatame/api test -- revenuecat-webhook.handler.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/manager-subscription/
git commit -m "feat(api): handle RevenueCat EXPIRATION, REFUND, BILLING_ISSUE events"
```

---

## Task 12: Refresh service method

**Files:**
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.service.ts`

- [ ] **Step 1: Add `refreshFromRevenueCat`**

At the top of the file, add the import:
```ts
import type { RevenueCatClient } from "./revenuecat-client.js";
```

Modify the constructor:
```ts
  constructor(
    private readonly subRepo: IManagerSubscriptionRepository,
    private readonly acadRepo: IAcademyRepository,
    private readonly memRepo: IMembershipRepository,
    private readonly classRepo: IClassRepository,
    private readonly planRepo: ISubscriptionPlanRepository,
    private readonly revenuecat: RevenueCatClient | null = null,
  ) {}
```

Add this method at the end of the class (before the closing brace):

```ts
  async refreshFromRevenueCat(
    appUserId: string,
    academyId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    if (!this.revenuecat) return this.subRepo.findByAcademyId(academyId);

    const res = await this.revenuecat.getSubscriber(appUserId);
    if (!res) return this.subRepo.findByAcademyId(academyId);

    const entitlement = res.subscriber.entitlements["pro"];
    const sub = Object.entries(res.subscriber.subscriptions).find(
      ([, s]) =>
        entitlement?.product_identifier &&
        s.expires_date === entitlement.expires_date,
    )?.[1];

    const now = Date.now();
    const expiresMs = entitlement?.expires_date
      ? Date.parse(entitlement.expires_date)
      : null;
    const isActive = expiresMs != null && expiresMs > now;
    const hasBillingIssue = entitlement?.billing_issues_detected_at != null;
    const unsubscribed = entitlement?.unsubscribe_detected_at != null;

    const store =
      sub?.store === "app_store"
        ? "app_store"
        : sub?.store === "play_store"
          ? "play_store"
          : null;

    return this.subRepo.upsertByAcademy({
      academyId,
      plan: isActive ? "pro" : "free",
      status: !isActive ? "canceled" : hasBillingIssue ? "past_due" : "active",
      revenuecatAppUserId: appUserId,
      productId: entitlement?.product_identifier ?? null,
      originalTransactionId: null, // not exposed in subscriber endpoint
      store,
      currentPeriodEnd: expiresMs ? new Date(expiresMs) : null,
      canceledAt: unsubscribed
        ? entitlement?.unsubscribe_detected_at
          ? new Date(entitlement.unsubscribe_detected_at)
          : new Date()
        : null,
    });
  }
```

- [ ] **Step 2: Clean up now-unused Stripe awareness in the service**

Find this block:
```ts
    const isBlocked =
      (sub.status === "past_due" || sub.status === "canceled") &&
      sub.stripeSubscriptionId !== null;
```

Replace with:
```ts
    const isBlocked = sub.status === "past_due" || sub.status === "canceled";
```

Find:
```ts
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
```

Replace with:
```ts
    const canDowngrade = await this.canDowngradeToFree(academyId);
    if (!canDowngrade) {
      const msg =
        sub.status === "past_due"
          ? "Seu pagamento está atrasado. Atualize seus dados de pagamento para continuar usando o app."
          : "Sua assinatura foi cancelada. Reative o plano Pro para continuar usando o app.";
      throw new HttpError(403, msg);
    }
```

- [ ] **Step 3: Run the service tests**

```bash
pnpm --filter @tatame/api test -- manager-subscription.service.test.ts
```

Expected: PASS. If tests fail on `stripeSubscriptionId`, update those specific assertions or fixtures to not depend on that field (they were a proxy for "has ever had a pro subscription"; the new logic uses `sub.status` directly).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/manager-subscription/manager-subscription.service.ts
git commit -m "feat(api): add refreshFromRevenueCat and remove stripe-awareness from service"
```

---

## Task 13: Trim Stripe webhook handler to student-only

The existing `stripe-webhook.handler.ts` mixes **manager** events (`customer.subscription.*`, `invoice.*`) with a **student** event (`checkout.session.completed`, used by the student Stripe checkout flow per `2026-04-09-student-stripe-checkout-design.md`). We strip out manager events and keep only the student event. We also delete `stripe-status.ts` (only used by manager code).

**Files:**
- Modify: `apps/api/src/modules/manager-subscription/stripe-webhook.handler.ts` (will be moved & trimmed)
- Delete: `apps/api/src/modules/manager-subscription/stripe-status.ts`

- [ ] **Step 1: Move the handler into the payment module**

Since the remaining logic is about student payments, relocate the file:

```bash
mv apps/api/src/modules/manager-subscription/stripe-webhook.handler.ts \
   apps/api/src/modules/payment/stripe-checkout-webhook.handler.ts
rm apps/api/src/modules/manager-subscription/stripe-status.ts
```

- [ ] **Step 2: Rewrite the moved file with only the student event**

Replace the entire contents of `apps/api/src/modules/payment/stripe-checkout-webhook.handler.ts`:

```ts
import Stripe from "stripe";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { EmailService } from "../email/email.service.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { IPaymentRepository } from "./payment.repository.js";

export class StripeCheckoutWebhookHandler {
  constructor(
    private readonly paymentRepo: IPaymentRepository,
    private readonly userRepo: IUserRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly emailService: EmailService | null,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    if (event.type !== "checkout.session.completed") return;
    await this.onCheckoutSessionCompleted(
      event.data.object as Stripe.Checkout.Session,
    );
  }

  private async onCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const meta = session.metadata;
    if (
      !meta?.subscriptionId ||
      !meta.userId ||
      !meta.academyId ||
      !meta.referenceMonth
    ) {
      return;
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (paymentIntentId) {
      const existing = await this.paymentRepo.findByStripePaymentId(
        paymentIntentId,
      );
      if (existing) return;
    }

    const payment = await this.paymentRepo.create({
      subscriptionId: meta.subscriptionId,
      userId: meta.userId,
      academyId: meta.academyId,
      amountCents: session.amount_total ?? 0,
      method: "stripe",
      confirmedBy: null,
      stripePaymentId: paymentIntentId ?? session.id,
      referenceMonth: meta.referenceMonth,
      notes: null,
      paidAt: new Date(),
    });

    if (!this.emailService) return;

    const student = await this.userRepo.findById(meta.userId);
    const academy = await this.academyRepo.findById(meta.academyId);
    if (!student || !academy) return;

    await this.emailService.sendPaymentConfirmed(
      {
        email: student.email,
        studentName: student.name,
        academyName: academy.name,
        amountCents: payment.amountCents,
        referenceMonth: payment.referenceMonth,
      },
      payment.id,
    );

    const owner = await this.userRepo.findById(academy.ownerId);
    if (!owner) return;

    await this.emailService.sendStudentPaymentReceived(
      {
        email: owner.email,
        managerName: owner.name,
        academyName: academy.name,
        studentName: student.name,
        amountCents: payment.amountCents,
        referenceMonth: payment.referenceMonth,
        hasPixKey: !!academy.pixKey,
      },
      payment.id,
    );
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @tatame/api exec tsc --noEmit
```

Expected: errors only in `manager-subscription.routes.ts` (fixed in Task 14). Any other error means an unintended coupling — resolve by removing the offending import.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/
git commit -m "refactor(api): extract student stripe checkout webhook, drop manager stripe handler"
```

---

## Task 14: Rewrite manager-subscription routes

**Files:**
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import { loadEnv } from "@tatame/config";
import { Role } from "@tatame/types";
import { Router } from "express";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import { logger } from "../../lib/logger.js";
import { getStripe } from "../../lib/stripe.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { PostgresClassRepository } from "../class/class.repository.postgres.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresSubscriptionPlanRepository } from "../subscription/subscription.repository.postgres.js";
import { PostgresManagerSubscriptionRepository } from "./manager-subscription.repository.postgres.js";
import { ManagerSubscriptionService } from "./manager-subscription.service.js";
import { RevenueCatClient } from "./revenuecat-client.js";
import { RevenueCatWebhookHandler } from "./revenuecat-webhook.handler.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";
import { PostgresPaymentRepository } from "../payment/payment.repository.postgres.js";
import { AbacatePayWebhookHandler } from "../payment/abacatepay-webhook.handler.js";
import { StripeCheckoutWebhookHandler } from "../payment/stripe-checkout-webhook.handler.js";
import type { RevenueCatEvent } from "./revenuecat-events.js";

const db = getDb();
const env = loadEnv();
const subRepo = new PostgresManagerSubscriptionRepository(db);
const acadRepo = new PostgresAcademyRepository(db);
const memRepo = new PostgresMembershipRepository(db);
const classRepo = new PostgresClassRepository(db);
const planRepo = new PostgresSubscriptionPlanRepository(db);
const userRepo = new PostgresUserRepository(db);

const emailService = env.REDIS_URL
  ? new EmailService(getEmailQueue(env.REDIS_URL))
  : null;

const paymentRepo = new PostgresPaymentRepository(db);

const revenuecat = env.REVENUECAT_SECRET_API_KEY
  ? new RevenueCatClient(env.REVENUECAT_SECRET_API_KEY)
  : null;

const service = new ManagerSubscriptionService(
  subRepo,
  acadRepo,
  memRepo,
  classRepo,
  planRepo,
  revenuecat,
);

const webhookHandler = new RevenueCatWebhookHandler(
  subRepo,
  userRepo,
  acadRepo,
  emailService,
);

export const managerSubscriptionRouter = Router();

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

managerSubscriptionRouter.get(
  "/me",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const sub = await service.getSubscription(req.appAuth!.activeAcademyId!);
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

managerSubscriptionRouter.post(
  "/refresh",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const sub = await service.refreshFromRevenueCat(
        req.appAuth!.userId,
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

export function createWebhookRouter() {
  const webhookRouter = Router();

  webhookRouter.post("/revenuecat", async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.REVENUECAT_WEBHOOK_SECRET) {
        throw new HttpError(503, "RevenueCat webhook secret not configured");
      }

      const auth = req.headers["authorization"];
      if (auth !== env.REVENUECAT_WEBHOOK_SECRET) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const payload = req.body as RevenueCatEvent;
      if (!payload?.event?.type || !payload.event.app_user_id) {
        res.status(400).json({ error: "invalid payload" });
        return;
      }

      await webhookHandler.handleEvent(payload);
      res.json({ received: true });
    } catch (e) {
      logger.error({ err: e }, "[revenuecat webhook] handler error");
      next(e);
    }
  });

  const abacatePayHandler = new AbacatePayWebhookHandler(
    paymentRepo,
    userRepo,
    acadRepo,
    emailService,
  );

  webhookRouter.post("/abacatepay", async (req, res, next) => {
    try {
      await abacatePayHandler.handleEvent(req.body);
      res.json({ received: true });
    } catch (e) {
      next(e);
    }
  });

  const stripeCheckoutHandler = new StripeCheckoutWebhookHandler(
    paymentRepo,
    userRepo,
    acadRepo,
    emailService,
  );

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
      await stripeCheckoutHandler.handleEvent(event);
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

**Note:** The `/v1/webhooks/stripe` endpoint is kept but now only processes `checkout.session.completed` events used by the student Stripe flow. All manager `customer.subscription.*` and `invoice.*` events are ignored (they're no longer configured in the Stripe dashboard for this app).

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @tatame/api exec tsc --noEmit
```

Expected: success.

- [ ] **Step 3: Run the full API test suite**

```bash
pnpm --filter @tatame/api test
```

Expected: all tests pass (the handler + service tests should all pass; any old Stripe-specific assertions should already have been cleaned up in Tasks 5 and 12).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/manager-subscription/manager-subscription.routes.ts
git commit -m "feat(api): wire RevenueCat webhook + refresh endpoint; remove manager Stripe routes"
```

---

## Task 15: Mobile — add `react-native-purchases` dependency

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Add the dependency**

```bash
pnpm --filter @tatame/mobile add react-native-purchases
```

This adds the package to `package.json`. Verify the version is `^8.x`.

- [ ] **Step 2: Add the config plugin**

Open `apps/mobile/app.json` and in the `plugins` array, add `"react-native-purchases"` as an entry. The final plugins section should look like:

```json
    "plugins": [
      [
        "expo-system-ui",
        {
          "backgroundColor": "#0C0C0C"
        }
      ],
      "expo-router",
      "expo-font",
      "@react-native-community/datetimepicker",
      [
        "@stripe/stripe-react-native",
        {
          "merchantIdentifier": []
        }
      ],
      "react-native-purchases"
    ],
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json pnpm-lock.yaml
git commit -m "feat(mobile): add react-native-purchases dependency and config plugin"
```

---

## Task 16: Mobile — RevenueCat module

**Files:**
- Create: `apps/mobile/lib/revenuecat.ts`

- [ ] **Step 1: Write the module**

```ts
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

let initialized = false;
let currentUserId: string | null = null;

export function initRevenueCat(): void {
  if (initialized) return;

  const apiKey =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

  if (!apiKey) {
    console.warn("[revenuecat] missing API key for", Platform.OS);
    return;
  }

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.WARN : LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey });
  initialized = true;
}

export async function identifyRevenueCatUser(userId: string): Promise<void> {
  if (!initialized) return;
  if (currentUserId === userId) return;
  await Purchases.logIn(userId);
  currentUserId = userId;
}

export async function resetRevenueCatUser(): Promise<void> {
  if (!initialized) return;
  await Purchases.logOut();
  currentUserId = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/lib/revenuecat.ts
git commit -m "feat(mobile): add RevenueCat module with init/identify/reset"
```

---

## Task 17: Mobile — RevenueCat hooks

**Files:**
- Create: `apps/mobile/lib/hooks/use-revenuecat.ts`

- [ ] **Step 1: Write the hooks**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Purchases, { type PurchasesPackage } from "react-native-purchases";

export function useMonthlyPackage() {
  return useQuery({
    queryKey: ["revenuecat", "offerings", "monthly"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const offerings = await Purchases.getOfferings();
      return offerings.current?.monthly ?? null;
    },
  });
}

export type PurchaseError = Error & {
  userCancelled?: boolean;
  code?: string;
};

export function mapPurchaseError(err: unknown): string {
  const e = err as PurchaseError;
  if (e?.userCancelled) return "";
  if (e?.code === "PAYMENT_PENDING_ERROR")
    return "Seu pagamento está sendo processado. Você receberá uma confirmação em breve.";
  if (e?.code === "PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR")
    return "Plano indisponível no momento. Tente novamente mais tarde.";
  if (
    e?.code === "PURCHASE_INVALID_ERROR" ||
    e?.code === "RECEIPT_ALREADY_IN_USE_ERROR"
  )
    return "Essa assinatura já está vinculada a outra conta. Entre em contato com o suporte.";
  if (e?.code === "NETWORK_ERROR")
    return "Sem conexão. Verifique sua internet e tente novamente.";
  return "Não foi possível completar a compra. Tente novamente.";
}

export function usePurchaseSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      return Purchases.purchasePackage(pkg);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
    },
  });
}

export function useRestorePurchases() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => Purchases.restorePurchases(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/lib/hooks/use-revenuecat.ts
git commit -m "feat(mobile): add RevenueCat React Query hooks for offerings, purchase, restore"
```

---

## Task 18: Mobile — init RevenueCat in root layout

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Add imports**

At the top of the file, after the existing imports, add:
```ts
import { initRevenueCat, identifyRevenueCatUser, resetRevenueCatUser } from "@/lib/revenuecat";
import { useAuth } from "@clerk/clerk-expo";
```

- [ ] **Step 2: Call `initRevenueCat` once and identify when user is available**

Add a new component `RevenueCatBridge` inside the file, above `RootLayout`:

```tsx
function RevenueCatBridge() {
  const { userId, isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    initRevenueCat();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && userId) {
      identifyRevenueCatUser(userId).catch(() => {});
    } else {
      resetRevenueCatUser().catch(() => {});
    }
  }, [isLoaded, isSignedIn, userId]);

  return null;
}
```

And mount it inside `ClerkLoaded`, next to the existing `<Slot />`:

```tsx
          <ClerkLoaded>
            <SafeAreaProvider>
              <StripeProvider publishableKey={stripePublishableKey}>
                <StatusBar style="light" />
                <RevenueCatBridge />
                <Slot />
              </StripeProvider>
            </SafeAreaProvider>
          </ClerkLoaded>
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): initialize RevenueCat and identify Clerk user at root layout"
```

---

## Task 19: Mobile — update `plan-selection.tsx` to use IAP

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/plan-selection.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { PlanCard } from "@/components/PlanCard";
import { MANAGER_PLANS } from "@/constants/manager-plans";
import { useSelectFreePlan } from "@/lib/hooks/use-manager-subscription";
import {
  mapPurchaseError,
  useMonthlyPackage,
  usePurchaseSubscription,
  useRestorePurchases,
} from "@/lib/hooks/use-revenuecat";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PlanSelectionScreen() {
  const router = useRouter();
  const selectFree = useSelectFreePlan();
  const { data: monthlyPackage } = useMonthlyPackage();
  const purchase = usePurchaseSubscription();
  const restore = useRestorePurchases();

  async function handleSelectFree() {
    try {
      await selectFree.mutateAsync();
      router.replace("/(app)/(manager)/(home)");
    } catch {
      Alert.alert("Erro", "Não foi possível selecionar o plano gratuito.");
    }
  }

  async function handleSelectPro() {
    if (!monthlyPackage) {
      Alert.alert("Erro", "Plano indisponível no momento.");
      return;
    }
    try {
      await purchase.mutateAsync(monthlyPackage);
      router.push("/(app)/(manager)/subscription-result");
    } catch (err) {
      const message = mapPurchaseError(err);
      if (message) Alert.alert("Erro", message);
    }
  }

  async function handleRestore() {
    try {
      const info = await restore.mutateAsync();
      const active = info.entitlements?.active?.["pro"];
      if (active) {
        router.replace("/(app)/(manager)/subscription-result");
      } else {
        Alert.alert(
          "Nenhuma compra encontrada",
          "Não encontramos uma assinatura ativa vinculada à sua conta.",
        );
      }
    } catch {
      Alert.alert("Erro", "Não foi possível restaurar compras.");
    }
  }

  const isLoading =
    selectFree.isPending || purchase.isPending || restore.isPending;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
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

        {MANAGER_PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            title={plan.title}
            description={plan.description}
            price={plan.price}
            period={plan.period}
            features={plan.features}
            ctaLabel={plan.ctaLabel}
            badgeLabel={plan.badgeLabel}
            variant={plan.id === "pro" ? "accent" : "neutral"}
            disabled={isLoading}
            loading={plan.id === "free" ? selectFree.isPending : purchase.isPending}
            onPress={plan.id === "free" ? handleSelectFree : handleSelectPro}
          />
        ))}

        <Pressable
          onPress={handleRestore}
          disabled={isLoading}
          className="items-center rounded-xl bg-surface px-5 py-3"
          style={{ opacity: isLoading ? 0.5 : 1 }}
        >
          <Text className="font-poppins-semibold text-sm" style={{ color: "#A078E8" }}>
            Restaurar compras
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/\(manager\)/plan-selection.tsx
git commit -m "feat(mobile): use RevenueCat IAP in plan-selection and add Restore Purchases"
```

---

## Task 20: Mobile — update `subscription-result.tsx`

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/subscription-result.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { useApi } from "@/lib/api";
import {
  useManagerSubscription,
  type ManagerSubscription,
} from "@/lib/hooks/use-manager-subscription";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CheckCircle, RefreshCw } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const POLL_INTERVAL = 3000;
const MAX_POLL_TIME = 30000;

export default function SubscriptionResultScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApi();

  const { data: sub, refetch } = useManagerSubscription();
  const [state, setState] = useState<"polling" | "success" | "timeout">("polling");
  const startTime = useRef(Date.now());
  const refreshedOnce = useRef(false);

  const checkSubscription = useCallback(async () => {
    const { data } = await refetch();
    if (data?.plan === "pro" && data?.status === "active") {
      setState("success");
      await queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      await queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
      await queryClient.invalidateQueries({ queryKey: ["user/me"] });
      return;
    }

    if (Date.now() - startTime.current > MAX_POLL_TIME) {
      if (!refreshedOnce.current) {
        refreshedOnce.current = true;
        try {
          await api.post<ManagerSubscription>("/manager-subscriptions/refresh");
          const refreshed = await refetch();
          if (
            refreshed.data?.plan === "pro" &&
            refreshed.data?.status === "active"
          ) {
            setState("success");
            await queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
            await queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
            await queryClient.invalidateQueries({ queryKey: ["user/me"] });
            return;
          }
        } catch {}
      }
      setState("timeout");
    }
  }, [refetch, queryClient, api]);

  useEffect(() => {
    if (state !== "polling") return;
    checkSubscription();
    const interval = setInterval(checkSubscription, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [state, checkSubscription]);

  useEffect(() => {
    if (state === "success") {
      const timer = setTimeout(() => {
        router.replace("/(app)/(manager)/(home)");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state, router]);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={["top"]}>
      {state === "polling" && (
        <View className="items-center" style={{ gap: 16 }}>
          <ActivityIndicator size="large" color="#A078E8" />
          <Text className="font-poppins-semibold text-lg text-primary">
            Aguardando confirmação...
          </Text>
          <Text
            className="font-poppins text-sm text-center px-10"
            style={{ color: "#ABABAB" }}
          >
            Estamos processando seu pagamento. Isso pode levar alguns segundos.
          </Text>
          <Pressable
            onPress={checkSubscription}
            className="mt-4 flex-row items-center rounded-xl bg-surface px-5 py-3"
            style={{ gap: 8 }}
          >
            <RefreshCw size={16} color="#A078E8" />
            <Text className="font-poppins-semibold text-sm" style={{ color: "#A078E8" }}>
              Verificar novamente
            </Text>
          </Pressable>
        </View>
      )}

      {state === "success" && (
        <View className="items-center" style={{ gap: 16 }}>
          <CheckCircle size={56} color="#32D74B" />
          <Text className="font-poppins-bold text-xl text-primary">
            Assinatura ativada!
          </Text>
          <Text className="font-poppins text-sm" style={{ color: "#ABABAB" }}>
            Redirecionando...
          </Text>
        </View>
      )}

      {state === "timeout" && (
        <View className="items-center" style={{ gap: 16 }}>
          <ActivityIndicator size="large" color="#A078E8" />
          <Text className="font-poppins-semibold text-lg text-primary text-center px-10">
            Pagamento sendo processado
          </Text>
          <Text
            className="font-poppins text-sm text-center px-10"
            style={{ color: "#ABABAB" }}
          >
            Pode levar alguns minutos. Você pode voltar e verificar depois.
          </Text>
          <Pressable
            onPress={() => router.replace("/(app)/(manager)/(home)")}
            className="mt-4 rounded-xl bg-accent px-6 py-3"
          >
            <Text className="font-poppins-semibold text-sm text-white">
              Ir para o início
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/\(manager\)/subscription-result.tsx
git commit -m "feat(mobile): drop session_id, use /refresh fallback in subscription-result"
```

---

## Task 21: Mobile — update `my-plan.tsx`

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/(finances)/my-plan.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { BackButton } from "@/components/BackButton";
import { useManagerSubscription } from "@/lib/hooks/use-manager-subscription";
import { useRestorePurchases } from "@/lib/hooks/use-revenuecat";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  CreditCard,
  RotateCcw,
  Settings,
  Timer,
} from "lucide-react-native";
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Purchases from "react-native-purchases";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";
const DIVIDER = "#2A2A2A";
const ANDROID_PACKAGE = "br.com.tatame.app"; // keep in sync with app.json android.package
const ANDROID_SKU = "tatame_pro_monthly";

function formatDate(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function openManageSubscription() {
  if (Platform.OS === "ios") {
    await Purchases.showManageSubscriptions();
    return;
  }
  await Linking.openURL(
    `https://play.google.com/store/account/subscriptions?sku=${ANDROID_SKU}&package=${ANDROID_PACKAGE}`,
  );
}

export default function MyPlanScreen() {
  const router = useRouter();
  const { data: sub } = useManagerSubscription();
  const restore = useRestorePurchases();

  const isPro = sub?.plan === "pro";
  const isPastDue = sub?.status === "past_due";
  const isScheduledForCancel =
    sub?.status === "active" &&
    !!sub?.canceledAt &&
    new Date(sub.canceledAt).getTime() < Date.now() + 40 * 24 * 3600 * 1000;

  const planPrice = isPro ? "R$ 49" : "R$ 0";
  const planName = isPro ? "Pro" : "Gratuito";
  const statusLabel =
    sub?.status === "active"
      ? "ATIVO"
      : sub?.status === "past_due"
        ? "ATRASADO"
        : sub?.status === "canceled"
          ? "CANCELADO"
          : "ATIVO";

  function handleChangePlan() {
    router.push("/(app)/(manager)/plan-selection");
  }

  async function handleManage() {
    try {
      await openManageSubscription();
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o gerenciador de assinaturas.");
    }
  }

  async function handleRestore() {
    try {
      await restore.mutateAsync();
      Alert.alert("Pronto", "Compras restauradas.");
    } catch {
      Alert.alert("Erro", "Não foi possível restaurar compras.");
    }
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
        <View className="flex-row items-center gap-3" style={{ minHeight: 62, paddingTop: 8 }}>
          <BackButton />
          <Text className="flex-1 text-center font-poppins-bold text-lg text-primary">
            Meu Plano
          </Text>
          <View className="h-10 w-10" />
        </View>

        <View
          className="rounded-2xl border bg-surface"
          style={{
            padding: 20,
            gap: 16,
            borderColor: isPro ? "#A078E8" : "#2A2A2A",
          }}
        >
          <View className="flex-row items-center justify-between">
            <View style={{ gap: 4 }}>
              <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
                Plano atual
              </Text>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Text className="font-poppins-bold text-[22px] text-primary">
                  {planName}
                </Text>
                <View
                  className="rounded-full"
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    backgroundColor: isPro ? "#A078E8" : "#2A2A2A",
                  }}
                >
                  <Text className="font-poppins-bold text-[10px] text-white">
                    {statusLabel}
                  </Text>
                </View>
              </View>
            </View>
            <View className="flex-row items-baseline" style={{ gap: 2 }}>
              <Text className="font-poppins-bold text-[28px] text-primary" style={{ letterSpacing: -1 }}>
                {planPrice}
              </Text>
              <Text
                className="font-poppins text-xs"
                style={{ color: TEXT_MUTED }}
              >
                /mês
              </Text>
            </View>
          </View>

          <View className="h-px w-full" style={{ backgroundColor: DIVIDER }} />

          <View style={{ gap: 8 }}>
            {sub?.currentPeriodEnd ? (
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Calendar size={14} color={TEXT_MUTED} />
                <Text className="font-poppins text-[13px]" style={{ color: TEXT_SECONDARY }}>
                  Próxima cobrança em {formatDate(sub.currentPeriodEnd)}
                </Text>
              </View>
            ) : null}
            {sub?.subscribedAt ? (
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Timer size={14} color={TEXT_MUTED} />
                <Text className="font-poppins text-[13px]" style={{ color: TEXT_SECONDARY }}>
                  Assinante desde {formatDate(sub.subscribedAt)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {isPro && isPastDue ? (
          <View
            className="rounded-2xl"
            style={{
              backgroundColor: "rgba(255,69,58,0.12)",
              borderColor: "#FF453A",
              borderWidth: 1,
              padding: 16,
              gap: 8,
            }}
          >
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <AlertTriangle size={16} color="#FF453A" />
              <Text className="font-poppins-semibold text-sm" style={{ color: "#FF453A" }}>
                Problema no pagamento
              </Text>
            </View>
            <Text className="font-poppins text-[13px]" style={{ color: TEXT_SECONDARY }}>
              Atualize sua forma de pagamento para manter o acesso ao plano Pro.
            </Text>
            <Pressable
              onPress={handleManage}
              className="items-center rounded-xl bg-accent"
              style={{ paddingVertical: 10, marginTop: 4 }}
            >
              <Text className="font-poppins-semibold text-sm text-white">
                Atualizar pagamento
              </Text>
            </Pressable>
          </View>
        ) : null}

        {isPro && isScheduledForCancel && sub?.canceledAt ? (
          <View
            className="rounded-2xl"
            style={{
              backgroundColor: "rgba(255,204,0,0.10)",
              borderColor: "#FFCC00",
              borderWidth: 1,
              padding: 16,
              gap: 6,
            }}
          >
            <Text className="font-poppins-semibold text-sm" style={{ color: "#FFCC00" }}>
              Assinatura com cancelamento agendado
            </Text>
            <Text className="font-poppins text-[13px]" style={{ color: TEXT_SECONDARY }}>
              Sua assinatura será encerrada em{" "}
              {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : formatDate(sub.canceledAt)}.
            </Text>
          </View>
        ) : null}

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

        {isPro && (
          <Pressable
            onPress={handleManage}
            className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 16 }}
          >
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <Settings size={18} color="#FFFFFF" />
              <Text className="font-poppins-semibold text-sm text-primary">
                Gerenciar assinatura
              </Text>
            </View>
            <ChevronRight size={18} color={TEXT_SECONDARY} />
          </Pressable>
        )}

        <Pressable
          onPress={handleRestore}
          disabled={restore.isPending}
          className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 16, opacity: restore.isPending ? 0.6 : 1 }}
        >
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <RotateCcw size={18} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-sm text-primary">
              Restaurar compras
            </Text>
          </View>
          <ChevronRight size={18} color={TEXT_SECONDARY} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/\(manager\)/\(finances\)/my-plan.tsx
git commit -m "feat(mobile): rebuild my-plan screen for IAP (manage, restore, past_due banner)"
```

---

## Task 22: Mobile — clean up `use-manager-subscription.ts`

**Files:**
- Modify: `apps/mobile/lib/hooks/use-manager-subscription.ts`

- [ ] **Step 1: Replace the file**

```ts
import { useApi } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type ManagerSubscription = {
  id: string;
  academyId: string;
  plan: "free" | "pro";
  status: "active" | "past_due" | "canceled" | "incomplete";
  revenuecatAppUserId: string | null;
  productId: string | null;
  originalTransactionId: string | null;
  store: "app_store" | "play_store" | null;
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
    mutationFn: () => api.post<ManagerSubscription>("/manager-subscriptions/free"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
      queryClient.invalidateQueries({ queryKey: ["user/me"] });
    },
  });
}
```

This removes: `useManagerInvoices`, `useStartProSubscription`, `useCompleteProSubscription`, `useReactivateSubscription`, `useStripePortal`, `useProCheckout`, `useReactivateCheckout`. All of those are now either dead (Stripe flows) or replaced by `useRevenueCat`.

- [ ] **Step 2: Find any remaining references to the removed hooks**

```bash
pnpm --filter @tatame/mobile exec grep -R "useProCheckout\|useStripePortal\|useReactivateCheckout\|useManagerInvoices\|useStartProSubscription\|useCompleteProSubscription\|useReactivateSubscription" --include="*.ts" --include="*.tsx" || true
```

Expected: no matches. If any appear, delete those call sites (they belong to old Stripe flow, which is gone).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/hooks/use-manager-subscription.ts
git commit -m "refactor(mobile): remove Stripe-only subscription hooks and types"
```

---

## Task 23: Bump mobile version + final verification

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Bump mobile version to 2.0.7**

Edit `apps/mobile/package.json`:
```json
"version": "2.0.7",
```

Edit `apps/mobile/app.json`:
```json
"version": "2.0.7",
```

- [ ] **Step 2: Run the full API test suite**

```bash
pnpm --filter @tatame/api test
```

Expected: all tests pass.

- [ ] **Step 3: Typecheck everything**

```bash
pnpm --filter @tatame/api exec tsc --noEmit
pnpm --filter @tatame/mobile exec tsc --noEmit
pnpm --filter @tatame/db exec tsc --noEmit
pnpm --filter @tatame/config exec tsc --noEmit
```

Expected: all succeed.

- [ ] **Step 4: Inspect the mobile bundle for dead references**

```bash
pnpm --filter @tatame/mobile exec grep -R "pro/checkout\|pro/complete\|manager-subscriptions/portal\|session_id\|stripeCustomerId\|stripeSubscriptionId" apps/mobile/ --include="*.ts" --include="*.tsx" || true
```

Expected: no matches. If anything remains, remove it.

- [ ] **Step 5: Apply the DB migration in local dev**

```bash
pnpm --filter @tatame/db exec drizzle-kit migrate
```

Expected: migration applied.

- [ ] **Step 6: Commit the version bump**

```bash
git add apps/mobile/package.json apps/mobile/app.json
git commit -m "chore(mobile): bump version to 2.0.7 (RevenueCat IAP)"
```

- [ ] **Step 7: Build dev client for manual QA**

Only after all tasks are merged. Not a plan step to execute in this session — the operator runs:
```bash
cd apps/mobile
eas build --profile development --platform ios
eas build --profile development --platform android
```

Then manually tests: sandbox purchase → cancellation → billing issue → restore purchases.

---

## Manual QA Checklist (post-build, for the operator)

- [ ] iOS sandbox tester purchases `tatame_pro_monthly` → app enters `subscription-result` → DB row becomes `plan=pro, status=active`.
- [ ] In Apple ID Settings, cancel the subscription → `my-plan` shows yellow "cancelamento agendado" banner with the period-end date.
- [ ] Force a billing issue in App Store Connect sandbox → `my-plan` shows red "Problema no pagamento" banner with "Atualizar pagamento" CTA.
- [ ] Tap "Restaurar compras" after a fresh reinstall → entitlement restored, subscription visible.
- [ ] Android license tester purchases → same success path.
- [ ] Android force grace period via Play Console → same past_due banner.
- [ ] `POST /v1/webhooks/revenuecat` rejects requests without matching Authorization header (curl with wrong token → 401).
