# Manager Subscription — Migrate from Stripe Native SDK to Checkout (Apple Guideline 3.1.1)

**Date:** 2026-04-12
**Status:** Approved
**Scope:** API endpoint changes + Mobile screen changes

## Context

Apple rejected the app under Guideline 3.1.1 because the manager Pro subscription uses Stripe's native payment sheet (`@stripe/stripe-react-native` `initPaymentSheet`/`presentPaymentSheet`) to collect payment **inside the app**. Apple requires that digital subscriptions use In-App Purchase, or that payment happens **outside the app** (browser).

The student payment flow already uses Stripe Checkout (browser redirect) and is not affected.

## Solution

Replace the native Stripe payment sheet with **Stripe Checkout Session** that opens in Safari. The user completes payment in the browser and returns to the app via deep link (`tatame://`).

## Non-Goals

- Implementing Apple In-App Purchase (too complex, 30% fee)
- Changing the student payment flow (already compliant)
- Changing the Stripe Portal flow for cancellation (already opens browser)
- Changing the free plan flow (no payment involved)

## Design

### Two Return Scenarios

**1. New subscription / reactivation (plan-selection screen):**
- User selects Pro → app opens Stripe Checkout in Safari
- After payment, Safari redirects to `tatame://subscription-result?session_id=xxx`
- App shows **intermediate screen** (`subscription-result.tsx`):
  - Spinner + "Aguardando confirmação do pagamento..."
  - Auto-polls `GET /manager-subscriptions/me` every 3s (max 30s)
  - When status becomes "active": shows success message + navigates to home
  - Button "Verificar novamente" for manual retry
  - If cancelled/failed: shows message + button to go back

**2. Plan change (from my-plan screen, "Alterar plano"):**
- User goes to plan-selection → selects different plan → opens Stripe Checkout in Safari
- After payment, Safari redirects to `tatame://finances`
- User lands on the **finances screen** (already has pull-to-refresh)
- No intermediate screen needed — user pulls to refresh to see the update

### API Changes

**New endpoint: `POST /manager-subscriptions/pro/checkout`**

Replaces the current two-step flow (`/pro` + `/pro/complete`). Creates a Stripe Checkout Session and returns the URL.

```typescript
// Request
POST /v1/manager-subscriptions/pro/checkout
Body: { returnPath?: string }  // "finances" or undefined (default: subscription-result)

// Response
{ checkoutUrl: string }
```

Implementation:
- Creates Stripe Customer if needed (same as current `/pro`)
- Creates Stripe Checkout Session in `subscription` mode with:
  - `mode: "subscription"`
  - `line_items: [{ price: STRIPE_PRO_PRICE_ID, quantity: 1 }]`
  - `success_url: "tatame://{returnPath}?session_id={CHECKOUT_SESSION_ID}"`
  - `cancel_url: "tatame://plan-selection"`
  - `customer` set to existing/new Stripe customer
  - `metadata: { academyId }`
- Stores `stripeCustomerId` in the subscription record (same as current flow)

**Keep existing endpoints:**
- `POST /manager-subscriptions/free` — unchanged
- `GET /manager-subscriptions/me` — unchanged (used for polling)
- `POST /manager-subscriptions/portal` — unchanged
- `POST /manager-subscriptions/reactivate` — now also creates Checkout Session (same logic as `/pro/checkout`)

**Deprecate (can remove later):**
- `POST /manager-subscriptions/pro` (SetupIntent flow)
- `POST /manager-subscriptions/pro/complete` (PaymentIntent flow)

**Webhook:** No changes needed. The existing `customer.subscription.created` and `invoice.paid` handlers already activate the subscription when Stripe processes the payment from Checkout.

### Mobile Changes

**1. New screen: `app/(app)/(manager)/subscription-result.tsx`**

Intermediate "waiting" screen:
- Receives `session_id` from deep link query params
- Shows spinner + "Aguardando confirmação..."
- Polls `GET /manager-subscriptions/me` every 3s
- When `status === "active"` and `plan === "pro"`: invalidate queries, show success, navigate to home after 2s
- After 30s without confirmation: show "Pagamento sendo processado. Pode levar alguns minutos." with button to go to home
- "Verificar novamente" button triggers immediate poll
- If user came from cancel URL: show "Pagamento cancelado" + back button

**2. Modify: `app/(app)/(manager)/plan-selection.tsx`**

Replace `handleSelectPro()`:
- Instead of `initPaymentSheet`/`presentPaymentSheet`, call new `useProCheckout()` hook
- Hook calls `POST /manager-subscriptions/pro/checkout` with `{ returnPath }`:
  - If user has no subscription or is reactivating: `returnPath` = `"subscription-result"` (default)
  - If user already has a subscription (changing plan): `returnPath` = `"finances"`
- Open the returned `checkoutUrl` with `Linking.openURL(checkoutUrl)`
- Remove `useStripe()` import and all payment sheet logic
- Remove `useStartProSubscription()` and `useCompleteProSubscription()` hooks usage

**3. Modify: `app/(app)/(manager)/(finances)/index.tsx`**

Already has pull-to-refresh via `refetch()`. No code changes needed — when user returns from Stripe Checkout with `tatame://finances`, the screen is already mounted and user can pull to refresh.

**4. Modify: `lib/hooks/use-manager-subscription.ts`**

- Add `useProCheckout()` hook:
  ```typescript
  export function useProCheckout() {
    const api = useApi();
    return useMutation({
      mutationFn: (input?: { returnPath?: string }) =>
        api.post<{ checkoutUrl: string }>("/manager-subscriptions/pro/checkout", input),
    });
  }
  ```
- Keep `useStartProSubscription` and `useCompleteProSubscription` for now (can remove in next cleanup)

**5. Modify: `app/(app)/(manager)/(finances)/my-plan.tsx`**

The "Alterar plano" button already navigates to `plan-selection`. No changes needed.

### Deep Link Routing

The app uses `expo-router` with scheme `tatame://`. Routes map to file paths:
- `tatame://subscription-result?session_id=xxx` → `app/(app)/(manager)/subscription-result.tsx` (new)
- `tatame://finances` → already handled by existing finances screen
- `tatame://plan-selection` → already handled by existing plan-selection screen

### Files Changed

| File | Change |
|------|--------|
| `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts` | Add `POST /pro/checkout` endpoint |
| `apps/mobile/app/(app)/(manager)/subscription-result.tsx` | New intermediate waiting screen |
| `apps/mobile/app/(app)/(manager)/plan-selection.tsx` | Replace Stripe native with Checkout URL redirect |
| `apps/mobile/lib/hooks/use-manager-subscription.ts` | Add `useProCheckout()` hook |
