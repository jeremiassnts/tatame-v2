# Manager Subscription — RevenueCat / In-App Purchase

**Date:** 2026-04-16
**Status:** Design approved — ready for implementation plan
**Related:** `2026-04-12-manager-checkout-migration-design.md` (Stripe Checkout migration; being superseded for iOS/Android)

## Context

Apple rejected the app a second time under Guideline 3.1.1 even after the Stripe Checkout migration. The rejection explicitly requires subscriptions sold inside the app to be processed through In-App Purchase. Since the app is distributed only through native stores (no web version), both iOS and Android must use IAP.

This design replaces the manager subscription payment flow (Stripe Checkout) with RevenueCat-backed In-App Purchases on iOS and Android. Student payments (physical services between gym and student) are **out of scope** and remain on their current AbacatePay/Stripe flows untouched.

## Goals

- Pass Apple review by selling the Manager Pro subscription through StoreKit (iOS) and Google Play Billing (Android).
- Keep the existing feature-gating logic (`ManagerSubscriptionService.canApprove*`, `canCreate*`) unchanged — the backend continues to be the source of truth for entitlements.
- Keep the existing `plan-selection` / `subscription-result` / `my-plan` screens' shape and UX; only the payment engine underneath changes.
- Leave student payment flows untouched.

## Non-goals

- Web purchase flow (no web app exists).
- Multiple plan tiers, annual plans, or free trials (single monthly R$49 product, per product decision).
- Migrating existing subscribers (there are none in production).
- RevenueCat Paywall UI (keeps visual consistency with the rest of the app).

## Architecture Overview

```
┌────────────────────────┐        ┌───────────────────────────┐
│     Mobile (Expo)      │        │   App Store / Play Store  │
│                        │        │                           │
│  react-native-purchases│◄──────►│  StoreKit / Play Billing  │
│  (RevenueCat SDK)      │  IAP   │  (real payment)           │
└──────────┬─────────────┘        └─────────────┬─────────────┘
           │                                    │
           │  (1) purchase                      │  (2) receipt
           │                                    ▼
           │                         ┌────────────────────┐
           │                         │    RevenueCat       │
           │                         │    (validates receipt,
           │                         │     normalizes)     │
           │                         └──────────┬──────────┘
           │                                    │
           │                                    │ (3) webhook
           │                                    ▼
           │                         ┌────────────────────┐
           │                         │   Tatame API        │
           │                         │   POST /v1/webhooks │
           │                         │        /revenuecat  │
           │                         └──────────┬──────────┘
           │                                    │
           │                                    ▼
           │                         ┌────────────────────┐
           │◄────────────────────────│  manager_sub-       │
           │  (4) GET /me (polling)  │  scriptions (PG)    │
           │                         └────────────────────┘
```

**Principles:**

- RevenueCat is the **payment** source of truth; our DB is the **entitlement** source of truth for feature gating.
- Webhook is the primary sync channel. Polling (existing behavior on `subscription-result.tsx`) remains as fallback.
- `app_user_id` in RevenueCat = Clerk user ID. No mapping table is needed.
- After Clerk login resolves, the client calls `Purchases.logIn(userId)` before any purchase action.

## Operational Prerequisites (outside code)

These must be completed by the operator before the implementation is merged to production. They are listed here so the spec is self-contained.

### Bundle / Package Identifier

- The current `com.anonymous.tatame` is the Expo default and should not be published to the stores. Once a real bundle ID is chosen, it cannot be changed later.
- Pick a final ID (suggestion: `br.com.tatame.manager` or `app.tatame.mobile`). Apply to `app.json` (`ios.bundleIdentifier` and `android.package`).
- Ensure the new App Store Connect app and Google Play Console app are registered under this ID.

### App Store Connect (iOS)

1. Register (or confirm) the app with the final bundle ID.
2. **My Apps → [Tatame] → Features → In-App Purchases** → create:
   - Reference Name: `Tatame Pro Monthly`
   - Product ID: `tatame_pro_monthly`
   - Type: Auto-Renewable Subscription
   - Subscription Group: `tatame_pro` (create new)
   - Duration: 1 month
   - Price: R$ 49,00 (Brazil) and equivalent tiers for other target countries
   - Display Name: "Tatame Pro"
   - Description: short, pt-BR
3. **Users and Access → Sandbox Testers** → add at least one tester for the target country.

### Google Play Console (Android)

1. Register (or confirm) the app with the final package name.
2. **Monetize → Products → Subscriptions** → create:
   - Product ID: `tatame_pro_monthly` (same as iOS)
   - Name: "Tatame Pro"
   - Base Plan: Monthly, auto-renewing, R$ 49,00
3. **Setup → License testing** → add testers.

### RevenueCat

