# Web Subscription Outside App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move manager subscription payment from in-app (RevenueCat) to web (Stripe), creating a manager web portal and removing all IAP code.

**Architecture:** The API's `manager-subscription` module is rewritten to use Stripe Subscriptions instead of RevenueCat. The web app (`apps/web`) gains public signup pages and a Clerk-protected manager portal with financial dashboard and subscription management. The mobile app removes RevenueCat, plan selection screens, and manager signup — managers can only create accounts via web.

**Tech Stack:** Stripe Subscriptions API, Clerk (Next.js SDK already installed), Next.js 15 (app router), Drizzle ORM, Express, React Native (Expo Router)

---

## File Structure

### API (`apps/api/src/modules/manager-subscription/`)

| File | Action | Responsibility |
|------|--------|---------------|
| `manager-subscription.repository.ts` | Modify | Replace RevenueCat fields with Stripe fields in interface |
| `manager-subscription.repository.postgres.ts` | Modify | Update queries for new Stripe fields, add `findByStripeCustomerId` |
| `manager-subscription.repository.in-memory.ts` | Modify | Match new interface for tests |
| `manager-subscription.service.ts` | Modify | Remove free plan limits, RevenueCat refresh, add Stripe checkout/cancel/portal |
| `manager-subscription.service.test.ts` | Modify | Rewrite tests for new service methods |
| `manager-subscription.routes.ts` | Modify | Replace RevenueCat routes with Stripe routes, add new webhook |
| `stripe-subscription-webhook.handler.ts` | Create | Handle Stripe subscription lifecycle events |
| `revenuecat-client.ts` | Delete | No longer needed |
| `revenuecat-events.ts` | Delete | No longer needed |
| `revenuecat-webhook.handler.ts` | Delete | No longer needed |

### Database (`packages/db/`)

| File | Action | Responsibility |
|------|--------|---------------|
| `src/schema/index.ts` | Modify | Replace RevenueCat columns with Stripe columns, add `trialing` status |
| `drizzle/0008_*.sql` | Create | Migration to alter `manager_subscriptions` table |

### Config (`packages/config/`)

| File | Action | Responsibility |
|------|--------|---------------|
| `src/env.ts` | Modify | Remove RevenueCat vars, add `STRIPE_MANAGER_PRICE_ID`, `MANAGER_PORTAL_URL` |

### Types (`packages/types/`)

| File | Action | Responsibility |
|------|--------|---------------|
| `src/index.ts` | Modify | Add `trialing` to `ManagerSubscriptionStatus`, remove `ManagerSubscriptionStore` |

### Web App (`apps/web/`)

| File | Action | Responsibility |
|------|--------|---------------|
| `app/layout.tsx` | Modify | Add ClerkProvider |
| `middleware.ts` | Create | Clerk auth middleware, protect `/conta/*` routes |
| `app/(site)/page.tsx` | Modify | Update pricing section CTA |
| `components/pricing.tsx` | Modify | Single plan with trial messaging |
| `app/cadastro/page.tsx` | Create | Signup + Stripe Checkout page |
| `app/assinatura-confirmada/page.tsx` | Create | Post-payment success page |
| `app/conta/login/[[...sign-in]]/page.tsx` | Create | Custom login page |
| `app/conta/(dashboard)/layout.tsx` | Create | Sidebar layout for manager area |
| `app/conta/(dashboard)/page.tsx` | Create | Financial dashboard |
| `app/conta/(dashboard)/assinatura/page.tsx` | Create | Subscription management |
| `lib/manager-api.ts` | Create | Clerk-authenticated API fetch helper |

### Mobile App (`apps/mobile/`)

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/revenuecat.ts` | Delete | No longer needed |
| `lib/hooks/use-revenuecat.ts` | Delete | No longer needed |
| `lib/hooks/use-manager-subscription.ts` | Modify | Remove RevenueCat fields from type, remove `useSelectFreePlan` |
| `app/_layout.tsx` | Modify | Remove RevenueCat init/identify |
| `app/(app)/(manager)/_layout.tsx` | Modify | Replace plan gate with subscription-active check + blocked screen |
| `app/(app)/(manager)/plan-selection.tsx` | Delete | No longer needed |
| `app/(app)/(manager)/subscription-result.tsx` | Delete | No longer needed |
| `app/(app)/(manager)/(finances)/my-plan.tsx` | Rewrite | Single "Gerenciar minha conta" button opening web portal |
| `app/(app)/(manager)/(finances)/index.tsx` | Modify | Update plan card to remove Free/Pro toggle, link to web |
| `app/(onboarding)/user-type.tsx` | Modify | Remove manager option |
| `constants/manager-plans.ts` | Delete | No longer needed |
| `package.json` | Modify | Remove `react-native-purchases` dependency |

### User module (pending Stripe data)

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/src/modules/user/user.repository.ts` | Modify | Add `updatePendingStripe` and `clearPendingStripe` methods |
| `apps/api/src/modules/user/user.repository.postgres.ts` | Modify | Implement new methods |

### Academy module (link subscription on creation)

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/src/modules/academy/academy.routes.ts` | Modify | After academy creation, check for pending Stripe subscription and link it |

### Other modules that call limit methods

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/src/modules/membership/membership.routes.ts` | Modify | Remove `canApproveStudent`/`canApproveInstructor` calls |
| `apps/api/src/modules/subscription/subscription.routes.ts` | Modify | Remove `canCreatePlan` call |
| `apps/api/src/modules/class/class.routes.ts` | Modify | Remove `canCreateClass` call |

---

## Task 1: Database Schema Migration

**Files:**
- Modify: `packages/db/src/schema/index.ts:265-289` (managerSubscriptions table)
- Modify: `packages/db/src/schema/index.ts:69-86` (users table — add pending Stripe columns)
- Modify: `packages/types/src/index.ts`
- Create: `packages/db/drizzle/0008_manager_subscription_stripe.sql`

- [ ] **Step 1: Add `trialing` to the subscription status enum in types**

In `packages/types/src/index.ts`, find the `ManagerSubscriptionStatus` type and update it:

