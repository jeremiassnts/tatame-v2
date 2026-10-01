# PR #27 — release handoff

**PR:** #27, `dev` → `main`, "Asaas payment split, Expo SDK 57 e correções de dependentes"
**Written:** 2026-09-30
**Base of the audit:** `554e92e` (merge-base with `main`: `2876166`)
**State:** 10 commits on `dev`, **not pushed**. Working tree clean.
**Updated:** 2026-10-01 — second session. Read *Where to start* again; it changed.

This picks up from a five-reviewer audit of the branch. Eight blockers were found.
**Seven are fixed, one is open: B7.** B6 was fixed in `6e270ed`; B8 was closed by
**removing its cause** — the enum rename is reverted and deferred to TAT-190 — so
nothing in this PR is irreversible any more.

---

## Where to start

**B7 is the only blocker left**, and it needs a product decision before code — the
operator has parked it for now. Everything else on the list below is done.

What is left is not blockers but the *release sequence*, and step 2 is the one that
decides whether any student payment is ever recorded. Read that section next.

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

### Commits in the second session (2026-10-01)

| SHA | What |
| --- | --- |
| `8f3caca` | `[tat-104]` describe the payment rail the split actually built (landing page) |
| `a5bd409` | `[tat-104]` drop the chave PIX the split made dead |
| `67599dd` | `docs(pr-27)` draft the legal copy the split makes necessary |
| `6e270ed` | `[tat-104]` **B6** — stop showing students raw error codes on the Pix rail |
| `691fd7a` | `[tat-104]` **B8** — postpone the `stripe` → `card` enum rename |

Each commit message carries the full reasoning; this file does not repeat it.

### Gates, re-run on `691fd7a`

| Gate | Result |
| --- | --- |
| `npx turbo build` | 8/8 |
| `npx turbo test:unit` | **730**/730, 42 files (was 716 at `554e92e`) |
| `pnpm --filter @tatame/api test:integration` | **128**/128, 16 files (was 126) |
| `npx turbo typecheck` | 13/13 |
| `npx turbo lint` | 0 errors, 5 warnings (all pre-existing in `apps/web`) |

The integration suite replays the migration journal into a fresh schema, so it also
proves `0021`–`0022` apply cleanly — `0023` is gone, see B8. It needs Docker running
(testcontainers).

**`npx turbo typecheck` does not cover `apps/mobile`** — that script is
`echo 'skipped: …'`. The real check is `cd apps/mobile && npx tsc --noEmit -p
tsconfig.json`, which reports **4 errors**, all pre-existing `Belt`-typing issues.

**Correction to the first session's note:** it recorded 5, counting
`app/_layout.tsx(1,8) TS2882` on the `global.css` side-effect import. That error does
not reproduce. Measured against the branch point with `git stash`: 4 before, 4 after.

---

## Blockers

### B6 — Students see raw error codes on the only payment rail — **FIXED** (`6e270ed`)

`PixPaymentView` now calls `describeApiError`, so `PAYOUT_ACCOUNT_REQUIRED` and
`CPF_REQUIRED` render their Portuguese sentences instead of the identifier.

**The prescribed fix was incomplete.** The import alone left the third symptom in
place: a 409 still rendered `Payment already exists for this period` in English,
because an *uncoded* `HttpError` answers the same string in both response fields and
`describeApiError` returned `detail` before consulting its `TRANSLATED` map. Four of
that map's six entries were unreachable for the same reason — only the two sent by
middleware, which omits `message`, ever fired. The lookup now runs first. That also
fixes the 409 in the 9 screens that already used the helper.

Found while verifying and **not fixed**: `middleware/validate.ts:9` answers
`{ error: <zod flatten object> }`, so a schema rejection reaches the user as
`[object Object]`. Different path, and no payment screen posts a body that can fail
that way.

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

### B8 — Migration 0023 has no safe window and no rollback — **CLOSED by removal** (`691fd7a`)

Not fixed: **withdrawn.** `1511ba3` is reverted, `0023` and its snapshot are deleted,
the journal closes at `0022`, and the branch stores `stripe` for a card payment again.
Nothing in this PR is irreversible now, and the release no longer has an ordering
constraint between the deploy and a migration.