1. Create account and a Project named "Tatame".
2. Add Apps:
   - iOS: provide App Store Connect App-Specific Shared Secret and API key.
   - Android: upload Google Cloud Service Account JSON with Play Developer API permission.
3. Create Entitlement with identifier `pro`.
4. Import products `tatame_pro_monthly` (iOS + Android) and attach them to the `pro` entitlement.
5. Create a default Offering named `default` with a single Package (`$rc_monthly`) wired to both products.
6. **Project Settings → API Keys** — copy:
   - iOS SDK Key → `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
   - Android SDK Key → `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
   - Secret API Key (server) → `REVENUECAT_SECRET_API_KEY`
7. **Project Settings → Integrations → Webhooks** — configure:
   - URL: `https://<API_PUBLIC_URL>/v1/webhooks/revenuecat`
   - Authorization header: a strong random token → `REVENUECAT_WEBHOOK_SECRET`

### EAS / Expo

- Add `react-native-purchases` config plugin to `app.json`.
- IAP does not run under Expo Go — a dev client is required. Run `eas build --profile development` at least once per platform after adding the dependency.
- Ensure `eas credentials` are set up for the Apple Developer account and Google Play upload key.

### API Secrets

Add to `.env` and to the production environment:

```
REVENUECAT_SECRET_API_KEY=sk_...
REVENUECAT_WEBHOOK_SECRET=<generated-token>
```

## Mobile Implementation

### Dependencies

```json
"react-native-purchases": "^8.x"
```

`react-native-purchases-ui` is **not** added — we keep the existing screens.

`app.json`:

```json
"plugins": [
  ...existing,
  "react-native-purchases"
]
```

### `lib/revenuecat.ts` (new module)

Centralizes SDK initialization and identity. Exports:

- `initRevenueCat()` — called once on root mount. Chooses `EXPO_PUBLIC_REVENUECAT_IOS_KEY` or `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` based on `Platform.OS`. Configures `Purchases.setLogLevel('warn')` in dev, `'error'` in prod.
- `identifyRevenueCatUser(userId: string)` — calls `Purchases.logIn(userId)` when the Clerk user ID becomes available. No-op if already logged in with the same ID.
- `resetRevenueCatUser()` — calls `Purchases.logOut()` on sign-out.

### `lib/hooks/use-revenuecat.ts` (new hook file)

- `useMonthlyPackage()` — React Query fetching `Purchases.getOfferings()`, returning `offerings.current.monthly` (the single monthly package). `staleTime: 5 * 60 * 1000`.
- `usePurchaseSubscription()` — `useMutation` wrapping `Purchases.purchasePackage(pkg)`. On success invalidates `['manager-subscription', 'me']`. Error mapping: see **Error Handling** below.
- `useRestorePurchases()` — `useMutation` wrapping `Purchases.restorePurchases()`. On success invalidates `['manager-subscription', 'me']`.

### Root layout (`app/_layout.tsx`)

- Call `initRevenueCat()` on mount.
- When Clerk resolves `user.id`, call `identifyRevenueCatUser(user.id)`.
- On sign-out hook, call `resetRevenueCatUser()` before clearing any local state.

### Screen: `plan-selection.tsx`

Layout and visual design unchanged. Logic changes:

- Replace `useProCheckout` with `useMonthlyPackage` + `usePurchaseSubscription`.
- "Assinar Pro" button handler:

```ts
async function handleSelectPro() {
  if (!pkg) return;
  try {
    await purchase(pkg);
    router.push("/(manager)/subscription-result");
  } catch (err) {
    if (err.userCancelled) return; // silent
    toast.error(mapPurchaseError(err));
  }
}
```

- Show a "Restaurar compras" button (secondary style) that triggers `useRestorePurchases`. This is an Apple review requirement.

### Screen: `subscription-result.tsx`

Near-identical to current behavior:

- Keep the 3s polling interval and 30s cap against `GET /manager-subscriptions/me`.
- On success (plan=pro, status=active), invalidate the query and redirect to home after 2s.
- On timeout, call `POST /manager-subscriptions/refresh` once as a last-ditch reconciliation before showing the "processing" state.
- Remove the `session_id` query param handling — the URL is now simply `/(manager)/subscription-result`.
- Remove deep-link re-entry logic (the purchase completes inside the app natively; no deep-link round-trip).

### Screen: `my-plan.tsx`

Keep: header, status badge, subscribed since, next billing date, plan name/price.

Remove:

- "Gerenciar cartão" button (not applicable under IAP).
- "Cancelar assinatura" button (done in native store).
- Invoice history list (not trivially surfaced by RevenueCat; may return in a later iteration if needed).

Add:

- **"Gerenciar assinatura"** button:
  - iOS: `Purchases.showManageSubscriptions()`.
  - Android: `Linking.openURL("https://play.google.com/store/account/subscriptions?sku=tatame_pro_monthly&package=<android-package>")`.