```typescript
export type ManagerSubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete";
```

Remove the `ManagerSubscriptionStore` type if it exists (search for `"app_store" | "play_store"`).

- [ ] **Step 2: Update the Drizzle schema**

In `packages/db/src/schema/index.ts`:

1. Add `"trialing"` to `managerSubscriptionStatusEnum`:

```typescript
export const managerSubscriptionStatusEnum = pgEnum(
  "manager_subscription_status",
  ["active", "trialing", "past_due", "canceled", "incomplete"],
);
```

2. Delete `managerSubscriptionStoreEnum` entirely.

3. Add pending Stripe columns to the `users` table (these hold Stripe data between web signup and academy creation in the app):

```typescript
// Add these columns to the users table definition:
pendingStripeCustomerId: text("pending_stripe_customer_id"),
pendingStripeSubscriptionId: text("pending_stripe_subscription_id"),
```

4. Replace the `managerSubscriptions` table definition:

```typescript
export const managerSubscriptions = pgTable("manager_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id")
    .notNull()
    .references(() => academies.id, { onDelete: "cascade" })
    .unique(),
  plan: managerPlanEnum("plan").notNull(),
  status: managerSubscriptionStatusEnum("status").notNull(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripePriceId: text("stripe_price_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
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

- [ ] **Step 3: Write the SQL migration**

Create `packages/db/drizzle/0008_manager_subscription_stripe.sql`:

```sql
-- Add 'trialing' to manager_subscription_status enum
ALTER TYPE "manager_subscription_status" ADD VALUE IF NOT EXISTS 'trialing';

-- Add new Stripe columns
ALTER TABLE "manager_subscriptions" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text UNIQUE;
ALTER TABLE "manager_subscriptions" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text UNIQUE;
ALTER TABLE "manager_subscriptions" ADD COLUMN IF NOT EXISTS "stripe_price_id" text;
ALTER TABLE "manager_subscriptions" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp with time zone;

-- Drop RevenueCat columns
ALTER TABLE "manager_subscriptions" DROP COLUMN IF EXISTS "revenuecat_app_user_id";
ALTER TABLE "manager_subscriptions" DROP COLUMN IF EXISTS "product_id";
ALTER TABLE "manager_subscriptions" DROP COLUMN IF EXISTS "original_transaction_id";
ALTER TABLE "manager_subscriptions" DROP COLUMN IF EXISTS "store";

-- Drop store enum (no longer needed)
DROP TYPE IF EXISTS "manager_subscription_store";

-- Add pending Stripe columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_stripe_customer_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_stripe_subscription_id" text;
```

- [ ] **Step 4: Generate Drizzle migration metadata**

Run:

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2/packages/db && npx drizzle-kit generate
```

If Drizzle generates its own migration file, review it against the manual SQL above and keep the generated one (delete the manual one). If it doesn't match, use the manual SQL.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/index.ts packages/types/src/index.ts packages/db/drizzle/
git commit -m "feat(db): migrate manager_subscriptions from RevenueCat to Stripe fields"
```

---

## Task 2: Update Env Config

**Files:**
- Modify: `packages/config/src/env.ts`

- [ ] **Step 1: Update the env schema**

In `packages/config/src/env.ts`, remove the RevenueCat vars and add new ones:

```typescript
// Remove these lines:
REVENUECAT_SECRET_API_KEY: z.string().optional(),
REVENUECAT_WEBHOOK_SECRET: z.string().optional(),

// Add these after the existing STRIPE vars:
/** Stripe Price ID for the manager Pro subscription */
STRIPE_MANAGER_PRICE_ID: z.string().optional(),
/** Stripe webhook secret specifically for manager subscription events */
STRIPE_MANAGER_WEBHOOK_SECRET: z.string().optional(),
/** Base URL for the manager web portal (e.g., https://tatame.app/conta) */
MANAGER_PORTAL_URL: z.string().url().optional(),
```

- [ ] **Step 2: Commit**

```bash
git add packages/config/src/env.ts
git commit -m "feat(config): replace RevenueCat env vars with Stripe manager subscription vars"
```

---

## Task 3: Rewrite Manager Subscription Repository

**Files:**
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.repository.ts`
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.repository.postgres.ts`
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.repository.in-memory.ts`

- [ ] **Step 1: Rewrite the repository interface**

Replace `apps/api/src/modules/manager-subscription/manager-subscription.repository.ts`:

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
    status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    currentPeriodEnd?: Date | null;
    trialEndsAt?: Date | null;
  }): Promise<ManagerSubscriptionRow>;

  update(
    id: string,
    data: Partial<{
      plan: "free" | "pro";
      status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      stripePriceId: string | null;
      currentPeriodEnd: Date | null;
      trialEndsAt: Date | null;
      canceledAt: Date | null;
      subscribedAt: Date;
    }>,
  ): Promise<ManagerSubscriptionRow | undefined>;

  upsertByAcademy(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    currentPeriodEnd?: Date | null;
    trialEndsAt?: Date | null;
    canceledAt?: Date | null;
    subscribedAt?: Date;
  }): Promise<ManagerSubscriptionRow>;
}
```

- [ ] **Step 2: Rewrite the Postgres repository**

Replace `apps/api/src/modules/manager-subscription/manager-subscription.repository.postgres.ts`:

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
      .where(eq(managerSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);
    return row;
  }

  async create(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    currentPeriodEnd?: Date | null;
    trialEndsAt?: Date | null;
  }): Promise<ManagerSubscriptionRow> {
    const rows = await this.db
      .insert(managerSubscriptions)
      .values({
        academyId: data.academyId,
        plan: data.plan,
        status: data.status,
        stripeCustomerId: data.stripeCustomerId ?? null,
        stripeSubscriptionId: data.stripeSubscriptionId ?? null,
        stripePriceId: data.stripePriceId ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        trialEndsAt: data.trialEndsAt ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Failed to create manager subscription");
    return row;
  }

  async update(
    id: string,
    data: Partial<{
      plan: "free" | "pro";
      status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      stripePriceId: string | null;
      currentPeriodEnd: Date | null;
      trialEndsAt: Date | null;
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
    status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    currentPeriodEnd?: Date | null;
    trialEndsAt?: Date | null;
    canceledAt?: Date | null;
    subscribedAt?: Date;
  }): Promise<ManagerSubscriptionRow> {
    const rows = await this.db
      .insert(managerSubscriptions)
      .values({
        academyId: data.academyId,
        plan: data.plan,
        status: data.status,
        stripeCustomerId: data.stripeCustomerId ?? null,
        stripeSubscriptionId: data.stripeSubscriptionId ?? null,
        stripePriceId: data.stripePriceId ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        trialEndsAt: data.trialEndsAt ?? null,
        canceledAt: data.canceledAt ?? null,
        ...(data.subscribedAt ? { subscribedAt: data.subscribedAt } : {}),
      })
      .onConflictDoUpdate({
        target: managerSubscriptions.academyId,
        set: {
          plan: data.plan,
          status: data.status,
          stripeCustomerId: data.stripeCustomerId ?? null,
          stripeSubscriptionId: data.stripeSubscriptionId ?? null,
          stripePriceId: data.stripePriceId ?? null,
          currentPeriodEnd: data.currentPeriodEnd ?? null,
          trialEndsAt: data.trialEndsAt ?? null,
          canceledAt: data.canceledAt ?? null,
          ...(data.subscribedAt ? { subscribedAt: data.subscribedAt } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Failed to upsert manager subscription");
    return row;
  }
}
```

