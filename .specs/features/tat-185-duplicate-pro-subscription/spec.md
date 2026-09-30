# TAT-185 — Prevent a manager from subscribing to Pro twice

## Problem Statement

A real customer (MJP Jiu-Jitsu, `cus_VD7Rs8EQIswQ7T`) ended up with two active Pro
subscriptions on the same Stripe Customer. Both were still in trial, so there was nothing
to refund, and the duplicate was cancelled by hand in the Stripe Dashboard. The bug is
reproducible today.

Nothing in the flow checks for an existing subscription:

- `POST /manager-subscriptions/checkout` provisions the user, promotes them to manager and
  calls `createCheckoutSession` without ever reading `manager_subscriptions`.
- `createCheckoutSession` reuses the Stripe Customer by email and creates the session
  directly — no check for an active subscription on that customer, and no idempotency key.
- `apps/web/app/cadastro/page.tsx` always renders "Ativar meus 30 dias grátis" for any
  authenticated user. A manager who already subscribed and revisits `/cadastro` subscribes
  again, with a fresh 30-day trial.

A second defect turns the duplicate into a data-integrity problem. In `onSubscriptionChange`
the handler looks the subscription up by `stripeSubscriptionId` and, on a miss, falls back
to `stripeCustomerId` — then overwrites that row with the event's subscription. Because both
subscriptions share one Customer, any event from either one hijacks the academy's row,
including `stripe_subscription_id`, `status` and `canceled_at`. `academy_id` and
`stripe_subscription_id` are both unique, so the app can only honour one of the two, and
which one is decided by whichever subscription last emitted an event.

## Goals

- [ ] A manager with a Pro subscription in flight cannot start a second checkout
- [ ] A double-submit or a retried request cannot produce two Checkout Sessions
- [ ] `/cadastro` never offers checkout to someone who already subscribed
- [ ] An academy row already linked to one subscription is never overwritten by events from
      a different subscription on the same Customer

## Out of Scope

| Item | Reason |
| ---- | ------ |
| Reconciling the customer that already has two subscriptions | The duplicate was cancelled by hand in the Stripe Dashboard. This ticket stops it happening again; it does not write a backfill for an incident of one. |
| A DB-level constraint on "one active subscription per owner" | `manager_subscriptions` is keyed by academy, not by owner, and the pending case lives on `users`. A constraint would have to span two tables. The guard covers both and is testable. |
| Deduplicating Stripe Customers by email | `createCheckoutSession` already reuses the Customer by email. Sharing one Customer is not the bug — two subscriptions on it is. |
| Blocking checkout for `past_due` | A `past_due` manager needs a way back in. Only `active` and `trialing` count as in flight; `past_due`, `canceled` and `incomplete` stay eligible. |

---

## User Stories

### P1: The API refuses a second checkout ⭐ MVP

**User Story**: As the platform, I want `POST /manager-subscriptions/checkout` to refuse a
caller who already has Pro in flight, so that no second subscription can be created no
matter which client asks.

**Why P1**: The endpoint is the only door to Stripe. A guard anywhere else is cosmetic.

**Acceptance Criteria**:

1. WHEN the caller owns an academy whose `manager_subscriptions` row is `active` or
   `trialing` THEN the system SHALL answer 409 and SHALL NOT call Stripe
2. WHEN the caller's user row carries a non-null `pending_stripe_subscription_id` THEN the
   system SHALL answer 409 and SHALL NOT call Stripe
3. WHEN the caller has no subscription, or only a `canceled` / `incomplete` / `past_due`
   one, THEN checkout SHALL still succeed
4. WHEN the session is created THEN the system SHALL pass an idempotency key scoped to the
   caller and the price, so a double-submit returns the same session

**Independent Test**: Seed a manager with a `trialing` row, POST `/checkout`, get 409 with
no Stripe call recorded. Flip the row to `canceled`, POST again, get a session URL.

---

### P1: `/cadastro` sends a subscriber to the panel ⭐ MVP

**User Story**: As a manager who already subscribed, I want `/cadastro` to take me to my
subscription page instead of offering me a second trial, so that revisiting the signup link
cannot cost me a duplicate charge.

