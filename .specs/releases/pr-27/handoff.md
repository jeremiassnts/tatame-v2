# PR #27 — release handoff

**PR:** #27, `dev` → `main`, "Asaas payment split, Expo SDK 57 e correções de dependentes"
**Written:** 2026-09-30
**Base of the audit:** `554e92e` (merge-base with `main`: `2876166`)
**State:** 5 commits on `dev`, **not pushed**. Working tree clean.

This picks up from a five-reviewer audit of the branch. Eight blockers were found;
**five are fixed in the commits below, three remain.** Nothing else about the PR has
changed.

---

## Where to start

Read *Remaining blockers* and pick one. Each carries the file, the line, and the fix.
Recommended order: **B6** (one import), then **B8** (a runbook plus three lines of
SQL), then **B7** (needs a product decision first).

Then re-read *Decisions not to undo* before touching the payment or reporting code —
several things that look like oversights are deliberate and say so in comments.

---

## Commits in this session

| SHA | What |
| --- | --- |
| `4989c10` | `[tat-186]` only the guardian of record can check in a dependent |
| `ab07930` | `[tat-104]` retire the manual transfer step the split replaced |
| `c56212e` | `[tat-104]` bump the mobile app to 2.1.3 |
| `3f7db7c` | `[tat-181]` resolve a guardian's own plan from their own subscription |
| `515d91d` | `[tat-104]` alert on the money events the Asaas rails actually emit |

Each commit message carries the full reasoning; this file does not repeat it.

### Gates, run on `515d91d`

| Gate | Result |
| --- | --- |
| `npx turbo build` | 8/8 |
| `npx turbo test:unit` | **730**/730, 42 files (was 716 at `554e92e`) |
| `pnpm --filter @tatame/api test:integration` | **128**/128, 16 files (was 126) |
| `npx turbo typecheck` | 13/13 |
| `npx turbo lint` | 0 errors, 5 warnings (all pre-existing in `apps/web`) |

The integration suite replays the migration journal into a fresh schema, so it also
proves `0021`–`0023` apply cleanly. It needs Docker running (testcontainers).

**`npx turbo typecheck` does not cover `apps/mobile`** — that script is
`echo 'skipped: …'`. The real check is `cd apps/mobile && npx tsc --noEmit -p
tsconfig.json`, which reports **5 errors**: 4 pre-existing `Belt`-typing issues, and
one this PR introduced with the TypeScript 6.0.3 bump (`app/_layout.tsx(1,8) TS2882`,
the `global.css` side-effect import). None are mine; the count was 5 before this
session and is 5 now.

---

## Remaining blockers

### B6 — Students see raw error codes on the only payment rail

`apps/mobile/components/PixPaymentView.tsx:122-128`

```js
const message =
  error instanceof Error && error.message
    ? error.message
    : "Não foi possível gerar o QR Code. Tente novamente.";
```

`middleware/error-handler.ts:16` sets the response `error` field to
`err.details?.code ?? err.message`, and `lib/api.ts` maps that field onto
`ApiError.message`. So any coded failure renders the identifier.

The charge is generated on mount, so a student at an academy that has not finished
Asaas onboarding is greeted by an alert reading **`PAYOUT_ACCOUNT_REQUIRED`**. That is
reachable today: enrolment is gated by `PAYOUT_ACCOUNT_REQUIRED`, which
`packages/config/src/env.ts:74` defaults to `false`, while the charge gate at
`payment.service.ts:326` is unconditional. Card is flag-off, so Pix is the only rail
this can happen on. Same shape for `CPF_REQUIRED`, and a 409 renders as
`Payment already exists for this period`.

**Fix:** `import { describeApiError } from "@/lib/api-error-message"` and replace the
block with `describeApiError(error, "Não foi possível gerar o QR Code. Tente
novamente.")`. That helper ships in this same PR and is already wired into 8 other
screens — this is the one that was missed. It reads `ApiError.detail`, which is where
the Portuguese sentence lives.

### B7 — A manager who cancels and resubscribes is billed for nothing

`apps/api/src/modules/manager-subscription/stripe-subscription-webhook.handler.ts:107`