- [ ] **Step 3: Update the in-memory repository**

Update `apps/api/src/modules/manager-subscription/manager-subscription.repository.in-memory.ts` to match the new interface. Replace `findByRevenueCatAppUserId` with `findByStripeCustomerId` and `findByStripeSubscriptionId`. Replace all RevenueCat fields (`revenuecatAppUserId`, `productId`, `originalTransactionId`, `store`) with Stripe fields (`stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `trialEndsAt`). Follow the same pattern as the existing file but with the new field names.

- [ ] **Step 4: Verify build**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo build --filter=@tatame/db --filter=@tatame/types --filter=api
```

Expected: Build succeeds (may have warnings about unused imports in other files — that's fine, we'll clean those up in later tasks).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/manager-subscription/manager-subscription.repository.ts apps/api/src/modules/manager-subscription/manager-subscription.repository.postgres.ts apps/api/src/modules/manager-subscription/manager-subscription.repository.in-memory.ts
git commit -m "feat(api): rewrite manager subscription repository for Stripe"
```

---

## Task 4: Stripe Subscription Webhook Handler

**Files:**
- Create: `apps/api/src/modules/manager-subscription/stripe-subscription-webhook.handler.ts`

This handler deals with two scenarios:
1. **User already has an academy** → update `managerSubscriptions` directly
2. **User just signed up on web, no academy yet** → store Stripe data as pending on user record

- [ ] **Step 1: Write the webhook handler**

Create `apps/api/src/modules/manager-subscription/stripe-subscription-webhook.handler.ts`:

```typescript
import type Stripe from "stripe";
import { logger } from "../../lib/logger.js";
import type { IManagerSubscriptionRepository } from "./manager-subscription.repository.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { EmailService } from "../email/email.service.js";

export class StripeSubscriptionWebhookHandler {
  constructor(
    private readonly subRepo: IManagerSubscriptionRepository,
    private readonly acadRepo: IAcademyRepository,
    private readonly userRepo: IUserRepository,
    private readonly emailService: EmailService | null,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await this.onSubscriptionChange(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "customer.subscription.deleted":
        await this.onSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "invoice.payment_failed":
        await this.onPaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        logger.info({ type: event.type }, "[stripe-sub-webhook] unhandled event type");
    }
  }

  private mapStatus(
    stripeStatus: Stripe.Subscription.Status,
  ): "active" | "trialing" | "past_due" | "canceled" | "incomplete" {
    switch (stripeStatus) {
      case "active":
        return "active";
      case "trialing":
        return "trialing";
      case "past_due":
        return "past_due";
      case "canceled":
      case "unpaid":
        return "canceled";
      case "incomplete":
      case "incomplete_expired":
        return "incomplete";
      default:
        return "incomplete";
    }
  }

  private async onSubscriptionChange(sub: Stripe.Subscription): Promise<void> {
    const stripeCustomerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const clerkUserId = sub.metadata?.clerkUserId;

    // Case 1: Subscription already linked to an academy
    const existing =
      await this.subRepo.findByStripeSubscriptionId(sub.id) ??
      await this.subRepo.findByStripeCustomerId(stripeCustomerId);

    if (existing) {
      const status = this.mapStatus(sub.status);
      await this.subRepo.update(existing.id, {
        plan: "pro",
        status,
        stripeSubscriptionId: sub.id,
        stripeCustomerId,
        stripePriceId: sub.items.data[0]?.price.id ?? null,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        canceledAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
      });
      logger.info(
        { subscriptionId: existing.id, status },
        "[stripe-sub-webhook] subscription updated",
      );
      return;
    }

    // Case 2: No academy yet — store as pending on user record
    if (!clerkUserId) {
      logger.warn(
        { stripeSubscriptionId: sub.id },
        "[stripe-sub-webhook] no academy and no clerkUserId in metadata",
      );
      return;
    }

    const user = await this.userRepo.findByClerkId(clerkUserId);
    if (!user) {
      logger.warn(
        { clerkUserId },
        "[stripe-sub-webhook] user not found for clerkUserId",
      );
      return;
    }

    // Check if user already has an academy (race condition: academy created between checkout and webhook)
    const academy = await this.acadRepo.findByOwnerId(user.id);
    if (academy) {
      // Link subscription to academy now
      await this.subRepo.upsertByAcademy({
        academyId: academy.id,
        plan: "pro",
        status: this.mapStatus(sub.status),
        stripeCustomerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: sub.items.data[0]?.price.id ?? null,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      });
      logger.info(
        { academyId: academy.id },
        "[stripe-sub-webhook] subscription linked to existing academy",
      );
      return;
    }

    // No academy yet — store pending Stripe data on user
    await this.userRepo.updatePendingStripe(user.id, {
      pendingStripeCustomerId: stripeCustomerId,
      pendingStripeSubscriptionId: sub.id,
    });
    logger.info(
      { userId: user.id },
      "[stripe-sub-webhook] stored pending Stripe data on user (no academy yet)",
    );
  }

  private async onSubscriptionDeleted(
    sub: Stripe.Subscription,
  ): Promise<void> {
    const existing = await this.subRepo.findByStripeSubscriptionId(sub.id);
    if (!existing) {
      logger.warn(
        { stripeSubscriptionId: sub.id },
        "[stripe-sub-webhook] subscription.deleted — no record found",
      );
      return;
    }

    await this.subRepo.update(existing.id, {
      status: "canceled",
      canceledAt: new Date(),
    });

    if (this.emailService) {
      const academy = await this.acadRepo.findById(existing.academyId);
      if (academy) {
        await this.emailService.sendSubscriptionCanceled({
          managerName: academy.name,
          academyName: academy.name,
          email: academy.contactEmail ?? "",
          endsAt: existing.currentPeriodEnd
            ? existing.currentPeriodEnd.toLocaleDateString("pt-BR")
            : new Date().toLocaleDateString("pt-BR"),
        });
      }
    }

    logger.info(
      { subscriptionId: existing.id },
      "[stripe-sub-webhook] subscription canceled",
    );
  }

  private async onPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;
    if (!subId) return;

    const existing = await this.subRepo.findByStripeSubscriptionId(subId);
    if (!existing) return;

    await this.subRepo.update(existing.id, { status: "past_due" });

    logger.info(
      { subscriptionId: existing.id },
      "[stripe-sub-webhook] payment failed — marked past_due",
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/manager-subscription/stripe-subscription-webhook.handler.ts
git commit -m "feat(api): add Stripe subscription webhook handler"
```

---

## Task 5: Rewrite Manager Subscription Service

**Files:**
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.service.ts`
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.service.test.ts`

- [ ] **Step 1: Rewrite the service**

Replace `apps/api/src/modules/manager-subscription/manager-subscription.service.ts`:

```typescript
import type Stripe from "stripe";
import { HttpError } from "../../lib/http-error.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type {
  IManagerSubscriptionRepository,
  ManagerSubscriptionRow,
} from "./manager-subscription.repository.js";

export class ManagerSubscriptionService {
  constructor(
    private readonly subRepo: IManagerSubscriptionRepository,
    private readonly acadRepo: IAcademyRepository,
    private readonly stripe: Stripe | null = null,
  ) {}

  async getSubscription(
    academyId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    return this.subRepo.findByAcademyId(academyId);
  }

  async isSubscriptionActive(academyId: string): Promise<boolean> {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub) return false;
    return sub.status === "active" || sub.status === "trialing";
  }

  async createCheckoutSession(
    clerkUserId: string,
    email: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<string> {
    if (!this.stripe) throw new HttpError(503, "Stripe not configured");

    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: { clerkUserId },
      },
      metadata: { clerkUserId },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return session.url!;
  }

  /**
   * Called when a manager creates an academy in the app.
   * Checks if the user has pending Stripe subscription data and links it.
   */
  async linkPendingSubscription(
    userId: string,
    academyId: string,
    userRepo: { findById(id: string): Promise<any>; clearPendingStripe(id: string): Promise<void> },
  ): Promise<void> {
    if (!this.stripe) return;

    const user = await userRepo.findById(userId);
    if (!user?.pendingStripeCustomerId || !user?.pendingStripeSubscriptionId) return;

    const stripeSub = await this.stripe.subscriptions.retrieve(
      user.pendingStripeSubscriptionId,
    );

    await this.subRepo.upsertByAcademy({
      academyId,
      plan: "pro",
      status: this.mapStripeStatus(stripeSub.status),
      stripeCustomerId: user.pendingStripeCustomerId,
      stripeSubscriptionId: user.pendingStripeSubscriptionId,
      stripePriceId: stripeSub.items.data[0]?.price.id ?? null,
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      trialEndsAt: stripeSub.trial_end
        ? new Date(stripeSub.trial_end * 1000)
        : null,
    });

    await userRepo.clearPendingStripe(userId);
  }

  private mapStripeStatus(
    status: string,
  ): "active" | "trialing" | "past_due" | "canceled" | "incomplete" {
    switch (status) {
      case "active": return "active";
      case "trialing": return "trialing";
      case "past_due": return "past_due";
      case "canceled":
      case "unpaid": return "canceled";
      default: return "incomplete";
    }
  }

  async cancelSubscription(academyId: string): Promise<void> {
    if (!this.stripe) throw new HttpError(503, "Stripe not configured");

    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub?.stripeSubscriptionId) {
      throw new HttpError(404, "No active subscription found");
    }

    await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await this.subRepo.update(sub.id, {
      canceledAt: new Date(),
    });
  }

  async reactivateSubscription(academyId: string): Promise<void> {
    if (!this.stripe) throw new HttpError(503, "Stripe not configured");

    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub?.stripeSubscriptionId) {
      throw new HttpError(404, "No subscription found");
    }

    await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await this.subRepo.update(sub.id, {
      canceledAt: null,
    });
  }

  async createBillingPortalSession(
    academyId: string,
    returnUrl: string,
  ): Promise<string> {
    if (!this.stripe) throw new HttpError(503, "Stripe not configured");

    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub?.stripeCustomerId) {
      throw new HttpError(404, "No subscription found");
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: returnUrl,
    });

    return session.url;
  }
}
```

- [ ] **Step 2: Rewrite the tests**

Replace `apps/api/src/modules/manager-subscription/manager-subscription.service.test.ts` with tests for the new service. Test:

- `getSubscription()` returns subscription or undefined
- `isSubscriptionActive()` returns true for "active" and "trialing", false for others
- `cancelSubscription()` throws 404 when no subscription found
- `cancelSubscription()` throws 503 when Stripe not configured

Use the in-memory repository. For Stripe calls, pass `null` as the Stripe client and test only the non-Stripe paths (Stripe interactions are covered by integration/e2e tests).

- [ ] **Step 3: Run tests**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx vitest run apps/api/src/modules/manager-subscription/
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/manager-subscription/manager-subscription.service.ts apps/api/src/modules/manager-subscription/manager-subscription.service.test.ts
git commit -m "feat(api): rewrite manager subscription service for Stripe"
```

