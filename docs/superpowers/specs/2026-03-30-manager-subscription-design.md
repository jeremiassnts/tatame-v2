# Manager Subscription & Plan Enforcement

## Overview

Managers must subscribe to a plan to use the app. Two options: **Free** (R$ 0) and **Pro** (R$ 49/month). The plan selection screen (Pencil node `moPBD`) is a mandatory gate after academy creation. Payment is processed via Stripe with native Payment Sheet (`@stripe/stripe-react-native`). Plan restrictions are enforced both on the backend (authoritative) and frontend (UX alerts).

## Pencil Design References

- **M-MGR-02 — Choose Plan**: node `moPBD` — plan selection screen shown as gate after academy creation and for upgrade/downgrade
- **M-MGR-17 — Financial Overview**: node `3sIUB` — new "Plano atual" card added to existing finance dashboard
- **M-MGR-18 — Plan Details**: node `vqoDI` — plan details with payment history, change plan, and cancel subscription

## Data Model

### New table: `manager_subscriptions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | PK |
| `academyId` | UUID FK (unique) | Reference to academy — one subscription per academy |
| `plan` | enum `free`, `pro` | Current plan |
| `status` | enum `active`, `past_due`, `canceled`, `incomplete` | Subscription state |
| `stripeCustomerId` | text, nullable | Stripe Customer ID (null for free) |
| `stripeSubscriptionId` | text, nullable | Stripe Subscription ID (null for free) |
| `currentPeriodEnd` | timestamp, nullable | End of current billing cycle (null for free) |
| `subscribedAt` | timestamp | When the plan was first selected |
| `canceledAt` | timestamp, nullable | When subscription was canceled |
| `createdAt` | timestamp | Record creation |
| `updatedAt` | timestamp | Last update |

### New enum: `manager_plan`

Values: `free`, `pro`

### New enum: `manager_subscription_status`

Values: `active`, `past_due`, `canceled`, `incomplete`

### State rules

- `status: active` + `plan: free` — free plan, app works with limitations
- `status: active` + `plan: pro` — pro plan, no limitations
- `status: past_due` — payment failed, app blocked (if was Pro)
- `status: canceled` — subscription canceled, app blocked (if was Pro and used Pro features beyond Free limits)
- `status: incomplete` — initial payment not yet confirmed

## Subscription Flows

### 1. Plan Selection Gate (post academy creation)

1. Manager creates academy
2. Redirected to M-MGR-02 (node `moPBD`) — cannot access any other screen
3. Selects Free or Pro

### 2. Free Plan Activation

1. Manager selects "Comecar gratis"
2. `POST /v1/manager-subscriptions/free` — creates record with `plan: free, status: active`
3. No Stripe interaction
4. Manager enters the app with limitations

### 3. Free to Pro Upgrade

1. Manager navigates to M-MGR-02 (via finance screen or gate)
2. Selects "Pro"
3. Backend creates Stripe Customer (if not exists) + Stripe Subscription → returns `{ clientSecret, subscriptionId }`
4. App opens Stripe Payment Sheet with `clientSecret`
5. Payment confirmed → Stripe sends webhooks (`invoice.paid`, `customer.subscription.created`)
6. Webhook handler updates `manager_subscriptions`: `plan: pro`, `status: active`, populates Stripe fields and `currentPeriodEnd`
7. Pro features unlocked immediately after payment confirmation

### 4. Pro Cancellation

1. Manager goes to plan details (node `vqoDI`) → "Cancelar assinatura"
2. Opens Stripe Customer Portal
3. Manager confirms cancellation in portal
4. Stripe schedules cancellation for end of billing cycle → webhook `customer.subscription.updated` with `cancel_at_period_end: true`
5. At end of cycle, webhook `customer.subscription.deleted`
6. Backend checks if manager used Pro features beyond Free limits (>50 students, >1 plan, >2 daily schedules, has instructors)
   - If within Free limits: downgrade to `plan: free, status: active`
   - If exceeded: set `status: canceled` → app blocked

### 5. Payment Failure

1. Stripe charge fails → webhook `invoice.payment_failed`
2. Backend updates `status: past_due`
3. Stripe retries automatically (dunning)
4. If recovered: webhook `invoice.paid` → `status: active`
5. If exhausted retries: webhook `customer.subscription.deleted` → `status: canceled`

### 6. Reactivation

1. Manager with blocked app sees warning + "Reativar assinatura" button
2. Same flow as Free → Pro upgrade (creates new Stripe Subscription)

### 7. Update Payment Details

1. Manager accesses via plan details screen or payment failure banner
2. Opens Stripe Customer Portal → updates card
3. Stripe retries charge automatically if `past_due`

## Plan Restrictions (Free Plan)

### Limits

| Resource | Free Limit | Pro Limit |
|----------|-----------|-----------|
| Approved students | 50 | Unlimited |
| Subscription plans | 1 | Unlimited |
| Daily schedule slots | 2 per day of week | Unlimited |
| Instructors | 0 | Unlimited |

### Enforcement Points

| Limit | API Route | Behavior |
|-------|-----------|----------|
| Students | `PATCH /memberships/:id/approve` | If student role and count >= 50, return 403 `PLAN_LIMIT_STUDENTS` |
| Subscription plans | `POST /subscriptions/plans` | If plan count >= 1, return 403 `PLAN_LIMIT_PLANS` |
| Daily schedules | `POST /classes` | If classes on same `dayOfWeek` >= 2, return 403 `PLAN_LIMIT_SCHEDULES` |
| Instructors | `PATCH /memberships/:id/approve` | If instructor role, return 403 `PLAN_NO_INSTRUCTORS` |