```ts
const byCustomer = await this.subRepo.findByStripeCustomerId(stripeCustomerId);
if (byCustomer?.stripeSubscriptionId) { /* emit DUPLICATE_SUBSCRIPTION + return */ }
```

The refusal ignores the *status* of the linked subscription. `onSubscriptionChange` is
the only path that records a manager Pro subscription — `StripeCheckoutWebhookHandler`
ignores the Pro session entirely, because it requires
`metadata.subscriptionId`/`userId`/`academyId` which the Pro session never carries. So:

1. Academy row holds `stripe_subscription_id = sub_A`, `status = canceled`.
2. Manager resubscribes. The TAT-185 guard correctly allows it. Stripe reuses `cus_1`
   and opens `sub_B`.
3. `customer.subscription.created` for `sub_B` → no match by subscription id → match by
   customer id → that row's `stripe_subscription_id` is set → `DUPLICATE_SUBSCRIPTION`,
   `return`.
4. The academy stays `canceled` while Stripe bills the manager. Every later event for
   `sub_B` is refused the same way, permanently.

**This needs a decision before code.** The spec contradicts itself: DUP-03 says a
cancelled manager may resubscribe; the webhook's AC-2 says a row already linked to a
different subscription is left untouched. AC-2 was written against the original
incident — two *concurrently live* subscriptions — and the implementation resolved the
contradiction in the direction that strands a paying customer.

**Fix, once decided:** refuse only when the linked subscription is itself live.

```ts
const linkedIsLive =
  byCustomer?.status === "active" || byCustomer?.status === "trialing";
if (byCustomer?.stripeSubscriptionId && linkedIsLive) { /* emit + return */ }
existing = byCustomer;   // canceled / incomplete → adopt the replacement
```

`past_due` is the open question: it *is* eligible for checkout, so if it is not also
adoptable, a `past_due` manager who resubscribes hits the same dead end. Write the
answer into the spec, then add a test that seeds `sub_A` canceled on `cus_1`, delivers
`created` for `sub_B`, and asserts the row reads `sub_B` / `active`.

**Second, independent mechanism on the same flow.** The idempotency key at
`manager-subscription.service.ts:104` is
`manager-checkout:${clerkUserId}:${priceId}`. Stripe replays a stored response for 24h
— including a **completed** Checkout Session, so resubscribing inside a day hands back
a URL for a session that is already done and no second subscription is created. The key
also omits the body's `successUrl`/`cancelUrl`, so an origin difference
(`tatame.app` vs `www.tatame.app`, a preview deploy, localhost) makes Stripe answer
`400 Keys for idempotent requests can only be used with the same parameters` for 24h.

Careful when fixing this: the guard at `manager-subscription.service.ts:63` is a plain
read-then-write with no transaction, no lock and no DB constraint. **The idempotency
key, not the guard, is what makes two concurrent checkouts safe.** Do not fix it by
making the key unique per request. Add a coarse time component
(`…:${yyyy-mm-ddThh}`) or a per-attempt nonce, and derive the URLs server-side.

### B8 — Migration 0023 has no safe window and no rollback

`packages/db/drizzle/0023_rename_stripe_to_card.sql`

`ALTER TYPE … RENAME VALUE` is the right technique — it rewrites no rows, holds a brief
lock on the type only, and is transaction-safe on PG 16.13. The hand-edited snapshot is
verifiably truthful: `meta/0023_snapshot.json` differs from `0022` in exactly that one
value, `prevId` is chained correctly, and `npx drizzle-kit check` reports
"Everything's fine". **The SQL is not the problem. The choreography is.**

There is no moment when both labels are valid, no down migration, and the reverse
statement is written nowhere in the repo.

- Migrations are **manual** (`pnpm db:migrate`, a `drizzle-kit migrate`), *not* run by
  the container — `Dockerfile.api:61` is `CMD node … server.js`. And `main` is
  deploy-on-merge. So merging starts the window with nothing closing it.
- Apply early and the running image's `'stripe'` literals break — 6 sites in
  `admin.repository.postgres.ts`, plus `platform-summary.repository.postgres.ts:134`.