---

## Task 6: Rewrite Routes & Delete RevenueCat Files

**Files:**
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts`
- Delete: `apps/api/src/modules/manager-subscription/revenuecat-client.ts`
- Delete: `apps/api/src/modules/manager-subscription/revenuecat-events.ts`
- Delete: `apps/api/src/modules/manager-subscription/revenuecat-webhook.handler.ts`
- Modify: `apps/api/src/modules/membership/membership.routes.ts:161-163`
- Modify: `apps/api/src/modules/subscription/subscription.routes.ts:99`
- Modify: `apps/api/src/modules/class/class.routes.ts:125`

- [ ] **Step 1: Rewrite the routes file**

Replace `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts`:

```typescript
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
import { PostgresManagerSubscriptionRepository } from "./manager-subscription.repository.postgres.js";
import { ManagerSubscriptionService } from "./manager-subscription.service.js";
import { StripeSubscriptionWebhookHandler } from "./stripe-subscription-webhook.handler.js";
import { PostgresPaymentRepository } from "../payment/payment.repository.postgres.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { AbacatePayWebhookHandler } from "../payment/abacatepay-webhook.handler.js";
import { StripeCheckoutWebhookHandler } from "../payment/stripe-checkout-webhook.handler.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";

const db = getDb();
const env = loadEnv();
const subRepo = new PostgresManagerSubscriptionRepository(db);
const acadRepo = new PostgresAcademyRepository(db);
const userRepo = new PostgresUserRepository(db);

