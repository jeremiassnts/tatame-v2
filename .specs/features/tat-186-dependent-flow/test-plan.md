# TAT-186 — Manual test plan: student → dependent → plan → payment

Purpose: reproduce and record the real behaviour of the dependent flow **before any code
changes**, as the ticket demands. The flow under test is the one the customer actually uses:
a **student** who is also a guardian of a dependent.

Everything below is observation only. No fix is applied until the "Findings" table is filled
in with real status codes and DB rows.

---

## 1. Environment under test

| Item | Value |
| --- | --- |
| Database | remote dev DB (`31.97.64.10:5432/postgres`) — the one `.env` points at |
| Academy | `Fighter's BJJ` — `299c9346-46a5-498a-986d-408fced2b3a7` |
| Manager (owner) | `d7e550c2-591d-4172-8692-b5dc86ce7e9b` |
| Academy plan | `pro` ✔ (Pix/card path is not blocked by `PLAN_LIMIT_PAYMENTS`) |
| Payout account | `approved`, wallet present ✔ (`PAYOUT_ACCOUNT_REQUIRED` is `false` anyway) |
| Asaas | sandbox (`https://api-sandbox.asaas.com`) |
| Webhook ingress | `API_PUBLIC_URL=https://ayesha-squirrelly-winnifred.ngrok-free.dev` — **ngrok must be up or no payment is ever confirmed** |
| Card payment | `CARD_PAYMENT_ENABLED = false` → only the **Pix** button renders. Card is out of this run. |
| Plans available | `Completo` R$ 1,00 · `Básico` R$ 5,00 (3 check-ins/sem) · `Kids` R$ 5,00 (2 check-ins/sem) |

### Test subject

`jeremiassnts.dev@gmail.com` — `14dd7bf3-2eb5-4a8c-a7ec-42a06ce7af8c`, role `student`,
membership `active` in Fighter's BJJ. T1 is therefore already satisfied; the run starts at T2.

### What has to be up

1. API — `pnpm api:dev` (port 3001)
2. ngrok tunnel on 3001 matching `API_PUBLIC_URL` (only needed for step T7)
3. Expo Go on the phone, logged in as the student above
4. A second session as the manager (`Rafael Silva`) to approve the join request and to
   confirm a manual payment in T9

---

## 2. State observed at the start of run 1 (2026-09-30)

T1–T5 and the "paying" half of T7 were already carried out by hand before this snapshot.

**Dependents** (`guardian_id = 14dd7bf3…`)

| id | name | birth | deleted_at |
| --- | --- | --- | --- |
| `840b48c8` | Jose Deodo | 2022-05-25 | 2026-09-30 16:15 (soft-deleted today) |
| `2f5107a6` | Guilherme Albuquerque | 2019-04-13 | 2026-09-30 16:15 (soft-deleted today) |
| `541200f3` | **Joao** | 2021-09-30 | — (the one under test, created 16:15:48) |

Joao has one `belt_promotions` row, `grey` / 0 stripes, `is_current = true`. No check-ins yet.

**Subscriptions** (`user_id = 14dd7bf3…`)

| id | plan | dependent_id | status | starts | expires |
| --- | --- | --- | --- | --- | --- |
| `92dbb0c8` | Básico | — | expired | 2026-03-22 | 2026-06-25 |
| `0930473a` | Kids | Guilherme | expired | 2025-09-17 | 2026-06-25 |
| `018f0174` | Kids | Jose Deodo | expired | 2026-05-25 | 2026-06-25 |
| **`df47e309`** | **Básico** R$ 5,00 | — | **active** | 2026-09-30 | 2026-10-30 |
| **`ffc42693`** | **Kids** R$ 5,00 | **Joao** | **active** | 2026-09-30 | 2026-10-30 |

**Payments** — 9 rows, of which the two for the current month:

| id | subscription | dependent_id | amount | method | reference_month | asaas id |
| --- | --- | --- | --- | --- | --- | --- |
| `132fe111` | `df47e309` (own) | — | R$ 5,00 | pix | 2026-09-01 | `pay_trybgscft0qocsok` |
| `c080dc05` | `ffc42693` (Joao) | `541200f3` | R$ 5,00 | pix | 2026-09-01 | `pay_7vrsobpbpc7xxdkh` |