- Deploy early and the new code's `'card'` literals break identically.
- Postgres raises `invalid input value for enum payment_method` rather than returning
  false, so either direction takes out the admin dashboard and the daily summary job.
- **After 0023 commits, rolling the API back is an outage, not a retreat.**

Also user-visible: the 2.1.2 build on the stores renders
`item.method === "pix" ? "PIX" : item.method === "stripe" ? "Cartão" : "Manual"`
(`dependent-payment-history.tsx:90`). Post-rename a card payment falls through to
**"Manual"** — asserting the academy took cash — and there is no OTA channel
(`expo-updates` is not installed) to correct it.

**Fix, three parts:**

1. Make 0023 idempotent so a replay cannot poison a batch. Drizzle runs the batch in
   one transaction, and this repo already has `__drizzle_migrations` bookkeeping holes
   recorded in `tat-104/tasks.md:189-205`:
   ```sql
   DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'payment_method' AND e.enumlabel = 'stripe') THEN
       ALTER TYPE "public"."payment_method" RENAME VALUE 'stripe' TO 'card';
     END IF;
   END $$;
   ```
2. Confirm Coolify does a **stop-then-start** swap for the API, not a rolling one. A
   rolling update opens the window by design: the new container migrates while the old
   one is still serving.
3. Write the reverse `ALTER TYPE "public"."payment_method" RENAME VALUE 'card' TO
   'stripe'` into a runbook. There is no `docs/deployment.md` — the ordering knowledge
   currently lives only in a feature spec that will be archived. Creating that file is
   part of this fix.

For the mobile side, decide deliberately: either map `card` → `stripe` for callers
below `MIN_MOBILE_VERSION` (the version header is already read in `router.ts:33`), or
accept the regression and raise `MIN_MOBILE_VERSION` as part of this deploy rather
than after adoption.

---

## Decisions not to undo

Several things below look like oversights and are not. They have comments saying so;
this list exists so a future session does not "fix" them.

- **`transferred_at` still exists on `payments`.** `ab07930` removed the repasse
  *concept* — reporting, sums, both endpoints, the admin UI — but not the column.
  Dropping it needs a destructive, irreversible migration, and keeping it means the
  removal is reversible without the data having been thrown away. The operator
  confirmed no money is retained, which is why the removal is not scoped to legacy
  rows.
- **`processorFeeCents` keeps its pre-Asaas rates** (399 bps / 39¢ / 80¢) in
  `packages/config/src/constants.ts`. Its only remaining consumer is the daily
  summary's "Líquido dos managers". The real fix is feeding `NormalizedFees` in,
  because Asaas negotiates per account — *not* editing the constants. The comment says
  this. **This is still an open bug**: the daily figures are wrong by the difference
  between the two rate cards.
- **Two callers of `listWithPlanByUserAndAcademy` still filter `dependentId` inline**
  rather than using the new `withoutDependent` option —
  `subscription.service.ts:204` and `payment.service.ts:306`. That is correct, not
  laziness: their expiry loops run over the dependents' rows too, and narrowing the
  query would stop those subscriptions being marked expired.
- **`UNKNOWN_EVENT_TYPE` is deliberately unalerted**, and is the single allowed entry
  in the `UNALERTED` map in `catalog-coverage.test.ts`. Providers send dozens of event
  types the handlers ignore; counting them would make the rule fire forever.
- **The legacy AbacatePay Pix rail is alive on purpose.**
  `POST /payments/checkout/pix` and `GET /payments/pix-status/:id` are what the 2.1.2
  build on the stores calls. `api.smoke.test.ts:28` fails by name if they are deleted
  early. Removal is tracked in **TAT-187**.
- **`CARD_PAYMENT_ENABLED = false`** hides the card rail in the app; the API is
  untouched. TAT-189 replaces it with an Asaas subscription. `constants/payment.ts:16`
  annotates the constant `: boolean` on purpose, so the gated branches stay
  type-checked and flipping it back really is one line.

---

## Gaps in this session's own work

Stated plainly so they are not mistaken for coverage.

