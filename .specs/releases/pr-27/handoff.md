# PR #27 — release handoff

**PR:** #27, `dev` → `main`, "Asaas payment split, Expo SDK 57 e correções de dependentes"
**Written:** 2026-09-30 · **Updated:** 2026-10-01 (third session)
**Base of the audit:** `554e92e` (merge-base with `main`: `2876166`)
**State:** 17 commits since the audit base, 4 of them from the third session.
**Not pushed.** Working tree clean. Full gates green on `8fbed7f`, including the
integration suite.

This picks up from a five-reviewer audit of the branch. Eight blockers were found.
**Seven are fixed, one is open: B7**, and the operator has parked it deliberately. B6
was fixed in `6e270ed`; B8 was closed by **removing its cause** — the enum rename is
reverted and deferred to TAT-190 — so **nothing in this PR is irreversible any more**
and the deploy no longer has to be simultaneous with a migration.

---

## Where to start

The code is in a releasable state. What is left is **not blockers but the release
sequence**, plus four decisions that belong to the operator.

**If you are picking this up to write code,** nothing on the critical path is waiting
for you. The useful work, roughly by value:

1. Nothing in B7 until the `past_due` question below is answered. Do not guess it: both
   answers are defensible and the wrong one strands a paying customer.
2. The *Worth fixing, not blocking* list, top-down. The three that were on the money
   path — no HTTP timeout, an invisible orphan charge, no unique constraint behind the
   duplicate-month guard — were done in the third session, along with the legacy rail's
   missing H6 fix. What now heads that list is **the H3 damage, and it is live in
   production today**: `existsForSubscriptionReferenceMonth` is keyed by subscription
   while `replaceActiveSubscriptionForAcademy` always creates a new row, so a student
   who switches plan mid-month after paying can be charged twice. That one is not this
   PR's doing and does not block it, but it is happening now rather than later.
3. The device walkthrough in *Gaps → Second session*. `apps/mobile` has no test runner,
   so four behaviours from this session exist only as read code. That file lists exactly
   what to open and what it should say.

**If you are picking this up to ship,** go straight to *Release sequence still pending*.
**Step 2 is the one that decides whether the release works at all** — without the
root-account webhook registered by hand, no student payment is ever recorded, and
nothing in the code will tell you.

**Before touching the payment or reporting code,** read *Decisions not to undo*. Several
things that look like oversights are deliberate and say so in comments — including
`payments.method` still storing `stripe` for a card payment.

---

## Waiting on the operator

Four decisions. None blocks a deploy; the first two block work that is otherwise ready.

| # | Decision | What it unblocks |
| --- | --- | --- |
| 1 | **Is a `past_due` manager subscription adoptable** when they resubscribe, the way a `canceled` one is? Both answers defensible; see B7 for why it matters. | B7's fix and its test. Write the answer into the spec first — the spec is what contradicts itself. |
| 2 | **The 5 placeholders in `legal-copy-draft.md`**, plus legal review of the payments block (Terms §6–§8 and §11). | Publishing the rewritten Terms and Privacy Policy. The draft is complete otherwise; the pages are deliberately untouched because `main` deploys on merge. |
| 3 | **Where the in-app link to the Terms and the Privacy Policy goes.** A design call. The stores ask for it and 2.1.3 is not submitted yet, so the window is still open. | Submitting 2.1.3 without a known gap. |
| 4 | **Should `PayoutAccountCard` be gated on the Pro plan?** A free academy sees a receiving-account card for a feature `payment.service.ts:281` refuses it. Pre-dates this PR. | Nothing. Cosmetic; listed so it is a choice rather than a leftover. |

Item 2 has a hard edge worth stating: the liability cap in Terms §11 is ~R$ 600
(12 × R$ 49,90). That covered a management app. The service now touches an academy's
whole monthly revenue through our own Asaas account. Whether the cap survives that is a
legal question, not a technical one, and the draft flags it rather than answering it.

---

## Commits

### First session (2026-09-30)

