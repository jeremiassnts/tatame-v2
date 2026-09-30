# Tasks — Prevent a manager from subscribing to Pro twice (TAT-185)

| # | Task | Depends on | Covers |
| --- | --- | --- | --- |
| 1 | `ManagerSubscriptionService.hasSubscriptionInFlight(userId, pendingStripeSubscriptionId)` | — | DUP-01, DUP-03 |
| 2 | Guard `POST /manager-subscriptions/checkout` with a 409 before Stripe and before the role promotion | 1 | DUP-02, DUP-03 |
| 3 | Pass an idempotency key to `checkout.sessions.create` | — | DUP-04 |
| 4 | `GET /manager-subscriptions/checkout-eligibility` (requireSession) | 1 | DUP-05 |
| 5 | `/cadastro` resolves eligibility before rendering, redirects to `/conta/assinatura` | 4 | DUP-06 |
| 6 | `managerFetch` prefers `body.message` over `body.error` | 2 | DUP-07 |
| 7 | Narrow the webhook's customer-id fallback + `DUPLICATE_SUBSCRIPTION` reason | — | DUP-08, DUP-09 |

**Gate command:** `pnpm --filter @tatame/api test:unit && pnpm --filter @tatame/api typecheck && pnpm --filter @tatame/web build`

TDD per the project convention: every task writes its failing test first. Tasks 5 and 6
touch `apps/web`, which has no test suite — their gate is the Next build plus the
*Independent Test* walkthrough in the spec.

Ships as one set. The guard alone still leaves the row hijackable; the webhook fix alone
still allows the second subscription.

## Design notes

**The guard lives in the service, not the route.** Two callers need the same answer — the
409 on `POST /checkout` and the eligibility read the web uses — and they must never
disagree, or `/cadastro` renders a CTA the API is about to refuse. One method, two call
sites.

**The service does not grow a `userRepo`.** `pending_stripe_subscription_id` lives on
`users`, which `ManagerSubscriptionService` has no repository for; `linkPendingSubscription`
already sidesteps this by taking the user repo as an argument. Rather than widen the
constructor for one field, `hasSubscriptionInFlight` takes the pending id as a parameter —
both routes already load the user row.

**`active` and `trialing` only.** That is the same pair `isSubscriptionActive` already
tests, and it is reused rather than restated. `past_due` is deliberately eligible: a manager
whose card failed needs a way back, and Stripe will not open a second subscription for a
customer who already has a live one at that price without one of us asking for it.

**Order inside the route: provision → guard → promote → Stripe.** Provisioning has to come
first because the guard reads the user row. The promotion has to come after, so a refused
request leaves the caller exactly as it found them.

**Idempotency key `manager-checkout:{clerkUserId}:{priceId}`.** Deterministic, so a
double-submit or a retried request maps to one session. Stripe retains keys for 24h, so a
manager who cancels and resubscribes inside that window gets the earlier session back —
same customer, same price, harmless.

**The 409 carries both a code and Portuguese prose.** `HttpError` puts `details.code` in
`error` and the message in `message`, and `managerFetch` currently reads only `error` — so
today a coded error reaches the UI as `ALREADY_SUBSCRIBED`. Task 6 makes `managerFetch`
prefer `message`, which is a no-op for every error that carries no code.

**The refused fallback returns instead of falling through.** Letting it reach the
pending-on-user branch would write `pending_stripe_subscription_id` for the duplicate, and
`linkPendingSubscription` would then overwrite the academy row at academy-creation time —
the same hijack, deferred.

## Status

All seven tasks implemented, test-first. Gate green:

- `pnpm --filter @tatame/api test:unit` — 711 tests, 42 files
- `pnpm --filter @tatame/api test:integration` — 112 tests, 14 files
- `pnpm --filter @tatame/api typecheck` + `eslint` — clean
- `pnpm --filter @tatame/web build` — clean

Coverage added:

| Where | What |
| --- | --- |
| `manager-subscription.service.test.ts` | 8 cases on `hasSubscriptionInFlight` (trialing, active, pending id, nothing, the three eligible states, several academies, someone else's academy) + 2 on the idempotency key |
| `stripe-subscription-webhook.handler.test.ts` | 5 cases on the narrowed fallback — the linked row survives, the duplicate is reported, it is not parked as pending, a matching id still applies, a null-subscription row still adopts |
| `manager-subscription-duplicate.integration.test.ts` | 13 cases end-to-end through supertest: the 409 and its body, the three states that stay eligible, the refusal not promoting its caller, and the four eligibility answers |

`vitest.integration.setup.ts` gained `STRIPE_PRO_PRICE_ID`. Without it the checkout
route answers 503 before the guard runs and every refusal test would have passed for the
wrong reason. The Stripe *key* stays unset: a caller the guard allows through then hits
503, which is how the "still eligible" tests tell allowed from refused without a Stripe
call.

Still unverified: the two web *Independent Test* walkthroughs, which need a browser and
a real Clerk session. `apps/web` has no test suite — no automated coverage is claimed for
tasks 5 and 6.