const emailService = env.REDIS_URL
  ? new EmailService(getEmailQueue(env.REDIS_URL))
  : null;

const paymentRepo = new PostgresPaymentRepository(db);

let stripe: ReturnType<typeof getStripe> | null = null;
try {
  stripe = getStripe();
} catch {
  // Stripe not configured — service methods will throw 503
}

const service = new ManagerSubscriptionService(subRepo, acadRepo, stripe);

export const managerSubscriptionRouter = Router();

// GET /manager-subscriptions/me — get current subscription
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

// POST /manager-subscriptions/checkout — create Stripe Checkout session
// NOTE: This route does NOT require an academy. The manager may not have one yet
// (they create account + pay on web, then create academy in the app).
managerSubscriptionRouter.post(
  "/checkout",
  authorize(Role.Manager),
  async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.STRIPE_MANAGER_PRICE_ID) {
        throw new HttpError(503, "Stripe manager price not configured");
      }
      const user = await userRepo.findById(req.appAuth!.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const { successUrl, cancelUrl } = req.body as {
        successUrl: string;
        cancelUrl: string;
      };
      if (!successUrl || !cancelUrl) {
        res.status(400).json({ error: "successUrl and cancelUrl are required" });
        return;
      }
      const url = await service.createCheckoutSession(
        user.clerkUserId,
        user.email,
        env.STRIPE_MANAGER_PRICE_ID,
        successUrl,
        cancelUrl,
      );
      res.json({ url });
    } catch (e) {
      next(e);
    }
  },
);

// POST /manager-subscriptions/cancel — cancel at period end
managerSubscriptionRouter.post(
  "/cancel",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      await service.cancelSubscription(req.appAuth!.activeAcademyId!);
      res.json({ canceled: true });
    } catch (e) {
      next(e);
    }
  },
);

// POST /manager-subscriptions/reactivate — undo cancel
managerSubscriptionRouter.post(
  "/reactivate",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      await service.reactivateSubscription(req.appAuth!.activeAcademyId!);
      res.json({ reactivated: true });
    } catch (e) {
      next(e);
    }
  },
);

// POST /manager-subscriptions/billing-portal — get Stripe billing portal URL
managerSubscriptionRouter.post(
  "/billing-portal",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const { returnUrl } = req.body as { returnUrl: string };
      if (!returnUrl) {
        res.status(400).json({ error: "returnUrl is required" });
        return;
      }
      const url = await service.createBillingPortalSession(
        req.appAuth!.activeAcademyId!,
        returnUrl,
      );
      res.json({ url });
    } catch (e) {
      next(e);
    }
  },
);

// Webhook router
const stripeSubWebhookHandler = new StripeSubscriptionWebhookHandler(
  subRepo,
  acadRepo,
  userRepo,
  emailService,
);

