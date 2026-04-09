# AbacatePay Pix Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Pix payment via AbacatePay alongside existing Stripe card checkout for student subscription payments.

**Architecture:** New `POST /v1/payments/checkout/pix` endpoint creates an AbacatePay billing, returns a checkout URL. New `POST /v1/webhooks/abacatepay` handles `billing.paid` events. Mobile shows two buttons ("Pagar com Pix" / "Pagar com cartão"). Stripe checkout remains for cards only (`payment_method_types: ["card"]`).

**Tech Stack:** AbacatePay Node.js SDK, Express, Drizzle ORM, Expo WebBrowser

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `packages/db/src/schema/index.ts` | Add `pix` to `paymentMethodEnum` |
| Create | `packages/db/drizzle/0004_*.sql` | Migration (generated) |
| Modify | `packages/config/src/env.ts` | Add `ABACATEPAY_API_KEY` |
| Create | `apps/api/src/lib/abacatepay.ts` | AbacatePay client singleton |
| Modify | `apps/api/src/modules/payment/payment.repository.ts` | Widen `method` type to include `pix` |
| Modify | `apps/api/src/modules/payment/payment.repository.postgres.ts` | Same widening |
| Modify | `apps/api/src/modules/payment/payment.repository.in-memory.ts` | Same widening |
| Modify | `apps/api/src/modules/payment/payment.service.ts` | Add `createPixCheckoutSession`, fix Stripe `payment_method_types` |
| Modify | `apps/api/src/modules/payment/payment.routes.ts` | Add `POST /checkout/pix` route |
| Create | `apps/api/src/modules/payment/abacatepay-webhook.handler.ts` | AbacatePay webhook handler |
| Modify | `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts` | Mount AbacatePay webhook route |
| Modify | `apps/mobile/lib/hooks/use-subscription.ts` | Add `useCreatePixCheckout` hook |
| Modify | `apps/mobile/app/(app)/(student)/(subscription)/index.tsx` | Two payment buttons |

---

### Task 1: Database — Add `pix` to payment_method enum

**Files:**
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Add `pix` to paymentMethodEnum**

In `packages/db/src/schema/index.ts`, change:

```typescript
export const paymentMethodEnum = pgEnum("payment_method", [
  "manual",
  "stripe",
]);
```

to:

```typescript
export const paymentMethodEnum = pgEnum("payment_method", [
  "manual",
  "stripe",
  "pix",
]);
```

- [ ] **Step 2: Generate migration**

```bash
cd packages/db && pnpm generate
```

Expected: New migration file `drizzle/0004_*.sql` with `ALTER TYPE "payment_method" ADD VALUE 'pix'`.

- [ ] **Step 3: Commit**

```bash
git add packages/db/
git commit -m "feat(db): add pix to payment_method enum"
```

---

### Task 2: Config + AbacatePay Client

**Files:**
- Modify: `packages/config/src/env.ts`
- Create: `apps/api/src/lib/abacatepay.ts`

- [ ] **Step 1: Add ABACATEPAY_API_KEY to env schema**

In `packages/config/src/env.ts`, add after `STRIPE_PRO_PRICE_ID`:

```typescript
  ABACATEPAY_API_KEY: z.string().optional(),
```

- [ ] **Step 2: Install AbacatePay SDK**

```bash
cd apps/api && pnpm add abacatepay-nodejs-sdk
```

- [ ] **Step 3: Create AbacatePay client singleton**

Create `apps/api/src/lib/abacatepay.ts`:

```typescript
import AbacatePay from "abacatepay-nodejs-sdk";
import { loadEnv } from "@tatame/config";

let client: ReturnType<typeof AbacatePay> | null = null;

export function getAbacatePay(): ReturnType<typeof AbacatePay> {
  if (!client) {
    const env = loadEnv();
    if (!env.ABACATEPAY_API_KEY) {
      throw new Error("ABACATEPAY_API_KEY is not configured");
    }
    client = AbacatePay(env.ABACATEPAY_API_KEY);
  }
  return client;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/config/src/env.ts apps/api/src/lib/abacatepay.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): add AbacatePay SDK and client singleton"
```