| SHA | What |
| --- | --- |
| `4989c10` | `[tat-186]` only the guardian of record can check in a dependent |
| `ab07930` | `[tat-104]` retire the manual transfer step the split replaced |
| `c56212e` | `[tat-104]` bump the mobile app to 2.1.3 |
| `3f7db7c` | `[tat-181]` resolve a guardian's own plan from their own subscription |
| `515d91d` | `[tat-104]` alert on the money events the Asaas rails actually emit |

### Second session (2026-10-01)

| SHA | What |
| --- | --- |
| `8f3caca` | `[tat-104]` describe the payment rail the split actually built (landing page) |
| `a5bd409` | `[tat-104]` drop the chave PIX the split made dead |
| `67599dd` | `docs(pr-27)` draft the legal copy the split makes necessary |
| `6e270ed` | `[tat-104]` **B6** — stop showing students raw error codes on the Pix rail |
| `691fd7a` | `[tat-104]` **B8** — postpone the `stripe` → `card` enum rename |

### Third session (2026-10-01)

Four items off the *Worth fixing* list, chosen because they are the ones this PR
introduces rather than inherits. B7 was deliberately left open — see its section.

| SHA | What |
| --- | --- |
| `a6ac03b` | `[tat-104]` bound every Asaas call (10s) so a hung one cannot stall the webhook queue |
| `33ef286` | `[tat-104]` charge the caller's own plan on the legacy Pix rail (H6) |
| `9e3bd36` | `[tat-104]` stop an Asaas charge outliving the row that reconciles it — orphan + the `0023` unique index |
| `8fbed7f` | `chore(api)` drop the coverage exclude for a deleted file |

`9e3bd36` is deliberately not two commits. `createPendingAsaas` was an untargeted
`onConflictDoNothing`, so adding the index under it would have made the loser of a
race a silent no-op — converting a double charge into an orphan charge, which is
strictly worse. The target and the index are only correct together.

Each commit message carries the full reasoning; this file does not repeat it.

### Gates, re-run on `8fbed7f`

| Gate | Result |
| --- | --- |
| `npx turbo build` | 8/8 |
| `npx turbo test:unit` | **737**/737, 42 files (was 730, 716 at `554e92e`) |
| `pnpm --filter @tatame/api test:integration` | **129**/129, 16 files (was 128) |
| `npx turbo typecheck` | 13/13 |
| `npx turbo lint` | 0 errors, 5 warnings (all pre-existing in `apps/web`) |

The integration suite replays the migration journal into a fresh schema, so it also
proves `0021`–`0023` apply cleanly. It needs Docker running (testcontainers).

**`0023` is a different migration now.** The enum rename that used to hold that number
was reverted in `691fd7a` (B8); the current `0023_lame_boomer.sql` is the unique index
on `pending_asaas_payments`. Anywhere below that says "`0023` was removed" means the
enum rename, which is TAT-190's to redo under whatever number is free then.

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

**This is a regression this PR introduces, not inherited debt.** Verified against
`main` in the third session: there the handler reads
`findByStripeSubscriptionId(sub.id) ?? findByStripeCustomerId(stripeCustomerId)` and
updates that row with the new `sub.id`, so **a manager who cancels and resubscribes
works in production right now**. The TAT-185 guard (`c33e351`, in this PR) is what
creates the dead end. It fixes the original incident — two concurrently live
subscriptions — and breaks the other case.

That splits the fix in two, and **only one half needs the decision**. Restoring
`main`'s behaviour for `canceled` is the regression, and it is unambiguous. The
`past_due` question is a new policy call that was never settled either way, so it can
be answered later without leaving the regression in place. The operator chose to leave
both for now: the only customer who cancelled has not come back, so the path is
unreachable today.

**This needs a decision before code** — for the `past_due` half. The spec contradicts
itself: DUP-03 says a cancelled manager may resubscribe; the webhook's AC-2 says a row
already linked to a different subscription is left untouched. AC-2 was written against the original
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

### B8 — The enum-rename migration had no safe window and no rollback — **CLOSED by removal** (`691fd7a`)