- **B2 has no integration test.** Both unit tests are deterministic and fail without
  the fix (verified by reverting it), and they had to set `createdAt` explicitly
  because the row ordering is what the bug depended on. But the route path has no
  end-to-end proof. The obstacle is that `seedHousehold` in
  `checkin-dependent.integration.test.ts` enrols the guardian in the adult plan and
  gives both plans `weeklyCheckinLimit: 2` — **that fixture sameness is exactly why a
  suite written for this invariant could not see this half of it.** Giving the two
  plans different limits (adult 5, kids 1) would strengthen the file, but
  `exhaustDependentWeeklyLimit` takes two sessions and would need adjusting with it.
- **B4's rules are unverified against a live Grafana.** The YAML parses, all 13 rules
  load with the intended severities and thresholds, and the new `catalog-coverage`
  guard fails when a money reason loses its query. Nobody has provisioned them and
  watched one fire. `docs/observability.md:745` has the reload curl.
- **Nothing in this session touched mobile behaviour**, so the SDK 57 upgrade still
  has zero automated coverage and the manual test plan in
  `tat-183/tasks.md` is still unrun. That file's traceability table says "Verified" for
  three requirements whose only stated evidence is a device walkthrough that has not
  happened — worth reconciling.

---

## Release sequence still pending

Unchanged from the audit except step 5, which is now done in code. Step 6 is the
irreversible one.

1. Generate `ASAAS_PAYMENT_WEBHOOK_TOKEN` (32–255 chars, **distinct per environment**)
   and set it in Coolify. It falls back to `ASAAS_WEBHOOK_TOKEN`, but sharing the value
   defeats the reason it was split: that token is written into every academy
   subaccount, where an operator can read it.
2. **Register the root-account webhook by hand.** `POST /v3/webhooks` on the production
   root key → `{API_PUBLIC_URL}/v1/webhooks/asaas`, `apiVersion: 3`,
   `sendType: SEQUENTIALLY`, `authToken` from step 1, the six `PAYMENT_*` events.
   **Without this no student payment is ever recorded** — a subaccount is not notified
   of a split it merely receives.
3. Confirm a Pix key exists on the production root account (`GET /v3/pix/addressKeys`).
   Asaas provisions it asynchronously; until it does, every QR fetch fails.
4. Confirm the Asaas evaluation caps fit the rollout — 10 subaccounts and
   R$ 2.000/charge for the first 60 days. `tat-104/tasks.md` blocker 3 is still marked
   open.
5. ~~Bump `apps/mobile` past 2.1.2~~ — done in `c56212e` (2.1.3, `buildNumber` 2,
   `versionCode` 2). Submitting the store build is still pending.
6. Deploy the API and apply `0021`–`0023` as close to simultaneously as possible.
   **Irreversible** — see B8. `0021`/`0022` are additive and safe to run ahead.
7. Once the new build is adopted, raise `MIN_MOBILE_VERSION` to 2.1.3. This is what
   unblocks TAT-187 stage 1. Blocked on step 5. **Do not do it early** — it locks out
   everyone still on 2.1.2.
8. Later: flip `PAYOUT_ACCOUNT_REQUIRED=true` once the onboarding build is adopted.
   TAT-179's acceptance criterion claims this gate is live; it is not, and no issue
   tracks the flip. Then check `select count(*) from pending_asaas_payments` and
   `pending_pix_payments` before TAT-187 stage 2.

---

## Worth fixing, not blocking

Carried forward from the audit, untouched. Roughly by value.

- **No HTTP timeout on any Asaas call.** `lib/asaas.ts:542` is a bare `fetch`; nothing
  in `apps/api` sets `AbortSignal` or a dispatcher, so the default is ~300s. Worst
  shape is the webhook: the first `PAYMENT_*` after boot resolves the root account id,
  and because that promise is cached, every concurrent delivery awaits the same hung
  call. Fix with `signal: AbortSignal.timeout(10_000)`; the existing `catch` already
  maps it to a 502.
- **An orphan charge is invisible.** In `payment.service.ts:427` and `:655` the Asaas
  call is wrapped and emits `payment.charge_failed`; the *next* line is a DB write whose
  failure emits nothing and surfaces as a generic 500. What is left behind is a live,
  split, payable charge with no row that can ever reconcile it — a guaranteed future
  `NO_PENDING_CHARGE`. Wrap it, emit with `stage: "persist_pending"`, and best-effort
  cancel the charge before rethrowing. Pair this with the timeout above, which makes
  the partial-failure window more frequent.
