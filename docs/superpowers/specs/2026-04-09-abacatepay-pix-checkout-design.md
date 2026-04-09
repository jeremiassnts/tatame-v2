# AbacatePay Pix Checkout for Student Payments

## Goal

Add Pix payment option via AbacatePay alongside the existing Stripe card checkout for student subscription payments. The student sees two buttons: "Pagar com Pix" (AbacatePay) and "Pagar com cartão" (Stripe). Each opens its respective hosted checkout page.

## Architecture

### Payment Flow

1. Student opens "Minha assinatura", sees pending payment card with two buttons
2. **"Pagar com cartão"** → `POST /v1/payments/checkout` (Stripe, existing) → opens Stripe Checkout
3. **"Pagar com Pix"** → `POST /v1/payments/checkout/pix` (new) → creates AbacatePay billing → opens AbacatePay checkout
4. Both return via deep link (`tatame://payment-success` or `tatame://payment-cancel`)
5. Processing banner + pull-to-refresh (unchanged)

### Webhooks

- `POST /v1/webhooks/stripe` — existing, handles `checkout.session.completed`
- `POST /v1/webhooks/abacatepay` — new, handles `billing.paid` event
- Both create `payments` record and send emails

## Backend / API

### New Endpoint — Pix Checkout

```
POST /v1/payments/checkout/pix
```

- **Auth**: Student with active subscription
- **Body**: `{ subscriptionId? }` (optional — defaults to active subscription)
- **Logic**:
  - Same validations as Stripe checkout (active subscription, not paid for current month)
  - Creates AbacatePay billing via SDK:
    - `frequency: "ONE_TIME"`
    - `methods: ["PIX"]`
    - Product with plan name + reference month, `externalId` containing serialized metadata (`subscriptionId`, `userId`, `academyId`, `referenceMonth`)
    - `returnUrl`: `tatame://payment-success`
    - `completionUrl`: `tatame://payment-success`
    - `customer.email`: student's email
  - Returns: `{ checkoutUrl: string }` (from billing response URL)

### New Webhook Handler

```
POST /v1/webhooks/abacatepay
```

- Receives `billing.paid` event
- Extracts metadata from product `externalId` (JSON with subscriptionId, userId, academyId, referenceMonth)
- **Idempotency**: checks if payment with same AbacatePay billing ID already exists via `stripePaymentId` field (reused for external payment IDs)
- Creates `payments` record with `method: 'pix'`, billing ID stored in `stripePaymentId`
- Sends confirmation email to student
- Sends notification email to manager (with/without Pix key warning)

### Database Changes

- Add `pix` to `payment_method` enum (new migration)
- No new columns needed — `stripePaymentId` field reused for AbacatePay billing ID

### New Environment Variable

- `ABACATEPAY_API_KEY` — API key for AbacatePay SDK

### New Dependency

- `abacatepay-nodejs-sdk` in `apps/api`

### Existing Stripe Checkout — No Changes

`POST /v1/payments/checkout` remains as-is with `payment_method_types: ["card"]`.

## Mobile

### Student Subscription Screen — Payment Card (Pending State)

Replace single "Pagar agora" button with two buttons side by side:

- **"Pagar com Pix"** — QR code icon, purple background (`#A078E8`) → calls `POST /v1/payments/checkout/pix` → opens browser
- **"Pagar com cartão"** — credit card icon, blue background (`#6C63FF`) → calls `POST /v1/payments/checkout` (existing) → opens browser

Paid state unchanged (gray "Pago" button).

### New Hook

- `useCreatePixCheckout()` — mutation for `POST /v1/payments/checkout/pix`, same pattern as `useCreateCheckout()`

### Post-Checkout Flow — No Changes

Deep link handling, processing banner, pull-to-refresh all remain identical for both payment methods.

## Emails — No Changes

Both webhooks (Stripe and AbacatePay) use the same email logic already implemented:
1. Student payment confirmation (`payment-confirmed`)
2. Manager notification (`student-payment-received` with/without Pix key warning)

## Environment Config

Add to `packages/config/src/env.ts`:
- `ABACATEPAY_API_KEY` — optional string (same pattern as `STRIPE_SECRET_KEY`)