- **"Restaurar compras"** button (same hook as plan-selection).
- Banner (yellow) when `canceledAt != null`: *"Sua assinatura será encerrada em {currentPeriodEnd}."*
- Banner (red) when `status === "past_due"`: *"Problema no pagamento. Atualize sua forma de pagamento."* + CTA that opens `showManageSubscriptions` / store URL.

### Cleanups (mobile)

- `lib/hooks/use-manager-subscription.ts`: remove `useProCheckout` and any Stripe/portal hook.
- Remove references to `tatame://subscription-result?session_id=...`, `stripe-checkout`, Stripe publishable key loading in manager code paths (only used by student flow, which already imports it separately).

## Backend Implementation

### Schema migration

File: new Drizzle migration generated from edits to `packages/db/src/schema/index.ts`.

In `manager_subscriptions`:

- Drop: `stripeCustomerId`, `stripeSubscriptionId`.
- Add:
  - `revenuecatAppUserId text` — unique index. Mirrors the Clerk user ID used as `app_user_id`.
  - `productId text` — nullable. Stores e.g. `tatame_pro_monthly`.
  - `originalTransactionId text` — nullable. Stable Apple/Google ID for dedup and tracing.
  - `store` — enum `app_store | play_store`, nullable.

Kept: `plan`, `status`, `currentPeriodEnd`, `subscribedAt`, `canceledAt`, `academyId`, timestamps.

Because there are no production subscribers, `DROP COLUMN` is safe. Migration runs as part of the normal deploy.

### Remove Stripe code (manager scope only)

Deleted:

- `apps/api/src/modules/manager-subscription/stripe-webhook.handler.ts`
- `apps/api/src/modules/manager-subscription/stripe-status.ts`

Modified:

- `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts`:
  - Remove `POST /pro/checkout`.
  - Remove `POST /portal`.
  - Remove all `customer.subscription.*` event handling from `/v1/webhooks/stripe`. The route continues to exist for the student checkout/invoice events already handled there. Verify during implementation which events remain needed by the student flow and keep exactly those.
- `apps/api/src/lib/stripe.ts` — kept; student flow still uses it.
- `packages/config` — remove `STRIPE_PRO_PRICE_ID` from the env schema and constants (not used anywhere else).

### New route: `POST /v1/webhooks/revenuecat`

File: `apps/api/src/modules/manager-subscription/revenuecat-webhook.handler.ts`.

Authorization:

```ts
const auth = req.headers["authorization"];
if (auth !== process.env.REVENUECAT_WEBHOOK_SECRET) {
  return res.status(401).send("unauthorized");
}
```

Event routing (`event.type`):

| RevenueCat type | Internal handler | DB effect |
|---|---|---|
| `INITIAL_PURCHASE` | `onPurchase` | `plan=pro, status=active, currentPeriodEnd, productId, originalTransactionId, store, canceledAt=null, subscribedAt=now()` |
| `RENEWAL` | `onPurchase` (idempotent) | `status=active`, refresh `currentPeriodEnd` |
| `UNCANCELLATION` | `onUncancellation` | `canceledAt=null` |
| `CANCELLATION` | `onCancellation` | `canceledAt=now()`, keep `status=active` and `currentPeriodEnd` until expiration |
| `EXPIRATION` | `onExpiration` | `plan=free, status=canceled`; `currentPeriodEnd` kept as-is (historical record of last paid period) |
| `BILLING_ISSUE` | `onBillingIssue` | `status=past_due`; `currentPeriodEnd` unchanged |
| `PRODUCT_CHANGE` | `onPurchase` | updates `productId`, `currentPeriodEnd` (defensive — single product in MVP) |
| `SUBSCRIPTION_PAUSED` | `onBillingIssue` | `status=past_due` |
| `REFUND` | `onExpiration` | immediate: `plan=free, status=canceled`, `canceledAt=now()` |
| `TEST`, `TRANSFER`, `SUBSCRIBER_ALIAS`, other | log + 200 | — |

Manager identification: each event carries `event.app_user_id`. Resolve user → active academy → upsert `manager_subscriptions` row keyed by `academyId`.

Idempotency: the handler is effectively an upsert by `academyId`. Replaying the same event produces the same final state. `originalTransactionId` is stored to support future auditing.

Emails: reuse `sendProActivated()` on `INITIAL_PURCHASE` and `sendSubscriptionCanceled()` on `EXPIRATION` via the existing BullMQ queue.

### Repository / service

`manager-subscription.repository.postgres.ts`:

- New function `upsertFromRevenueCat({ academyId, plan, status, currentPeriodEnd, productId, originalTransactionId, store, canceledAt })` implemented as `INSERT ... ON CONFLICT (academyId) DO UPDATE`.
- Remove Stripe-specific functions (`setStripeCustomerId`, etc.).

`manager-subscription.service.ts`:

- Feature-limit methods (`canApproveStudent`, `canApproveInstructor`, `canCreatePlan`, `canCreateClass`) remain unchanged — they read `plan` and `status` only.
- New method `refreshFromRevenueCat(userId)` that calls RevenueCat's server API (`GET /subscribers/{app_user_id}`) and upserts the DB accordingly. Used as a manual reconciliation path.

### New route: `POST /manager-subscriptions/refresh`

- Authenticated, manager-only.
- Calls `service.refreshFromRevenueCat(req.userId)`.
- Returns the subscription object in the same shape as `GET /manager-subscriptions/me` (so the mobile can reuse the existing response type).
- Used by `subscription-result.tsx` when the 30s polling times out.
- Rate-limited (reuses the API's default limiter) to prevent hammering RevenueCat's server API.

### Raw body middleware

The existing middleware preserving `req.rawBody` on `/v1/webhooks` does not interfere with the RevenueCat webhook (which authenticates via header, not HMAC over body). No changes needed.

### Observability

- Log each received event with `type`, `app_user_id`, `productId`, `originalTransactionId`, `environment` (sandbox/production).
- OpenTelemetry counter `revenuecat_webhook_events_total` labeled by `type`.

## Error Handling

### Mobile

`usePurchaseSubscription` maps `Purchases.purchasePackage` errors:

| Case | UX |
|---|---|
| `userCancelled` | Silent. User dismissed the native sheet. |
| `paymentPendingError` (Android deferred) | Toast: *"Seu pagamento está sendo processado. Você receberá uma confirmação em breve."* + navigate to subscription-result. |
| `productNotAvailableError` | Toast: *"Plano indisponível no momento. Tente novamente mais tarde."* + log. |
| `purchaseInvalidError` / `receiptAlreadyInUseError` | Toast: *"Essa assinatura já está vinculada a outra conta. Entre em contato com o suporte."* |
| `networkError` | Toast: *"Sem conexão. Verifique sua internet e tente novamente."* |
| default | Generic toast + log. |

### Backend

Webhook handler:

- Invalid Authorization → 401 (non-retryable — config issue).
- Unknown event type → 200 + log (ignore silently so RevenueCat retries do not stack).
- `app_user_id` with no matching user → 200 + warn (user may have been deleted).
- DB error → 500 (RevenueCat retries with exponential backoff up to 72h).

## Testing Strategy

### Unit (API)

- `revenuecat-webhook.handler.ts`: one test per event type (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `UNCANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`, `REFUND`, `PRODUCT_CHANGE`) with a representative payload fixture, asserting final DB row state.
- Idempotency: apply same event twice, assert identical final state.
- Existing `manager-subscription.service.ts` feature-limit tests unchanged.

### Integration (API)

- `POST /v1/webhooks/revenuecat`:
  - Missing/incorrect Authorization → 401.
  - Valid payload → 200, DB row asserted.
- `POST /manager-subscriptions/refresh` with mocked RevenueCat API → DB updated.

### Manual (mobile, not automated)

- iOS sandbox tester: purchase → cancel in Apple ID Settings → app shows "será encerrada em..." banner.
- Android license tester: purchase → force billing issue in Play Console → app shows past_due banner.
- `restorePurchases` after fresh install / new sign-in → entitlement restored.

## Restore Purchases (App Store requirement)

Apple requires a visible "Restore Purchases" affordance. Both `plan-selection.tsx` (for non-subscribers) and `my-plan.tsx` (for subscribers) expose the button wired to `useRestorePurchases`. Absence of this button is a deterministic rejection reason.

## Rollout Sequence

1. **Schema migration** in staging; run in production during deploy window (safe: no active subscribers).
2. **Backend deploy** with:
   - `/v1/webhooks/revenuecat` live
   - Manager Stripe routes removed
3. **Mobile build 2.0.7** via EAS for iOS + Android, distributed through TestFlight (internal) and Play internal testing:
   - End-to-end sandbox purchase, cancellation, billing issue, expiration, restore.
4. **iOS submission** under the new bundle ID with approved IAP products. Reply to the pending App Review message with screenshots of the IAP flow.
5. **Android** publish via Play Console with staged rollout (20% → 100%).

## Legacy cleanup (after one stable release)

- Remove `STRIPE_PRO_PRICE_ID` and manager-Stripe references from `.env.example`.
- Remove any code flagged as dead by lint.

## Open items deliberately out of scope

- Multiple plan tiers / annual plan / trial — can be added later by introducing additional products and extending `useMonthlyPackage` to expose all packages.
- Invoice history — RevenueCat exposes transaction history via SDK (`Purchases.getCustomerInfo().nonSubscriptionTransactions` and via server API). Can return in a future iteration if business requires it.
- RevenueCat Paywall UI — skipped for visual consistency; revisit if business wants remote-configurable paywalls.