- **No unique constraint behind the duplicate-month guard.**
  `pending_asaas_payments` has `subscription_id` and `reference_month`
  (`schema/index.ts:519-528`) and no constraint on the pair, so two concurrent
  `POST /payments/pix` calls can both open a live split charge. D9 rejected a
  constraint on `payments` because it would block re-paying after a refund — but the
  service guard already 409s that month on every path, so that cost is already being
  paid. A constraint on `pending_asaas_payments` cannot create the dead end D9 feared,
  because those rows are deleted on settlement and on manual confirmation.
- **The webhook token split has no overlap window.** `tokensFor` returns only the
  payment token for `PAYMENT_*` events, and the Asaas-side `PUT` and the env change
  cannot be simultaneous — either order 401s live deliveries, and Asaas interrupts a
  repeatedly-failing queue until it is manually reactivated. Accept both values for one
  release, then drop the fallback and require the split token in production.
- **The legacy rail did not get the H6 fix.** `payment.service.ts:516` uses
  `subs.find(s => s.subscription.status === "active")` with no `!dependentId`, where
  `openChargeContext:306` has it. Same one-line shape as B2. Low risk today because the
  shipped app always sends `subscriptionId`, but a guardian on 2.1.2 who omits it can
  still be handed a dependent's charge.
- **The old bug's damage is unremediated and still billable.** Guardians who changed
  their own plan under the H3 bug have dependents sitting `cancelled` with a paid month
  attached — identifiable as `student_subscriptions` rows where
  `dependent_id IS NOT NULL AND status = 'cancelled'` whose `updated_at` matches, to the
  millisecond, a sibling row with `dependent_id IS NULL` for the same `user_id`. Worse,
  the mechanism is live for *everyone*: `existsForSubscriptionReferenceMonth` is keyed
  by subscription id while `replaceActiveSubscriptionForAcademy` always creates a new
  row, so any student who switches plan mid-month after paying can be charged twice.
  Re-key the guard on the payer.
- **`overdueStudentsPerAcademy` under-counts households.** `countDistinct(userId)` at
  `platform-summary.repository.postgres.ts:94` caps a guardian plus two overdue
  dependents at 1, while sibling metrics in the same email count memberships
  (dependents invisible) and subscription rows (dependents included) — three
  inconsistent denominators. Fix with
  `countDistinct(coalesce(dependent_id, user_id))`, and decide once whether "students"
  in that email means people-with-memberships or people-with-subscriptions.
- **Un-stub the mobile typecheck.** The stub's stated reason — NativeWind `className`
  types — is obsolete: with `nativewind@4.2.7` there are zero `className` errors. It is
  a 5-error job (see *Gates*) and would give the SDK-major upgrade the CI gate it
  currently lacks. `apps/mobile` and `packages/db` also have `lint` =
  `echo 'no lint configured'`, and `pnpm lint` is not in CI at all
  (`.github/workflows/ci.yml` runs build + unit + integration only).
- **Documentation drift**, all three the kind someone will act on:
  `.specs/features/tat-104-asaas-payment-split/design.md:96,172-173` still documents
  the removed in-app document-upload endpoint;
  `platform-summary.repository.postgres.ts:258` says the legacy Pix route "was deleted
  in B9" when it was restored in this same PR — that is what whoever executes TAT-187
  will read; and `payout-account.service.ts:65,122` still exposes `canUploadInApp`,
  which no UI reads now that the uploader is gone.
- **Two stale coverage excludes** in `apps/api/vitest.config.ts:25` name
  `src/lib/abacatepay.ts`, deleted in this PR. (Line 15's
  `abacatepay-webhook.handler.ts` is still correct — that handler is intentionally
  alive.)
- **`academy-membership.integration.test.ts` is flaky**, passing on `retry x1` under the
  `retry: 2` in `vitest.config.ts`. Pre-existing, not from this PR, but it makes a red
  CI run there noise-prone.