The audit under-stated the blast radius, which is what settled it. The failure is a
**literal coercion, not a row comparison** — verified in Postgres 16.13, not reasoned
about. A table with 2 pix rows, 1 manual and **no card payment at all** still answers
`ERROR: invalid input value for enum payment_method: "stripe"` to the deployed image's
query after the rename, and `SELECT 'stripe'::payment_method` fails without touching a
table. So the admin dashboard and the daily summary break for *every* academy,
including the Pix-only ones. Against that: the value exists on 2 historical rows, and
card is the rail this release disables.

Two things were kept rather than reverted, so the rename is cheaper later than it was
here:

- `paymentMethodLabel` (`apps/mobile/lib/format/payment-method.ts`) maps **both**
  spellings to "Cartão" and replaces the ternary in both history screens. This is the
  one part that cannot be bought after the fact — without `expo-updates`, a published
  build that knows one spelling makes any future rename wait on a store release. 2.1.3
  was still unsubmitted, so it was free.
- A comment on `paymentMethodEnum` records why the misnomer stays.

Carried to **TAT-190**, scheduled with TAT-189, which rewrites this rail anyway. That
issue holds the idempotent SQL, the deploy order, the reverse statement and the
Coolify question. Restoring the work is `git revert 691fd7a`.

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
- **`payments.method` still stores `stripe` for a card payment, and that is not an
  oversight.** The rename was written, tested and reverted — see B8, and the comment on
  `paymentMethodEnum` says so at the definition. It belongs to TAT-190/TAT-189. The
  clients already accept both spellings, so re-doing it is a database-plus-API change
  with no store dependency.
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

### Second session (2026-10-01)

- **The mobile changes have no automated proof.** `apps/mobile` has no test runner, so
  B6's two fixes, `paymentMethodLabel`, the removal of the chave PIX card and the
  repointed dashboard warning are all verified only by `tsc` and by reading. Four
  behaviours worth a device walkthrough: a student at an unapproved academy opening the
  Pix screen (should read Portuguese, not `PAYOUT_ACCOUNT_REQUIRED`); paying a month
  twice (should read "O pagamento deste mês já foi registrado"); a payment history row
  for a card payment (should read "Cartão", from the stored `stripe`); and a Pro manager
  with no payout account on the dashboard (should be warned about the conta de
  recebimento, and the warning should clear on pull-to-refresh after approval).
- **The legal copy is drafted, not published.** `legal-copy-draft.md`, next to this
  file, rewrites both documents in full — 14 terms sections against today's 8, 12
  privacy sections against 7 — because the terms have no clause about the money a
  student pays and the privacy policy names no operator and discloses none of the KYC
  set. `apps/web/app/(site)/termos/page.tsx` and `privacidade/page.tsx` are
  deliberately untouched: `main` deploys on merge. It needs 5 placeholders filled and
  legal review of the payments block before it goes anywhere near a page.
- **The landing page corrections only become true on deploy.** `8f3caca` says Pix-only;
  2.1.2 on the stores can still pay by card until `MIN_MOBILE_VERSION` rises (step 7).
  The site understates the methods in the meantime, which is the safe direction.

---

## Release sequence still pending

Steps 5 and 6 changed. **No step is irreversible any more** — `0023` is gone (B8), so
the deploy and the migrations no longer have to be simultaneous. Step 2 is now the one
that decides whether the release works at all.

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
6. Apply `0021`/`0022` and deploy the API. Both migrations are **additive**, so they
   are safe to run ahead of the deploy and safe to leave applied if the deploy is rolled
   back. `0023` was removed (B8) and is tracked as TAT-190.
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
- **No link to the Terms or the Privacy Policy anywhere in the app.** The site has
  them on `/cadastro`; no mobile screen does. The stores ask for it and 2.1.3 is not
  submitted yet. Where to put it is a design call.
- **No record of who accepted which version of the terms.** Nothing stores an
  acceptance. With payment in the flow that acquires evidentiary value. Not this PR's
  work, but nothing tracks it either.
- **A free-plan academy sees the "Conta de recebimento" card** on the finances screen,
  although `payment.service.ts:281` refuses automatic payment for `free`.
  `PayoutAccountCard` has never been gated by plan — pre-dates this PR.
- **`middleware/validate.ts:9` answers `{ error: <zod flatten object> }`**, so a schema
  rejection renders as `[object Object]` on any screen using `describeApiError`. No
  payment screen posts a body that can fail that way, which is why it is here and not
  in B6.
- **`academy-membership.integration.test.ts` is flaky**, passing on `retry x1` under the
  `retry: 2` in `vitest.config.ts`. Pre-existing, not from this PR, but it makes a red
  CI run there noise-prone.