### Total App Block

Applies when: manager was Pro and `status` is `past_due` or `canceled`.

All API actions return 403 `SUBSCRIPTION_BLOCKED`. Frontend shows banner:
- `past_due`: "Seu pagamento esta atrasado. Atualize seus dados de pagamento para continuar usando o app."
- `canceled`: "Sua assinatura foi cancelada. Reative o plano Pro para continuar usando o app."

Banner includes action button → Stripe Customer Portal (for `past_due`) or reactivation flow (for `canceled`).

## API Endpoints

### New module: `manager-subscriptions`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/v1/manager-subscriptions/free` | Manager | Select free plan |
| `POST` | `/v1/manager-subscriptions/pro` | Manager | Start Pro subscription, returns `{ clientSecret, subscriptionId }` |
| `GET` | `/v1/manager-subscriptions/me` | Manager | Get current subscription (plan, status, currentPeriodEnd) |
| `GET` | `/v1/manager-subscriptions/limits` | Manager | Get current limit usage: `{ students: { used, limit }, plans: { used, limit }, schedules: { used, limit }, instructors: { allowed } }` |
| `POST` | `/v1/manager-subscriptions/portal` | Manager | Create Stripe Customer Portal session, returns `{ url }` |
| `POST` | `/v1/manager-subscriptions/reactivate` | Manager | Create new Stripe Subscription for canceled manager, returns `{ clientSecret }` |
| `POST` | `/v1/webhooks/stripe` | Public (signature verified) | Stripe webhook endpoint |

### Webhook Events

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Update `stripeSubscriptionId`, `status: active`, `plan: pro` |
| `customer.subscription.updated` | Update `status`, `currentPeriodEnd`, track `cancel_at_period_end` |
| `customer.subscription.deleted` | Check downgrade eligibility, set `canceled` or downgrade to free |
| `invoice.paid` | Update `status: active` |
| `invoice.payment_failed` | Update `status: past_due` |

### Middleware

- `requireActivePlan()` — checks manager has `manager_subscriptions` with `status: active`. Returns 403 `SUBSCRIPTION_BLOCKED` otherwise. Applied to all manager routes except subscription management routes.
- `requirePlanFeature(feature)` — checks specific plan limits for free tier. Applied to membership approval, class creation, and subscription plan creation routes.

The webhook route lives outside the authenticated router at `/v1/webhooks/stripe`, validated via `stripe.webhooks.constructEvent()` with the signing secret.

## Frontend

### Screens

#### Plan Selection Gate — `(app)/(manager)/plan-selection`
- Renders M-MGR-02 (Pencil node `moPBD`)
- Two plan cards: Free and Pro
- Free: tap "Comecar gratis" → `POST /manager-subscriptions/free` → navigate to home
- Pro: tap to select → `POST /manager-subscriptions/pro` → open Stripe Payment Sheet → on success navigate to home
- No back button, no way to skip

#### Plan Details — `(app)/(manager)/(finances)/my-plan`
- Renders M-MGR-18 (Pencil node `vqoDI`)
- Shows: current plan with badge (Free/Pro), status, price, next billing date, subscriber since date
- "Alterar plano" → navigate to M-MGR-02 (`moPBD`)
- Payment history list (Stripe invoices)
- "Cancelar assinatura" → opens Stripe Customer Portal via `POST /manager-subscriptions/portal`

#### Financial Overview update — `(app)/(manager)/(finances)/index`
- Add "Plano atual" card to existing M-MGR-17 (Pencil node `3sIUB`)
- Shows plan badge, price, next billing date
- Tap → navigate to my-plan screen
- App block banner displayed here when `past_due` or `canceled`

### Hooks

- `useManagerSubscription()` — React Query for `GET /manager-subscriptions/me`
- `useManagerLimits()` — React Query for `GET /manager-subscriptions/limits`
- `useSubscriptionGate()` — checks if manager has selected a plan, used in `(manager)` layout for redirect

### Alert Behavior (Free plan limits)

At each enforcement point, before calling the API, the frontend checks limits via `useManagerLimits()` and shows `Alert.alert()`:
- Title explaining the limit reached
- "Fazer upgrade" button → navigate to plan-selection
- "OK" button to dismiss

The backend remains the source of truth — frontend alerts are UX improvements only.

### Navigation Gate

In `(manager)/_layout.tsx`, `useSubscriptionGate()` checks for an active `manager_subscriptions` record. If none exists, redirect to `plan-selection`. This runs on every navigation within the manager group.

## Dependencies

- `stripe` npm package (backend)
- `@stripe/stripe-react-native` (mobile)
- Stripe account with:
  - Product + Price configured for Pro plan (R$ 49/month BRL)
  - Customer Portal enabled
  - Webhook endpoint configured

## Environment Variables (new)

- `STRIPE_SECRET_KEY` — Stripe API secret key
- `STRIPE_PUBLISHABLE_KEY` — Stripe publishable key (sent to mobile)
- `STRIPE_WEBHOOK_SECRET` — Webhook signing secret
- `STRIPE_PRO_PRICE_ID` — Stripe Price ID for the Pro plan
- `STRIPE_PORTAL_CONFIGURATION_ID` — Stripe Customer Portal config ID (optional)