Not fixed: **withdrawn.** `1511ba3` is reverted, the enum-rename migration and its
snapshot are deleted, and the branch stores `stripe` for a card payment again. Nothing
in this PR is irreversible now, and the release no longer has an ordering constraint
between the deploy and a migration.

**The number `0023` was reused.** When this was written the journal closed at `0022`;
the third session added a new `0023` for the `pending_asaas_payments` unique index.
Every reference to "`0023`" in this section means the enum rename, not that file.

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

## Gaps in this work's own coverage

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

### From the second session

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

### From the third session

- **The unique index found an unreachable test fixture on its first run.**
  `platform-summary.integration.test.ts` stacked three `pending_asaas_payments` rows on
  one subscription and month — unpaid, settled, and a card checkout — to exercise the
  three branches of `unpaidPixPerAcademy` at once. The index refused it, correctly: the
  service deletes the open row before opening another and the webhook deletes it on
  settlement, so that arrangement cannot occur. The fixture now uses one subscription
  per state; all three branches stay covered and the assertion is unchanged. Worth
  knowing because it is the kind of fixture sameness that hid half of B2.
- **Every fix was verified by reverting it.** Each of the eight new tests was watched
  failing with its fix backed out and passing with it in — including the integration
  test for the index, checked by neutralising `0023`'s SQL so the testcontainer came up
  without it. That is the standard the rest of this file's claims were held to.
- **The money path still has no end-to-end proof of the orphan undo against Asaas.**
  `persistPendingCharge` cancels through the fake client in unit tests and the index is
  proven against real Postgres, but nothing has watched a real `deletePayment` land
  after a real persist failure. The window is hard to force and the event is on the
  record either way; stated so it is not mistaken for coverage.

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
6. Apply `0021`/`0022`/`0023` and deploy the API. All three are **additive**, so they
   are safe to run ahead of the deploy and safe to leave applied if the deploy is rolled
   back. `0023` is the `pending_asaas_payments` unique index, written idempotent and
   carrying its own reverse statement; the enum rename that used to be `0023` was
   removed (B8) and is tracked as TAT-190. If `0023` ever fails with "could not create
   unique index" the table holds two open charges for one month — real money. Read both
   ids out, cancel the loser in Asaas, then delete that row. Do not delete a row to
   make the migration pass.
7. Once the new build is adopted, raise `MIN_MOBILE_VERSION` to 2.1.3. This is what
   unblocks TAT-187 stage 1. Blocked on step 5. **Do not do it early** — it locks out
   everyone still on 2.1.2.
8. Later: flip `PAYOUT_ACCOUNT_REQUIRED=true` once the onboarding build is adopted.
   TAT-179's acceptance criterion claims this gate is live; it is not, and no issue
   tracks the flip. Then check `select count(*) from pending_asaas_payments` and
   `pending_pix_payments` before TAT-187 stage 2.

---

## Worth fixing, not blocking

Carried forward from the audit. Roughly by value.

**Five are done** — the three money-path items, the legacy rail's H6 fix and the stale
coverage exclude, in the third session's four commits. What remains is below, untouched.

- **The webhook token split has no overlap window.** `tokensFor` returns only the
  payment token for `PAYMENT_*` events, and the Asaas-side `PUT` and the env change
  cannot be simultaneous — either order 401s live deliveries, and Asaas interrupts a
  repeatedly-failing queue until it is manually reactivated. Accept both values for one
  release, then drop the fallback and require the split token in production.

  **This release escapes it, if the steps are ordered.** Step 2 registers a *new*
  webhook rather than editing an existing one, and `ASAAS_PAYMENT_WEBHOOK_TOKEN` is
  `.optional()` in `packages/config/src/env.ts:55` with a fallback to
  `ASAAS_WEBHOOK_TOKEN`, so the deploy does not need it to boot. Set the token in
  Coolify first, deploy, then register the webhook: there are no live deliveries to
  401 in between. The overlap problem is a *rotation* problem, and it arrives the first
  time this token changes.
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