`pending_pix_payments` is empty — both charges were confirmed and their pending rows cleared.

### What this already confirms

- **The happy path works end to end.** Create dependent → initial belt → select plan → Pix
  charge → Asaas webhook → payment row, all correct, and the Asaas handler does copy
  `dependent_id` onto the payment (`asaas-payment.handler.ts:222`). H1 does not bite on the
  student path, because the student holds an active membership.
- **`cancelActiveForDependent` is correctly scoped**: subscribing Joao left the student's own
  `df47e309` active. H3 still stands for the reverse direction — see T8, not yet run.
- **H2 is live right now.** `GET /payments/me` returns all 9 rows, the 5 dependent ones
  included, so the student's own "Histórico de pagamentos" lists the dependents' payments as
  if they were the student's — and labels every one of them with the *student's* plan name
  (`(student)/(subscription)/index.tsx:352` renders `plan.name` from the student's own
  subscription, never the payment's). Today the month reads "Pago" legitimately, because both
  were paid; had only Joao's been paid, the student's own month would still read "Pago".

---

## 3. The flow

Each step records: the tap, the endpoint it fires, the DB check, and what we are watching for.

### T1 — Student joins the academy

- **App**: `(joining)/search-academy` → pick Fighter's BJJ → request to join → `pending-approval`
- **API**: `POST /memberships/requests` (or equivalent), then manager approves
- **DB**: `select status, is_active, role from academy_memberships where user_id='<student>'`
- **Expect**: one row, `status=active`, `is_active=true`, `role=student`
- **Watch**: until this row exists, *every* step below answers **403 `No active academy
  membership`** — `requireActiveAcademy` (`apps/api/src/middleware/academy-context.ts:44`).
  This is the ticket's leading hypothesis (H1); on the student path it is expected and
  correct, on the guardian-onboarding path it is the dead end.

### T2 — Student subscribes to their own plan

- **App**: tab Assinatura → Escolher plano → `Básico` (R$ 5,00) → Confirmar
- **API**: `POST /subscriptions/me/plan` `{ planId }` — no `dependentId`
- **DB**:
  ```sql
  select id, plan_id, dependent_id, status, starts_at, expires_at
    from student_subscriptions where user_id='<student>' order by created_at desc;
  ```
- **Expect**: 201, one `active` row with `dependent_id = null`
- **Watch**: `selectPlan` calls `replaceActiveSubscriptionForAcademy`, which for a null
  `dependentId` runs `cancelActiveForUserInAcademy` — see **H3**, it cancels *every* active
  row of this user in the academy, dependents included. Nothing to cancel yet at T2; this is
  the control reading for T8.

### T3 — Student creates a dependent

- **App**: Mais → Dependentes → Novo Dependente → name, birth date, kids belt, stripes
- **API**: `POST /dependents` (`authorize(Guardian, Student)` → `attachActiveAcademyContext`
  → `requireActiveAcademy`)
- **DB**:
  ```sql
  select id, name, birth_date, academy_id, deleted_at from dependents where guardian_id='<student>';
  select * from belt_promotions where dependent_id='<dep>';
  ```
- **Expect**: 201; one dependent row; one `belt_promotions` row with `is_current=true`
- **Record**: if it fails — **exact status code and body**. This screen surfaces
  `ApiError.message`, which is the API's `error` field, so the Alert text is the real
  server message (unlike the guardian screen, which swallows it).

### T4 — Dependent shows up in the list and detail

- **App**: back to Dependentes; open the dependent
- **API**: `GET /dependents/me`, `GET /dependents/:id`
- **Expect**: belt and stripes as entered; `subscriptionStatus: null`

### T5 — Dependent subscribes to a plan

- **App**: dependent → Assinatura → "Nenhum plano ativo" → Escolher plano → `Kids` → Confirmar
- **API**: `POST /subscriptions/me/plan` `{ planId, dependentId }`
- **DB**:
  ```sql
  select id, user_id, plan_id, dependent_id, status, starts_at, expires_at
    from student_subscriptions where user_id='<student>' order by created_at desc;
  ```
- **Expect**: a second `active` row, same `user_id`, `dependent_id = <dep>`; the student's own
  row from T2 **still `active`** (this path calls `cancelActiveForDependent`, which is scoped)
- **Watch**:
  - **H8** — the plan list (`plans/index.tsx`) computes `currentPlanId` from
    `useMySubscription()` even when `dependentId` is set, so it will mark the *student's* plan
    as "atual" while choosing the *dependent's*.
  - **H9** — in the same screen the back button renders only when `currentPlanId` exists. A
    student with no plan of their own who lands here to choose the dependent's plan has no way
    back.

### T6 — Not paying: what both sides show

Do this **before** any payment, on the same calendar month.

- **App (student)**: dependent → Assinatura
  - **Expect**: "Pagamento pendente" / badge `Pendente`, Pix button enabled
- **App (student)**: own Assinatura tab
  - **Expect**: also `Pendente` — nothing has been paid
- **App (manager)**: Finanças → Assinaturas, filter pending
  - **API**: `GET /subscriptions/academy?pendingPayment=true`
  - **Expect**: two entries, one named after the student, one after the dependent
    (`dependentName` is joined in `listByAcademy`)
- **DB**: `select * from payments where user_id='<student>'` → empty

### T7 — Paying the **dependent's** month via Pix (Asaas sandbox)

- **App**: dependent → Assinatura → Pix → pay the QR in the Asaas sandbox
- **API**: `POST /payments/pix` `{ subscriptionId: <dependent sub>, cpfCnpj }`, then the
  webhook `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` on `/webhooks/asaas`
- **DB** (the decisive query of this whole run):
  ```sql
  select id, subscription_id, user_id, dependent_id, amount_cents, method,
         reference_month, paid_at
    from payments where user_id='<student>' order by paid_at desc;
  ```
- **Expect**: one row, `dependent_id = <dep>` (the Asaas handler copies it off the
  subscription — `asaas-payment.handler.ts:222`), `reference_month` = 1st of current month
- **Watch — H2, the main suspect of this run**: `GET /payments/me` →
  `listForStudent` → `findByAcademy(academyId, { userId })`
  (`payment.repository.postgres.ts:75`) filters by `user_id` **only**, never by
  `dependent_id is null`. The dependent's payment therefore lands in the *student's own*
  history, and `(student)/(subscription)/index.tsx:229` computes `hasPaid` from it.
  **Predicted symptom: after paying only for the kid, the student's own mensalidade flips to
  "Pago" and the Pix button disappears — without the student having paid a cent.**
  Confirm both screens and screenshot them.
- Also check the manager side: `GET /subscriptions/academy?pendingPayment=true` should now
  list only the student's own subscription.

### T8 — Student changes their own plan (regression probe)

- **App**: student's own Assinatura → Escolher plano → `Completo` → Confirmar
- **API**: `POST /subscriptions/me/plan` `{ planId }` — no `dependentId`
- **DB**:
  ```sql
  select id, plan_id, dependent_id, status, updated_at
    from student_subscriptions where user_id='<student>' order by created_at;
  ```
- **Watch — H3**: `cancelActiveForUserInAcademy`
  (`subscription.repository.postgres.ts:151`) filters on `user_id + status=active + plan in
  (academy plans)` and **not** on `dependent_id is null`.
  **Predicted symptom: the dependent's subscription is silently cancelled** and the dependent
  screen falls back to "Nenhum plano ativo" — after the month was already paid.

### T9 — Paying by hand (manager confirms)

Only if T7's Pix path is blocked, or to cover the manual rail as well.

- **App (manager)**: Finanças → confirmar pagamento for the **dependent's** subscription
- **API**: `POST /payments` `{ subscriptionId, amountCents, referenceMonth }`
- **DB**: `select id, subscription_id, dependent_id from payments order by created_at desc limit 3;`
- **Watch — H4**: `confirmManual` (`payment.service.ts:147`) builds the row without
  `dependentId`. **Predicted symptom: `dependent_id` is null, so the payment never appears in
  `GET /payments/dependent/:id` and the dependent's history stays empty while the manager sees
  it as paid.** The three webhook handlers all set it; only the manual path does not.

---

## 3b. H10 — Reproduced: the dependent's month stays "Pendente" after it is paid

**Symptom reported during run 1**: the Pix payment for Joao completed and the app announced
it, but going back to the dependent's subscription screen still shows `Pendente`, and tapping
Pix again answers *"já existe pagamento"* (409 `Payment already exists for this period`,
`payment.service.ts` → `openChargeContext`).

**Root cause**: `(student)/(subscription)/pix-payment.tsx` never reads or forwards
`dependentId`. Its guardian twin does:

```tsx
// (guardian)/(dependents)/pix-payment.tsx      ← correct
<PixPaymentView subscriptionId={params.subscriptionId} dependentId={params.dependentId} … />

// (student)/(subscription)/pix-payment.tsx     ← the bug
<PixPaymentView subscriptionId={params.subscriptionId} … />   // no dependentId
```

and `(student)/(more)/dependent-subscription.tsx` navigates to the student route without
passing `dependentId` in `params` either. `PixPaymentView` keys everything off that one prop:

```tsx
queryClient.invalidateQueries({ queryKey: dependentId ? ["payments", dependentId] : ["payments", "me"] })
queryClient.invalidateQueries({ queryKey: dependentId ? ["subscription", dependentId] : ["subscription", "me"] })
```

So on the student rail the confirmation invalidates `["payments","me"]` and
`["subscription","me"]` — never the dependent's keys. `staleTime` is 5 minutes
(`lib/query-client.ts`), the dependent screen is still mounted underneath the Pix screen so
`router.back()` does not remount it, and React Native has no window-focus refetch. The screen
therefore keeps serving the pre-payment cache: `Pendente`, with a Pix button that opens a
charge the API rejects with 409.

**Confirmed 2026-09-30**: pull-to-refresh on the dependent's subscription screen — its
`RefreshControl` invalidates `["payments", dependentId]` by hand — flipped it to `Pago`, with
no change in the database (subscriptions and the 9 payment rows are untouched). The data was
always right; only the cache the screen was serving was stale. **Root cause proven.**

**H2 is masking this.** `usePaidForMonth` also branches on `dependentId`, so on the student
rail it polls `/payments/me` instead of `/payments/dependent/:id`. That only detects the
dependent's payment because `/payments/me` wrongly returns dependent payments (H2) and the
hook matches on `subscriptionId`. **Fixing H2 first, alone, would leave the Pix screen
spinning forever on the student rail.** The route fix has to land with it, or before it.

---

## 3c. H3 — Reproduced: changing your own plan cancels your dependent's paid subscription

**Action**: the student switched their own plan from `Básico` to `Completo` at 16:25:19.

**Result** — one `POST /subscriptions/me/plan` with no `dependentId` cancelled *two* rows:

| id | plan | dependent | status | updated_at |
| --- | --- | --- | --- | --- |
| `df47e309` | Básico | — | **cancelled** | 16:25:19.927 |
| `ffc42693` | Kids | **Joao** | **cancelled** | 16:25:19.927 |
| `4f6619c2` | Completo | — | active | 16:25:19.880 |

Same transaction, same millisecond. Joao's subscription was paid 7 minutes earlier
(`c080dc05`, R$ 5,00, reference month 2026-09-01) and nobody asked for it to end.

**Root cause**: `replaceActiveSubscriptionForAcademy` branches on `dependentId`
(`subscription.repository.postgres.ts:210`). The dependent branch calls
`cancelActiveForDependent`, which is scoped by `dependent_id`. The own-plan branch calls
`cancelActiveForUserInAcademy` (`:151`), whose predicate is
`user_id = $1 AND status = 'active' AND plan_id IN (academy plans)` — **no
`dependent_id IS NULL`**. Every dependent of that guardian is swept up, because their
subscriptions carry the guardian's `user_id`.

**Consequences, in order of cost**

1. The dependent silently loses an active plan. `findByDependentIdWithPlan` only looks at
   `active`/`expired`, so the screen falls back to "Nenhum plano ativo".
2. **The month gets billable twice.** Re-subscribing the dependent creates a *new*
   subscription id, and the duplicate-month guard
   (`existsForSubscriptionReferenceMonth(subscriptionId, referenceMonth)`) is keyed by
   subscription — so September, already paid on `ffc42693`, is open again on the new row and
   the app will happily issue a second R$ 5,00 Pix charge for it.
3. The paid row `c080dc05` is left pointing at a cancelled subscription, so the dependent's
   payment history and the manager's view disagree about what the money bought.

---

## 4. Hypotheses, ranked

| # | Hypothesis | Where | Predicted symptom | Status |
| --- | --- | --- | --- | --- |
| H1 | `POST /dependents` 403s without an active membership | `academy-context.ts:44`, `dependent.routes.ts:29` | Guardian onboarding dead-ends; student path unaffected once T1 is done | ☐ |
| H2 | `GET /payments/me` does not exclude dependent payments | `payment.service.ts:668`, `payment.repository.postgres.ts:75` | Paying for the kid marks the student's own month as paid | ☐ |
| **H3** | Re-selecting your own plan cancels the dependents' subscriptions | `subscription.repository.postgres.ts:151` | Dependent loses an already-paid plan; the month becomes billable twice | **✅ reproduced** |
| H4 | Manual payment never records `dependent_id` | `payment.service.ts:147` | Dependent's payment history stays empty | ☐ |
| H5 | `POST /subscriptions/me/plan` never checks the dependent belongs to the caller | `subscription.routes.ts` (no `assertGuardianOwnership`) | Any student can subscribe someone else's dependent | ☐ |
| H6 | `openChargeContext` with no `subscriptionId` picks whichever subscription is first | `payment.service.ts:285` | A charge could be opened against the wrong one; mobile always sends the id, so low risk | ☐ |
| H8 | Plan list marks the student's plan as current while choosing for a dependent | `plans/index.tsx` | Wrong "plano atual" badge | ☐ |
| H9 | No back button on the plan list when the student has no plan of their own | `plans/index.tsx` | Student trapped on the screen | ☐ |
| **H10** | **Student Pix route drops `dependentId`, so the post-payment invalidation hits the wrong cache keys** | `(student)/(subscription)/pix-payment.tsx`, `(student)/(more)/dependent-subscription.tsx` | **Dependent's month stays "Pendente" after paying; retry answers 409** | **✅ reproduced** |

H5 and H6 are code-read findings, not part of the tap-through; they are verified with a
direct API call after the manual run.

---

## 5. Findings (filled in during the run)

| Step | Result | Notes |
| --- | --- | --- |
| T1 | n/a | membership was already `active` |
| T2 | ✅ pass | `df47e309`, Básico, `dependent_id` null, active |
| T3 | ✅ pass | Joao `541200f3` + initial belt `grey`/0, `is_current` |
| T4 | ✅ pass | list and detail correct |
| T5 | ✅ pass | `ffc42693`, Kids, `dependent_id` set; own subscription left active |
| T6 | not run | both months were already paid before the snapshot |
| T7 | ⚠️ **fails in the UI** | DB is correct (`c080dc05`, `dependent_id` set, R$ 5,00, 2026-09-01). The screen shows `Pendente` and a retry answers 409 — **H10**, proven |
| T8 | ❌ **fails** | `ffc42693` (Joao, paid) cancelled in the same transaction as the student's own switch — **H3**, proven |
| T9 | pending | manual confirmation path, **H4** |

---

## 6. Fixes applied (2026-09-30)

Branch `jeremiassnts3/tat-186-investigate-and-test-the-dependent-creation-flow-end-to-end`.
`apps/api`: 831 tests green (711 unit + 120 integration), typecheck and lint clean.

| # | Fix | Where |
| --- | --- | --- |
| H3 | `cancelActiveForUserInAcademy` now requires `dependent_id IS NULL`, so switching your own plan leaves every dependent alone | `subscription.repository.postgres.ts`, `.in-memory.ts` |
| H2 | `listForStudent` passes `withoutDependent`, a new filter on `findByAcademy`, so `GET /payments/me` returns only the caller's own months | `payment.service.ts`, `payment.repository.{ts,postgres.ts,in-memory.ts}` |
| H4 | `confirmManual` carries `dependentId` off the subscription, like the three webhook handlers already did | `payment.service.ts` |
| H5 | `POST /subscriptions/me/plan` calls `assertGuardianOwnership` before enrolling a dependent | `subscription.routes.ts` |
| H6 | With no `subscriptionId`, `openChargeContext` picks the caller's own subscription instead of whichever is newest | `payment.service.ts` |
| H10 | The student Pix route reads and forwards `dependentId`, and the dependent screen passes it | `(student)/(subscription)/pix-payment.tsx`, `(student)/(more)/dependent-subscription.tsx` |
| H8 | The plan list reads the dependent's subscription when choosing for a dependent, and refreshes the right cache key | `plans/index.tsx` |
| H9 | The back button shows whenever the screen was pushed for a dependent | `plans/index.tsx` |
| — | `describeApiError` replaces the blanket "Tente novamente": keeps the API's own sentence, translates the English guard messages, never shows a code, and falls back per status so 403, 400 and 5xx read differently | new `lib/api-error-message.ts`, wired into all three creation screens, both edit screens, the plan detail and the dependent checkout |
| — | The guardian's dependent edit screen read `dependent.belt` / `.stripes`, fields the API never sends, so the belt row rendered blank | `(guardian)/(dependents)/edit/[dependentId].tsx` |
| — | `guardian` added to the membership response role enums — it is a real membership role, and leaving it out made every `role === "guardian"` branch unreachable, including the manager's view of a guardian's dependents | `packages/validators/src/membership.schema.ts` |

New coverage: `apps/api/src/dependent.integration.test.ts` — 7 cases through the full
middleware chain, including the no-active-academy 403, the H3 regression, the H2 separation,
the H4 manual payment and the H5 ownership refusal. Each was verified to fail before its fix.

## 7. H1 — the ticket's leading hypothesis does not hold

The ticket assumed the guardian onboarding goes straight to `register-dependent` with no
academy step before it. Tracing the navigation says otherwise.

`app/(app)/index.tsx:29` routes `instructor`, `student` **and** `guardian` the same way:

```
no activeMembership          → /(app)/(joining)/search-academy
activeMembership = pending   → /(app)/(joining)/pending-approval
activeMembership = active    → /(app)/(guardian)/(home)
```

and `register-dependent` is reached from exactly one place — `(guardian)/(home)/index.tsx:45`,
the redirect fired when a guardian has no dependents yet. Reaching the guardian home already
requires an `active` membership, so a guardian with no membership never gets to the screen:
they are held at `search-academy`. `POST /dependents` cannot answer 403 there through normal
navigation.

**Decision: the guard stays as it is.** A dependent needs an `academy_id` — the column is
`NOT NULL` and the whole feature (check-in, plans, payments) is scoped to an academy — so the
guardian's membership is what says which academy the dependent belongs to. Dropping
`requireActiveAcademy` for guardians would leave nothing to derive it from.

What was actually broken on that screen was the error path: `onError` discarded the status
and the message, so whatever the original failure was, it read as "Tente novamente". That is
fixed, and any future failure now names itself.

One real defect was found in the redirect while tracing it: `(guardian)/(home)` treated a
**failed** `GET /dependents/me` as an empty list and bounced the guardian into onboarding.
A guardian who already has dependents would be sent back through onboarding on any network
blip. Now a failed request is left alone.

## 8. H11 — Reproduced: paying a dependent's Pix returned to the guardian's own subscription

**Symptom**: after a successful Pix payment for a dependent, the app came back to
"Minha assinatura" instead of the dependent it was paying for.

**Root cause**: `(student)` is a `Tabs` layout. The dependent's subscription screen lives in
the `(more)` tab; `pix-payment` lived in the `(subscription)` tab. Pushing across tabs means
`router.back()` unwinds inside the *destination* tab and lands on its index — the guardian's
own subscription. The guardian rail never showed this because it had its own copy of the
route inside `(dependents)`.

**Fix**: one shared `app/(app)/pix-payment.tsx` on the root stack, above every tab group,
replacing both per-tab shells. Pushed from there it returns to whatever screen opened it,
whichever tab or role that was. Three call sites updated; the two shells deleted.

**Same shape, not fixed here**: choosing a plan for a dependent also crosses tabs — both the
student's dependent screen and the guardian's push `(student)/(subscription)/plans`. The
outcome is right because `plans/[planId].tsx` ends with a `router.replace` to the correct
screen, so only the back button and the highlighted tab are wrong. Moving that route up would
also change what the student with no plan of their own sees: today the plan list is a gate
*inside* the tab, with the tab bar still on screen, and lifting it to the root stack takes the
tab bar away. That is a UX call, so it is left as is and recorded here.

### Still open
- **T9** could not be run against the live dev data: September is already paid on both
  subscriptions, so the API refuses another charge. It is covered by the integration test.