---

### Task 3: Payment Repository — Widen method type for `pix`

**Files:**
- Modify: `apps/api/src/modules/payment/payment.repository.ts`
- Modify: `apps/api/src/modules/payment/payment.repository.postgres.ts`
- Modify: `apps/api/src/modules/payment/payment.repository.in-memory.ts`

- [ ] **Step 1: Update IPaymentRepository interface**

In `apps/api/src/modules/payment/payment.repository.ts`, change the `create` method's `method` field:

```typescript
    method: "manual" | "stripe" | "pix";
```

- [ ] **Step 2: Update PostgresPaymentRepository**

In `apps/api/src/modules/payment/payment.repository.postgres.ts`, change the `create` method's `method` field:

```typescript
    method: "manual" | "stripe" | "pix";
```

- [ ] **Step 3: Update InMemoryPaymentRepository (if exists)**

In `apps/api/src/modules/payment/payment.repository.in-memory.ts`, same change to the `create` method signature.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/payment/
git commit -m "feat(api): widen payment method type to include pix"
```

---

### Task 4: Payment Service — Add Pix Checkout + Fix Stripe payment_method_types

**Files:**
- Modify: `apps/api/src/modules/payment/payment.service.ts`

- [ ] **Step 1: Fix Stripe checkout to card-only**

In `apps/api/src/modules/payment/payment.service.ts`, in `createCheckoutSession`, change:

```typescript
      payment_method_types: ["card", "pix"],
```

to:

```typescript
      payment_method_types: ["card"],