export function createWebhookRouter() {
  const webhookRouter = Router();

  // Stripe subscription webhooks (manager)
  webhookRouter.post("/stripe-subscription", async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.STRIPE_MANAGER_WEBHOOK_SECRET) {
        throw new HttpError(503, "Stripe manager webhook secret not configured");
      }
      const stripeInstance = getStripe();
      const sig = req.headers["stripe-signature"];
      if (!sig) {
        res.status(400).json({ error: "Missing stripe-signature header" });
        return;
      }
      const event = stripeInstance.webhooks.constructEvent(
        (req as any).rawBody,
        sig,
        env.STRIPE_MANAGER_WEBHOOK_SECRET,
      );

      // Handle checkout.session.completed to link subscription to academy
      if (event.type === "checkout.session.completed") {
        await service.handleCheckoutCompleted(
          event.data.object as any,
        );
      }

      await stripeSubWebhookHandler.handleEvent(event);
      res.json({ received: true });
    } catch (e) {
      if (e instanceof Error && e.message.includes("signature")) {
        res.status(400).json({ error: "Invalid webhook signature" });
        return;
      }
      logger.error({ err: e }, "[stripe-subscription webhook] handler error");
      next(e);
    }
  });

  // AbacatePay (student PIX payments — unchanged)
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

  // Stripe checkout (student payments — unchanged)
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
      const stripeInstance = getStripe();
      const sig = req.headers["stripe-signature"];
      if (!sig) {
        res.status(400).json({ error: "Missing stripe-signature header" });
        return;
      }
      const event = stripeInstance.webhooks.constructEvent(
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

- [ ] **Step 2: Remove free plan limit calls from other modules**

In `apps/api/src/modules/membership/membership.routes.ts` around line 161, remove the `canApproveInstructor` and `canApproveStudent` calls and their surrounding if-blocks. The membership approval should proceed without plan limit checks.

In `apps/api/src/modules/subscription/subscription.routes.ts` around line 99, remove the `canCreatePlan` call.

In `apps/api/src/modules/class/class.routes.ts` around line 125, remove the `canCreateClass` call.

Also remove the `managerSubService` import/instantiation from those files if it's no longer used for anything else.

- [ ] **Step 3: Link pending subscription on academy creation**

In `apps/api/src/modules/academy/academy.routes.ts`, find the POST route that creates an academy. After the academy is created successfully, add a call to link any pending Stripe subscription:

```typescript
// After academy creation:
await managerSubService.linkPendingSubscription(
  req.appAuth!.userId,
  newAcademy.id,
  userRepo,
);
```

This ensures that when a manager who signed up on the web creates their academy in the app, the Stripe subscription is automatically linked.

Also add `updatePendingStripe(id, data)` and `clearPendingStripe(id)` methods to the user repository interface and Postgres implementation.

- [ ] **Step 4: Delete RevenueCat files**

```bash
rm apps/api/src/modules/manager-subscription/revenuecat-client.ts
rm apps/api/src/modules/manager-subscription/revenuecat-events.ts
rm apps/api/src/modules/manager-subscription/revenuecat-webhook.handler.ts
```

- [ ] **Step 5: Register new webhook path in `app.ts`**

Check `apps/api/src/app.ts` for the raw body middleware. Make sure the path `/v1/webhooks/stripe-subscription` is included in the raw body handling condition (alongside the existing `/v1/webhooks/stripe`). Look for where `rawBody` is set and add the new path.

- [ ] **Step 6: Verify build**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo build --filter=api
```

Expected: Build succeeds with no errors.

- [ ] **Step 7: Run all API tests**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx vitest run apps/api/
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add -A apps/api/src/modules/manager-subscription/ apps/api/src/modules/membership/membership.routes.ts apps/api/src/modules/subscription/subscription.routes.ts apps/api/src/modules/class/class.routes.ts apps/api/src/modules/academy/ apps/api/src/modules/user/ apps/api/src/app.ts
git commit -m "feat(api): rewrite manager subscription routes for Stripe, remove RevenueCat"
```

---

## Task 7: Web App — Clerk Setup & Middleware

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/middleware.ts`
- Create: `apps/web/lib/manager-api.ts`

- [ ] **Step 1: Add ClerkProvider to root layout**

Modify `apps/web/app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tatame — Sua academia na palma da mão",
  description:
    "Gerencie turmas, controle presenças, acompanhe graduações e pagamentos — tudo em um só lugar.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="pt-BR" className={`${sora.variable} ${inter.variable}`}>
        <body className="font-[family-name:var(--font-inter)] antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Create Clerk middleware**

Create `apps/web/middleware.ts`:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/conta(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
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

- [ ] **Step 3: Create manager API helper**

Create `apps/web/lib/manager-api.ts`:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function managerFetch<T>(
  path: string,
  token: string | null,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }

  return res.json();
}
```

- [ ] **Step 4: Add Clerk env vars to `.env.local`**

The web app needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. Verify these are set in the project's env files. Also add:

```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/conta/login
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/conta
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/middleware.ts apps/web/lib/manager-api.ts
git commit -m "feat(web): add Clerk auth provider and middleware for manager portal"
```

---

## Task 8: Web App — Signup Page (`/cadastro`)

**Files:**
- Create: `apps/web/app/cadastro/page.tsx`

- [ ] **Step 1: Build the signup page**

Create `apps/web/app/cadastro/page.tsx`. This is a client component with two states:

**Unauthenticated state:**
- Logo + "Crie sua conta" heading + "Comece seus 30 dias grátis agora" subtitle
- "Cadastrar com Google" button (calls `signUp.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/cadastro", redirectUrlComplete: "/cadastro" })`)
- "Cadastrar com Apple" button (same pattern with `oauth_apple`)
- Divider "ou"
- Name (first + last), email, password fields
- "Criar conta e assinar" button → calls Clerk `signUp.create()` then proceeds to checkout

**Authenticated state:**
- Shows `✓ Logado como {email}` with green checkmark
- "Ir para pagamento" button → calls API `POST /v1/manager-subscriptions/checkout` with `successUrl` and `cancelUrl`, redirects to Stripe Checkout URL
- The checkout route does NOT require an academy — it uses `clerkUserId` from the auth token

**Post-Stripe return:**
- Detects `?checkout=session_id` query param
- Shows button in loading state
- Polls or waits briefly, then redirects to `/assinatura-confirmada`
- On failure: shows error message

Use `@clerk/nextjs` hooks: `useSignUp`, `useUser`, `useAuth`. Follow the existing dark theme from the Pencil design (W-PUB-05: node `iAfIR`).

**Subscription linking:** The Stripe subscription data is stored as pending on the user record via webhook. When the manager creates their academy in the app, the API automatically links the subscription to the new academy (see Task 6 step 3).

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/cadastro/
git commit -m "feat(web): add manager signup page with Clerk auth + Stripe checkout"
```

---

## Task 9: Web App — Subscription Confirmed Page

**Files:**
- Create: `apps/web/app/assinatura-confirmada/page.tsx`

- [ ] **Step 1: Build the confirmation page**

Create `apps/web/app/assinatura-confirmada/page.tsx`. Follow the Pencil design (W-PUB-06: node `vfdqo`):

- Green checkmark icon at top
- "Assinatura confirmada!" heading
- "Parabéns! Seu plano Tatame Pro está ativo com 30 dias grátis." subtitle
- "Confira seu e-mail" callout box
- "Baixe o app e cadastre sua academia" section with App Store and Google Play buttons
- "Próximos passos" numbered list:
  1. Baixe o app na App Store ou Google Play
  2. Faça login com a conta que você acabou de criar
  3. Cadastre sua academia e comece a usar

This is a simple static page. No API calls needed. Use the existing dark theme.

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/assinatura-confirmada/
git commit -m "feat(web): add subscription confirmed page"
```

---

## Task 10: Web App — Manager Login Page

**Files:**
- Create: `apps/web/app/conta/login/[[...sign-in]]/page.tsx`

- [ ] **Step 1: Build the login page**

Create `apps/web/app/conta/login/[[...sign-in]]/page.tsx`. Follow the Pencil design (W-MGR-01: node `Ac4D6`):

- Centered card with logo + "TATAME" + "Área do Gestor" subtitle
- Email field + password field
- "Entrar" primary button (purple)
- Divider "ou"
- "Entrar com Google" button
- "Entrar com Apple" button

Use Clerk's `useSignIn` hook for the login flow. On success, redirect to `/conta`.

The `[[...sign-in]]` catch-all route is the Clerk convention for custom sign-in pages.

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/conta/login/
git commit -m "feat(web): add custom manager login page"
```

---

## Task 11: Web App — Manager Dashboard Layout

**Files:**
- Create: `apps/web/app/conta/(dashboard)/layout.tsx`

- [ ] **Step 1: Build the sidebar layout**

Create `apps/web/app/conta/(dashboard)/layout.tsx`. Follow the Pencil design (W-MGR-02: node `CKUpC`):

- Left sidebar (260px) with dark background:
  - Logo + "TATAME" at top
  - Navigation links: "Financeiro" (`/conta`), "Assinatura" (`/conta/assinatura`)
  - Active state: purple highlight
- Main content area fills remaining width
- On mobile: responsive — sidebar collapses to hamburger menu (follow W-MGR-02-M design)

Use `usePathname()` from `next/navigation` to determine active link. Use `UserButton` from Clerk for logout.

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/conta/\(dashboard\)/layout.tsx
git commit -m "feat(web): add manager dashboard sidebar layout"
```

---

## Task 12: Web App — Financial Dashboard Page

**Files:**
- Create: `apps/web/app/conta/(dashboard)/page.tsx`

- [ ] **Step 1: Build the financial dashboard**

Create `apps/web/app/conta/(dashboard)/page.tsx`. Follow the Pencil design (W-MGR-02: node `CKUpC`):

- "Financeiro" heading + "Resumo financeiro da sua academia" subtitle
- 4 KPI cards in a row: Alunos Ativos, Receita Mensal, Check-ins do Mês, Inadimplência
- Two-column section: "Receita por Plano" (bar chart) + "Resumo do Mês" (Recebido, Pendente, Atrasado)
- "Transações Recentes" table with pagination

This page makes API calls using the Clerk token (via `useAuth().getToken()`). Use `managerFetch()` from `lib/manager-api.ts`.

API endpoints to call (already exist for the mobile app):
- `GET /v1/finances/summary` — KPIs
- `GET /v1/payments?limit=10&page=1` — transactions

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/conta/\(dashboard\)/page.tsx
git commit -m "feat(web): add manager financial dashboard page"
```

---

## Task 13: Web App — Subscription Management Page

**Files:**
- Create: `apps/web/app/conta/(dashboard)/assinatura/page.tsx`

- [ ] **Step 1: Build the subscription page**

Create `apps/web/app/conta/(dashboard)/assinatura/page.tsx`. Follow the Pencil design (W-MGR-03: node `xWgHI`):

- "Assinatura" heading + "Gerencie seu plano e método de pagamento" subtitle
- Plan card: "Pro" with status badge, price R$49/mês, next billing date, subscriber since date
- Payment method card: "Visa •••• 4242", expiration, "Atualizar cartão" button
- "Dados de pagamento" button → calls `POST /v1/manager-subscriptions/billing-portal` → redirects to Stripe portal URL
- "Histórico de Pagamentos" table: description, date, method, value, status
- "Cancelar assinatura" danger button at bottom → confirmation dialog → calls `POST /v1/manager-subscriptions/cancel`

API endpoints:
- `GET /v1/manager-subscriptions/me` — current subscription
- `POST /v1/manager-subscriptions/billing-portal` — get Stripe portal URL
- `POST /v1/manager-subscriptions/cancel` — cancel subscription
- `POST /v1/manager-subscriptions/reactivate` — undo cancellation

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/conta/\(dashboard\)/assinatura/
git commit -m "feat(web): add subscription management page"
```

---

## Task 14: Update Landing Page Pricing

**Files:**
- Modify: `apps/web/components/pricing.tsx`

- [ ] **Step 1: Update pricing component**

Modify `apps/web/components/pricing.tsx` to show a single plan instead of two:

- Remove the Free plan card entirely
- Show single "Pro" plan card: R$49/mês
- Add prominent "30 dias grátis" badge/text
- Add "Cancele a qualquer momento" messaging
- CTA button text: "Começar teste grátis" linking to `/cadastro`
- List all features (everything that was in Pro)

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/pricing.tsx
git commit -m "feat(web): update pricing to single plan with trial messaging"
```

---

## Task 15: Mobile — Remove RevenueCat & Update Flows

**Files:**
- Delete: `apps/mobile/lib/revenuecat.ts`
- Delete: `apps/mobile/lib/hooks/use-revenuecat.ts`
- Delete: `apps/mobile/app/(app)/(manager)/plan-selection.tsx`
- Delete: `apps/mobile/app/(app)/(manager)/subscription-result.tsx`
- Delete: `apps/mobile/constants/manager-plans.ts`
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/app/(app)/(manager)/_layout.tsx`
- Modify: `apps/mobile/app/(app)/(manager)/(finances)/my-plan.tsx`
- Modify: `apps/mobile/app/(app)/(manager)/(finances)/index.tsx`
- Modify: `apps/mobile/app/(onboarding)/user-type.tsx`
- Modify: `apps/mobile/lib/hooks/use-manager-subscription.ts`
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Delete RevenueCat files**

```bash
rm apps/mobile/lib/revenuecat.ts
rm apps/mobile/lib/hooks/use-revenuecat.ts
rm apps/mobile/app/\(app\)/\(manager\)/plan-selection.tsx
rm apps/mobile/app/\(app\)/\(manager\)/subscription-result.tsx
rm apps/mobile/constants/manager-plans.ts
```

- [ ] **Step 2: Remove RevenueCat from `_layout.tsx`**

In `apps/mobile/app/_layout.tsx`, remove lines 5-6 (imports of `identifyRevenueCatUser`, `initRevenueCat`) and the calls at lines 42 and 48. Remove the `react-native-purchases` import if present.

- [ ] **Step 3: Update manager subscription hook types**

In `apps/mobile/lib/hooks/use-manager-subscription.ts`, update the `ManagerSubscription` type:

```typescript
export type ManagerSubscription = {
  id: string;
  academyId: string;
  plan: "free" | "pro";
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  subscribedAt: string;
  canceledAt: string | null;
};
```

Remove `useSelectFreePlan` and `useManagerLimits` functions — they are no longer needed.

- [ ] **Step 4: Rewrite manager `_layout.tsx`**

Replace the gating logic in `apps/mobile/app/(app)/(manager)/_layout.tsx`. Instead of redirecting to `plan-selection`, check if subscription is active/trialing. If not, show a blocked screen inline:

```typescript
import { useManagerSubscription } from "@/lib/hooks/use-manager-subscription";
import { Tabs } from "expo-router";
import { Calendar, CreditCard, Home, Users } from "lucide-react-native";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";

const PORTAL_URL = Constants.expoConfig?.extra?.managerPortalUrl ?? "";

export default function ManagerLayout() {
  const insets = useSafeAreaInsets();
  const { data: subscription, isPending } = useManagerSubscription();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  const isActive =
    subscription?.status === "active" || subscription?.status === "trialing";

  if (!isActive) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6" style={{ gap: 16 }}>
        <Text className="font-poppins-bold text-xl text-primary text-center">
          Assinatura inativa
        </Text>
        <Text className="font-poppins text-sm text-center" style={{ color: "#ABABAB" }}>
          Sua assinatura não está ativa. Acesse o portal web para regularizar sua conta.
        </Text>
        <Pressable
          onPress={() => Linking.openURL(PORTAL_URL)}
          className="items-center rounded-xl bg-accent px-6 py-3"
        >
          <Text className="font-poppins-semibold text-sm text-white">
            Gerenciar minha conta
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#0C0C0C" },
        tabBarStyle: {
          backgroundColor: "#1A1A1A",
          borderTopColor: "#2A2A2A",
          borderTopWidth: 1,
          height: 56 + Math.max(insets.bottom, 8),
        },
        tabBarActiveTintColor: "#A078E8",
        tabBarInactiveTintColor: "#ABABAB",
        tabBarLabelStyle: { fontFamily: "Poppins_500Medium", fontSize: 11 },
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
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(classes)"
        options={{
          title: "Aulas",
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(finances)"
        options={{
          title: "Finanças",
          tabBarIcon: ({ color, size }) => <CreditCard size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 5: Rewrite `my-plan.tsx`**

Replace `apps/mobile/app/(app)/(manager)/(finances)/my-plan.tsx` with a simplified version:

- Shows current plan info (Pro, status, price, dates) — keep the existing plan card UI
- Remove "Alterar plano", "Gerenciar assinatura", and "Restaurar compras" buttons
- Add single "Gerenciar minha conta" button that opens `PORTAL_URL` in browser via `Linking.openURL()`
- Remove all RevenueCat imports and `openManageSubscription()` function

- [ ] **Step 6: Update finances `index.tsx`**

In `apps/mobile/app/(app)/(manager)/(finances)/index.tsx`:

- Update the plan card (around lines 202-269) to remove Free/Pro conditional styling
- Always show "PRO" badge since there's no free plan
- The "Plano atual" pressable should open the web portal instead of navigating to `my-plan`

- [ ] **Step 7: Update onboarding `user-type.tsx`**

In `apps/mobile/app/(onboarding)/user-type.tsx`, remove the "Gestor" option from the role selection cards. Only show "Instrutor" and "Aluno". Managers create their accounts via web.

- [ ] **Step 8: Add `managerPortalUrl` to Expo config**

In the Expo config (`app.config.ts` or `app.json`), add the portal URL from env:

```javascript
extra: {
  managerPortalUrl: process.env.MANAGER_PORTAL_URL ?? "https://tatame.app/conta",
},
```

- [ ] **Step 9: Remove `react-native-purchases` dependency**

```bash
cd apps/mobile && npm uninstall react-native-purchases
```

- [ ] **Step 10: Verify mobile build**

```bash
cd apps/mobile && npx expo export --platform ios 2>&1 | head -20
```

Expected: No import errors related to RevenueCat.

- [ ] **Step 11: Commit**

```bash
git add -A apps/mobile/
git commit -m "feat(mobile): remove RevenueCat, update manager flows to use web portal"
```

---

## Task 16: Final Integration Verification

- [ ] **Step 1: Build all packages**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx turbo build
```

Expected: All packages build successfully.

- [ ] **Step 2: Run all tests**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Verify no stale RevenueCat references**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && grep -r "revenuecat\|RevenueCat\|react-native-purchases\|REVENUECAT" --include="*.ts" --include="*.tsx" --include="*.json" apps/ packages/ | grep -v node_modules | grep -v ".md"
```

Expected: No results (all references removed).

- [ ] **Step 4: Commit any remaining cleanup**

```bash
git add -A && git commit -m "chore: final cleanup of RevenueCat references"
```