**Why P1**: This is the path the real customer took. The API guard alone turns it into an
error message on a page that should never have offered the button.

**Acceptance Criteria**:

1. WHEN an authenticated user opens `/cadastro` THEN the system SHALL resolve their checkout
   eligibility before rendering either the CTA or the redirect
2. WHEN they are not eligible THEN the system SHALL replace the route with
   `/conta/assinatura` and SHALL NOT render the checkout CTA at any point
3. WHEN eligibility is still resolving THEN the system SHALL show a loading state, not the CTA
4. WHEN the checkout endpoint answers 409 anyway (a race) THEN the UI SHALL render a readable
   Portuguese message rather than a code or a raw HTTP error

**Independent Test**: Sign in as a manager with a `trialing` subscription, open `/cadastro`,
land on `/conta/assinatura` without the CTA ever appearing.

---

### P1: The webhook stops hijacking the academy's row ⭐ MVP

**User Story**: As the platform, I want events from a subscription that is not the academy's
to be ignored, so that a duplicate on the same Customer cannot silently repoint the academy
at the wrong subscription.

**Why P1**: Without it, the row still flips between two subscriptions for any customer that
already has a duplicate — and the guard does not undo an existing one.

**Acceptance Criteria**:

1. WHEN the `stripeCustomerId` lookup matches a row whose `stripe_subscription_id` is null
   THEN the handler SHALL adopt the event (the pending-academy path keeps working)
2. WHEN it matches a row already linked to a *different* subscription THEN the handler SHALL
   leave `stripe_subscription_id`, `status` and `canceled_at` untouched and SHALL emit
   `manager_subscription.webhook_unhandled`
3. WHEN the event's own `stripe_subscription_id` matches a row THEN that row SHALL be updated
   as before — the narrowing applies only to the customer-id fallback
4. WHEN the fallback is refused THEN the handler SHALL NOT fall through to the
   pending-on-user path, which would re-create the hijack at academy-creation time

**Independent Test**: Seed a row linked to `sub_A` on `cus_1`, deliver a
`customer.subscription.updated` for `sub_B` on `cus_1`, and confirm the row still reads
`sub_A` with its original status.

---

## Edge Cases

- WHEN the caller has no user row yet (first web signup) THEN eligibility SHALL be `true` —
  a user that does not exist cannot have a subscription
- WHEN the caller owns more than one academy THEN any one of them being `active`/`trialing`
  SHALL block checkout
- WHEN the guard refuses THEN the role promotion (`ensureManagerRole`) SHALL NOT run — a
  refused request must not mutate the caller
- WHEN Stripe is not configured THEN the existing 503 SHALL still win over the guard's 409,
  since the endpoint cannot serve either outcome

---

## Requirement Traceability

| Requirement ID | Story | Task | Status |
| -------------- | ----- | ---- | ------ |
| DUP-01 | Service knows whether a user has Pro in flight (academy row or pending id) | T1 | Verified |
| DUP-02 | `POST /checkout` answers 409 on an in-flight subscription, before touching Stripe or the role | T2 | Verified |
| DUP-03 | `canceled` / `incomplete` / `past_due` stay eligible — resubscribing keeps working | T1, T2 | Verified |
| DUP-04 | Checkout Session created with an idempotency key scoped to caller + price | T3 | Verified |
| DUP-05 | `GET /manager-subscriptions/checkout-eligibility` answers the same guard to the web | T4 | Verified |
| DUP-06 | `/cadastro` resolves eligibility before rendering, redirects to `/conta/assinatura` | T5 | Verified |
| DUP-07 | A 409 surfaces as readable Portuguese in the web UI | T6 | Verified |
| DUP-08 | Customer-id fallback adopts an event only when the row has no subscription id | T7 | Verified |
| DUP-09 | A refused fallback emits `manager_subscription.webhook_unhandled` and returns | T7 | Verified |

**Coverage:** 9 total, 9 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] No Stripe Customer belonging to a Tatame manager carries two subscriptions
- [ ] `/cadastro` renders the checkout CTA only for users who can actually subscribe
- [ ] `manager_subscription.webhook_unhandled` with reason `DUPLICATE_SUBSCRIPTION` is the
      signal that a duplicate exists, instead of a silently repointed row