```

- [ ] **Step 2: Add createPixCheckoutSession method**

Add after `createCheckoutSession`:

```typescript
  async createPixCheckoutSession(
    studentUserId: string,
    academyId: string,
    studentEmail: string,
    abacatePay: { billing: { create: (data: any) => Promise<any> } },
    opts?: { subscriptionId?: string },
  ): Promise<{ checkoutUrl: string }> {
    const subs = await this.studentSubRepo.listWithPlanByUserAndAcademy(
      studentUserId,
      academyId,
    );
    const active = opts?.subscriptionId
      ? subs.find(
          (s) =>
            s.subscription.id === opts.subscriptionId &&
            s.subscription.status === "active",
        )
      : subs.find((s) => s.subscription.status === "active");

    if (!active) {
      throw new HttpError(404, "No active subscription found");
    }

    const { subscription, plan } = active;

    const today = new Date().toISOString().slice(0, 10);
    const referenceMonth = today.slice(0, 7) + "-01";

    const alreadyPaid = await this.paymentRepo.existsForSubscriptionReferenceMonth(
      subscription.id,
      referenceMonth,
    );
    if (alreadyPaid) {
      throw new HttpError(409, "Payment already exists for this period");
    }

    const metadata = JSON.stringify({
      subscriptionId: subscription.id,
      userId: studentUserId,
      academyId,
      referenceMonth,
    });

    const billing = await abacatePay.billing.create({
      frequency: "ONE_TIME",
      methods: ["PIX"],
      products: [
        {
          externalId: metadata,
          name: `${plan.name} — ${referenceMonth.slice(0, 7)}`,
          quantity: 1,
          price: plan.priceCents,
        },
      ],
      returnUrl: "tatame://payment-success",
      completionUrl: "tatame://payment-success",
      customer: {
        email: studentEmail,
      },
    });

    const checkoutUrl = billing?.data?.url ?? billing?.url;
    if (!checkoutUrl) {
      throw new HttpError(500, "Failed to create AbacatePay billing");
    }

    return { checkoutUrl };
  }
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/payment/payment.service.ts
git commit -m "feat(api): add Pix checkout via AbacatePay and fix Stripe to card-only"
```

---

### Task 5: Payment Route — Add POST /checkout/pix

**Files:**
- Modify: `apps/api/src/modules/payment/payment.routes.ts`

- [ ] **Step 1: Add import**

Add at top of `apps/api/src/modules/payment/payment.routes.ts`:

```typescript
import { getAbacatePay } from "../../lib/abacatepay.js";
```

- [ ] **Step 2: Add the route after the existing POST /checkout**

Add after the `paymentRouter.post("/checkout", ...)` block:

```typescript
paymentRouter.post(
  "/checkout/pix",
  authorize(Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(createCheckoutBodySchema),
  async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.ABACATEPAY_API_KEY) {
        throw new HttpError(503, "AbacatePay is not configured");
      }

      const body = req.validatedBody as CreateCheckoutBody;
      const studentUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;

      const student = await userRepo.findById(studentUserId);
      if (!student) {
        throw new HttpError(404, "Student not found");
      }

      const abacatePay = getAbacatePay();

      const result = await paymentService.createPixCheckoutSession(
        studentUserId,
        academyId,
        student.email,
        abacatePay,
        { subscriptionId: body.subscriptionId },
      );

      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/payment/payment.routes.ts
git commit -m "feat(api): add POST /payments/checkout/pix route"
```

---

### Task 6: AbacatePay Webhook Handler

**Files:**
- Create: `apps/api/src/modules/payment/abacatepay-webhook.handler.ts`
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts`

- [ ] **Step 1: Create the webhook handler**

Create `apps/api/src/modules/payment/abacatepay-webhook.handler.ts`:

```typescript
import type { IPaymentRepository } from "./payment.repository.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { EmailService } from "../email/email.service.js";

type BillingPaidEvent = {
  event: string;
  data: {
    payment: {
      amount: number;
      fee: number;
      method: string;
    };
    billing: {
      id: string;
      amount: number;
      paidAmount: number;
      status: string;
      products: Array<{
        externalId: string;
        id: string;
        quantity: number;
      }>;
      customer: {
        id: string;
        metadata: {
          email: string;
          name: string;
        };
      };
    };
  };
};

type PaymentMetadata = {
  subscriptionId: string;
  userId: string;
  academyId: string;
  referenceMonth: string;
};

export class AbacatePayWebhookHandler {
  constructor(
    private readonly paymentRepo: IPaymentRepository,
    private readonly userRepo: IUserRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly emailService: EmailService | null,
  ) {}

  async handleEvent(body: BillingPaidEvent): Promise<void> {
    if (body.event !== "billing.paid") return;

    const billing = body.data.billing;
    const product = billing.products[0];
    if (!product?.externalId) return;

    let meta: PaymentMetadata;
    try {
      meta = JSON.parse(product.externalId);
    } catch {
      return;
    }

    if (!meta.subscriptionId || !meta.userId || !meta.academyId || !meta.referenceMonth) {
      return;
    }

    // Idempotency: check if payment already exists for this billing
    const existing = await this.paymentRepo.findByStripePaymentId(billing.id);
    if (existing) return;

    const payment = await this.paymentRepo.create({
      subscriptionId: meta.subscriptionId,
      userId: meta.userId,
      academyId: meta.academyId,
      amountCents: billing.paidAmount ?? billing.amount,
      method: "pix",
      confirmedBy: null,
      stripePaymentId: billing.id,
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

- [ ] **Step 2: Mount webhook in createWebhookRouter**

In `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts`, add imports at top:

```typescript
import { PostgresPaymentRepository } from "../payment/payment.repository.postgres.js";
import { AbacatePayWebhookHandler } from "../payment/abacatepay-webhook.handler.js";
```

Note: `PostgresPaymentRepository` may already be imported (from the previous TAT-94 work). If so, just add the `AbacatePayWebhookHandler` import.

Inside the `createWebhookRouter` function, after the existing `webhookRouter.post("/stripe", ...)` block, add:

```typescript
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
```

Note: `paymentRepo`, `userRepo`, `acadRepo`, and `emailService` are already defined at module scope in this file.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/payment/abacatepay-webhook.handler.ts apps/api/src/modules/manager-subscription/manager-subscription.routes.ts
git commit -m "feat(api): add AbacatePay webhook handler for billing.paid"
```

---

### Task 7: Mobile — Add Pix Checkout Hook

**Files:**
- Modify: `apps/mobile/lib/hooks/use-subscription.ts`

- [ ] **Step 1: Add useCreatePixCheckout hook**

Append to `apps/mobile/lib/hooks/use-subscription.ts`:

```typescript
export function useCreatePixCheckout() {
  const api = useApi();

  return useMutation({
    mutationFn: (body?: { subscriptionId?: string }) =>
      api.post<{ checkoutUrl: string }>("/payments/checkout/pix", body ?? {}),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/lib/hooks/use-subscription.ts
git commit -m "feat(mobile): add useCreatePixCheckout hook"
```

---

### Task 8: Mobile — Two Payment Buttons on Student Subscription Screen

**Files:**
- Modify: `apps/mobile/app/(app)/(student)/(subscription)/index.tsx`

- [ ] **Step 1: Add import for new hook and icons**

At top, update the import from use-subscription:

```typescript
import { useCreateCheckout, useCreatePixCheckout, useMyPayments, useMySubscription } from "@/lib/hooks/use-subscription";
```

Add icons import (add `QrCode` and `CreditCard` to the lucide import):

```typescript
import { Calendar, ChevronRight, CreditCard, QrCode } from "lucide-react-native";
```

- [ ] **Step 2: Add the Pix checkout hook and handler inside component**

After `const createCheckout = useCreateCheckout();` add:

```typescript
  const createPixCheckout = useCreatePixCheckout();
```

Add handler after `handlePay`:

```typescript
  const handlePayPix = async () => {
    try {
      const result = await createPixCheckout.mutateAsync({
        subscriptionId: subscription!.id,
      });
      await WebBrowser.openBrowserAsync(result.checkoutUrl);
    } catch {
      // Pix checkout creation failed
    }
  };
```

- [ ] **Step 3: Replace single button with two buttons**

In the payment card IIFE, replace the single `<Pressable>` button (lines ~249-268) with two side-by-side buttons when not paid:

Replace:

```tsx
                <Pressable
                  onPress={hasPaid ? undefined : handlePay}
                  disabled={hasPaid || createCheckout.isPending}
                  className="items-center justify-center rounded-xl"
                  style={{
                    height: 48,
                    backgroundColor: hasPaid ? "#3A3A3A" : "#6C63FF",
                  }}
                >
                  {createCheckout.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text
                      className="font-poppins-semibold text-base"
                      style={{ color: hasPaid ? "#8A8A8A" : "#FFFFFF" }}
                    >
                      {hasPaid ? "Pago" : "Pagar agora"}
                    </Text>
                  )}
                </Pressable>
```

With:

```tsx
                {hasPaid ? (
                  <View
                    className="items-center justify-center rounded-xl"
                    style={{ height: 48, backgroundColor: "#3A3A3A" }}
                  >
                    <Text
                      className="font-poppins-semibold text-base"
                      style={{ color: "#8A8A8A" }}
                    >
                      Pago
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row" style={{ gap: 10 }}>
                    <Pressable
                      onPress={handlePayPix}
                      disabled={createPixCheckout.isPending || createCheckout.isPending}
                      className="flex-1 flex-row items-center justify-center rounded-xl"
                      style={{ height: 48, gap: 8, backgroundColor: "#A078E8" }}
                    >
                      {createPixCheckout.isPending ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <QrCode size={18} color="#FFFFFF" />
                          <Text className="font-poppins-semibold text-sm text-white">
                            Pix
                          </Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={handlePay}
                      disabled={createCheckout.isPending || createPixCheckout.isPending}
                      className="flex-1 flex-row items-center justify-center rounded-xl"
                      style={{ height: 48, gap: 8, backgroundColor: "#6C63FF" }}
                    >
                      {createCheckout.isPending ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <CreditCard size={18} color="#FFFFFF" />
                          <Text className="font-poppins-semibold text-sm text-white">
                            Cartão
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/(student)/(subscription)/index.tsx
git commit -m "feat(mobile): add Pix and card payment buttons on subscription screen"
```

---

### Task 9: Build Verification + Push

- [ ] **Step 1: Run full build**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm build
```

Expected: All packages build successfully.

- [ ] **Step 2: Fix any TypeScript errors**

If errors appear, fix them and commit.

- [ ] **Step 3: Commit pending changes and push**

```bash
git push origin feature/TAT-94
```
