# Tasks — Asaas payment split

Two shippable slices. **A** (TAT-179) must be merged before **B** (TAT-104) is useful:
without an approved wallet there is nothing to split into.

## Slice A — Manager receiving account (TAT-179)

| # | Task | Depends on | Covers |
| --- | --- | --- | --- |
| A1 | `ASAAS_*` + `PAYOUT_ACCOUNT_ENCRYPTION_KEY` in `packages/config/src/env.ts` and `.env.example` | — | infra |
| A2 | `apps/api/src/lib/crypto.ts` — AES-256-GCM encrypt/decrypt + unit tests | A1 | PAYOUT-02 |
| A3 | `apps/api/src/lib/asaas.ts` — typed client (root key and per-subaccount key), error mapping to `HttpError` | A1 | all |
| A4 | Schema: `payout_account_status` enum + `academy_payout_accounts` table + drizzle migration | — | PAYOUT-02 |
| A5 | `IPayoutAccountRepository` + Postgres and in-memory implementations | A4 | PAYOUT-02, PAYOUT-05 |
| A6 | `PayoutAccountService.create` — validate, `POST /v3/accounts` with webhooks, encrypt and persist, 409 on duplicate | A2,A3,A5 | PAYOUT-01, PAYOUT-02 |
| A7 | `PayoutAccountService` documents — list groups and expose the onboarding link. The upload half was **removed on 2026-09-29** (D6): documents are submitted in the manager's own Asaas account | A3,A5 | PAYOUT-03, PAYOUT-04 |
| A8 | `PayoutAccountService.refreshStatus` — `GET /v3/myAccount/status` and status mapping | A3,A5 | PAYOUT-05 |
| A9 | `PayoutAccountService.getFees` — normalize `GET /v3/myAccount/fees`, 12h cache, 503 on failure | A3 | PAYOUT-06 |
| A10 | `asaas-account-webhook.handler.ts` — `ACCOUNT_STATUS_*` → status, `approvedAt`, rejection reason; unhandled events reported | A5 | PAYOUT-05 |
| A11 | `payout-account.routes.ts` + zod schemas in `@tatame/validators` + router wiring | A6,A7,A8,A9 | PAYOUT-01..06 |
| A12 | `assertAcademyCanReceive` in `SubscriptionService.createPlan` and `selectPlan` → 403 `PAYOUT_ACCOUNT_REQUIRED` | A5 | PAYOUT-07 |
| A13 | [P] Mobile: `use-payout-account` hooks (get, create, documents, upload, status, fees) | A11 | PAYOUT-01..06 |
| A14 | [P] Mobile: onboarding form screen with loading / error / success states | A13 | PAYOUT-01 |
| A15 | [P] Mobile: account + documents screen (upload, external link, status badge, pull to refresh) | A13 | PAYOUT-03..05 |
| A16 | [P] Mobile: "Conta de recebimento" card on the Financeiro dashboard | A13 | PAYOUT-08, PAYOUT-09 |
| A17 | Mobile: fee and net-value disclosure on plan create and edit, submit disabled without an approved account | A13 | PAYOUT-06, PAYOUT-07 |
| A18 | Unit tests: service create / documents / status / fees / gating, in-memory repo | A6-A9,A12 | acceptance |
| A19 | Integration test: onboarding round trip and the account-status webhook | A10,A11 | acceptance |
| A20 | Gate: typecheck + lint + unit + integration across the workspace | A1-A19 | acceptance |

## Slice B — Student payments with split (TAT-104)

| # | Task | Depends on | Covers |
| --- | --- | --- | --- |
| B1 | Schema: `users.asaas_customer_id`, `payments.asaas_payment_id` (unique), `pending_asaas_payments` + migration | A4 | SPLIT-01, SPLIT-04 |
| B2 | Repository methods for the new columns and the pending table (Postgres + in-memory) | B1 | SPLIT-02, SPLIT-04 |
| B3 | `AsaasCustomerService` — find-or-create the Asaas customer for a student, persist the id | A3,B2 | SPLIT-01 |
| B4 | `PaymentService.createPixCharge` — guard, `POST /v3/payments` with `split[percentualValue:100]`, `GET /pixQrCode`, reuse an open charge | A3,A5,B3 | SPLIT-02 |
| B5 | `PaymentService.createCheckout` on Asaas — `POST /v3/checkouts` with `splits` and callbacks, same `{ checkoutUrl }` contract. **B3 turned out not to be a dependency** — no customer can be attached to a checkout (D8) | A3,A5 | SPLIT-03 |
| B6 | `asaas-payment.handler.ts` — token check, `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` → payment row, idempotent, notification + e-mail | B2 | SPLIT-04 |
| B7 | Refund and chargeback events → `emitEvent` (+ telemetry catalog entries) | B6 | SPLIT-05 |
| B8 | Webhook route `POST /webhooks/asaas` dispatching payment and account events | A10,B6 | SPLIT-04, PAYOUT-05 |
| B9 | Retire the student-facing AbacatePay and Stripe Checkout entry points; keep both webhook handlers for in-flight charges | B4,B5 | SPLIT-06 |
| B10 | [P] Mobile: point the Pix and card screens at the new endpoints, render `encodedImage` / `payload` | B4,B5 | SPLIT-02, SPLIT-03 |
| B11 | Unit tests: split payload, duplicate-month guard, gate, webhook idempotency | B4,B5,B6 | acceptance |
| B12 | Integration test: Pix charge → webhook → payment row, replayed twice | B6,B8 | acceptance |
| B13 | Gate: typecheck + lint + unit + integration across the workspace | B1-B12 | acceptance |

**Gate command:**
`pnpm --filter @tatame/db build && pnpm --filter @tatame/validators build && pnpm --filter @tatame/api typecheck && pnpm --filter @tatame/api lint && pnpm --filter @tatame/api test:unit && pnpm --filter @tatame/api test:integration`

## Blockers before starting

1. ~~The Tatame root Asaas account must be a **CNPJ**~~ — **resolved 2026-09-28.**
   `EFA FIREFLY LABS LTDA`, `personType: JURIDICA`, `general: APPROVED`.
2. ~~Sandbox credentials provisioned~~ — **resolved 2026-09-28.** `ASAAS_API_KEY`
   and `ASAAS_BASE_URL` in hand; `ASAAS_WEBHOOK_TOKEN` still to be generated.
3. Confirm the production rollout fits the Asaas evaluation window: up to 10 subaccounts
   and R$ 2.000 per charge during the first 60 days. **Still open.**
4. ~~**New — a Pix key on the root account.**~~ **Resolved 2026-09-29.** The root
   account now holds one `EVP` key, `ACTIVE`. The failure it caused —
   `GET /payments/{id}/pixQrCode` answering 400 `invalid_action` with "Você não
   possui uma chave Pix cadastrada para recebimentos" — is therefore no longer
   reproducible live, so B4 pinned the recorded payload as a regression test
   instead. It still matters in production: Asaas provisions the key
   asynchronously, so a freshly created account fails for its first minutes. The
   key belongs to the **root** account only — the charge lives there and the split
   moves the money internally, so no academy needs one.

## Sandbox validation — 2026-09-28

The first run against the real Asaas sandbox, before any of Slice B existed. Every
call below was made by hand against `https://api-sandbox.asaas.com`, not a fake.

**Proved:**

| Step | Result |
| --- | --- |
| Root account is CNPJ and approved | `JURIDICA`, `general: APPROVED` |
| `POST /v3/accounts` creates a subaccount | returns `walletId` and `apiKey` |
| The api key arrives at both documented places | top level **and** `accessToken.apiKey` — the defensive read in `lib/asaas.ts` was right |
| **`split: [{ walletId, percentualValue: 100 }]` is accepted** | `value 150,00 → netValue 149,01 → split totalValue 149,01` |
| Pix QR code generation | beneficiary is the **root** account, as the design assumes |

The split arithmetic matches D1 and D3 to the cent: the fee is taken before the
split, the academy receives the net, and the platform nets exactly zero.

**Found, and not previously written down anywhere:**

1. **The root account needs a Pix key** before any charge can show a QR. See
   blocker 4.
2. **Manual settlement cancels the split.** See D5 in `context.md`; the decision
   is that manual confirmation cancels the open Asaas charge.
3. **The fee disclosure was wrong** — Asaas reports a negotiated rate next to the
   standard one and charges the negotiated one. `payout-account.fees.ts` read only
   the standard rate, so the plan screen promised R$ 148,01 where the sandbox
   credited R$ 149,01. Fixed, with the sandbox payload pinned as a regression test.
4. **Sandbox approves subaccounts instantly** (`general: APPROVED` on creation,
   the only document group already `APPROVED`). The pending-document path and the
   `ACCOUNT_STATUS_*` webhook therefore cannot be exercised naturally here — they
   have to be driven by replaying a payload by hand, and only production will
   exercise them for real.
5. **`GET /v3/payments/{id}/splits` answers 404.** The split state is returned
   inline on the payment object instead. Relevant to B7.

6. **A document group omits `documents` entirely** when nothing has been uploaded
   to it — the field is absent, not an empty list — and carries a `responsible`
   object our type never declared. The hand-written `AsaasDocumentGroup` marked
   `documents` required, so the API served the key as `undefined` and the mobile
   card crashed on `group.documents.length` the moment a manager finished
   onboarding. Every fixture in the suite carried `documents: []`: the fakes were
   more complete than Asaas. Normalised at the boundary, real payload pinned.
7. **Sandbox approves and fires the webhook in seconds.** Across five accounts
   created from the app, `approved_at` landed between 0.9s and 7.9s after
   `created_at`. The consequence for the UI: a screen that reads the account from
   cache shows "Em criação" over an account that is already active.

Sandbox rates on the day: Pix R$ 0,99 fixed with 100 free monthly credits; card
1,99% + R$ 0,49, settling in 32 days.

## Webhook validation — 2026-09-29

**The `ACCOUNT_STATUS_*` webhook is confirmed against the real Asaas.** It was listed
above as impossible to exercise in the sandbox; the row created by the app on
2026-09-28 proves otherwise. Reconstructed from `academy_payout_accounts`
(`external_account_id 1d4ff263-0a11-4b70-94db-1f5d9f9dffbe`):

| Time | What happened |
| --- | --- |
| 23:02:59.882 | `create` wrote the row as `pending` |
| 23:03:02.138 | status became `approved`, `approved_at` set — **+2.2s** |
| 23:03:03.139 | `updated_at` moved without touching status — `GET /documents` mirroring `onboardingUrl` |

Only `applyAsaasStatus` writes `status`, and it has exactly two callers: the webhook
handler and `refreshStatus`. `refreshStatus` is reachable only through
`GET /payout-account/status`, which on mobile fires only from `RefreshControl`
(`documents.tsx` `handleRefresh`) — there is no mount effect, no focus effect and no
cron. A pull to refresh 2.2 seconds after submitting the form, while the pre-fix app
was bouncing the manager back to an empty form, is not a thing that happened.
`listDocuments` also writes to the row but never to `status`, which is what the third
timestamp is.

So: Asaas delivered the account-status event to the ngrok url, the token check passed,
and the handler applied it. **A10 and the webhook half of A19 are validated in
practice**, not just by tests. The second write also shows more than one delivery
arrived and that the "first approval only" guard on `approvedAt` held.

What is still unvalidated is narrower than it was: the onboarding round trip **through
the app** — specifically that the fix in `8047fb6` keeps the manager on the documents
screen. Re-running it needs the existing row removed first, since `Fighter's BJJ` is
the only academy in the database and `create` answers 409 for an academy that already
has an account.

## Operating notes

Facts that cost a session to discover and are not visible from the code.

### Running it locally

Postgres **and** Redis are the Coolify ones, so `docker compose` is not needed —
`DATABASE_URL` and `REDIS_URL` both point at `31.97.64.10`. The API listens on
`API_PORT=3001`.

Reading fees only needs `ASAAS_API_KEY` and `ASAAS_BASE_URL`. **Creating** a payout
account also needs `PAYOUT_ACCOUNT_ENCRYPTION_KEY` (64 hex, self-generated — rotating
it makes every stored subaccount key unreadable), `ASAAS_WEBHOOK_TOKEN`, and
`API_PUBLIC_URL`, which creation refuses to run without on purpose: it is the address
the subaccount's webhooks are registered at.

`API_PUBLIC_URL` is an ngrok reserved domain, so it survives restarts:

```bash
ngrok http --url=<the domain in API_PUBLIC_URL> 3001
```

To tell a live tunnel from a dead one, ask for a route that exists:
`curl -o /dev/null -w '%{http_code}' https://<domain>/v1/payout-account` answers **401**
when the API is behind it and **404** when ngrok has nobody to forward to.

### Migrations on the Coolify database — settled by B1

Drizzle decides what is missing from the `created_at` of the last registered migration,
**not from the hash**. `0019_tutorials` was hand-written and its table created outside
drizzle, so `migrate` broke on "relation tutorials already exists" and rolled the whole
run back — it runs in a single transaction. `0020` is applied now.

**Three rows in `drizzle.__drizzle_migrations` still carry the migration tag where the
hash belongs** (one of them literally `0007_overjoyed_k...`). Harmless while the hash is
not compared, but it is hand-edited bookkeeping, and B1 adds the next migration on top
of it. Look before running.

**Looked, on 2026-09-29, and it is worse than the note said — and still harmless.** The
table holds 17 rows against 21 journal entries: besides the three tagged rows, **0008,
0009, 0014 and 0015 have no row at all**, their tables having been created outside
drizzle the same way. None of it matters, because only the newest `created_at` is read.
That was 0020's `1789220128881`; `0021_yummy_gambit` is `1790687505908`, so it applied
alone and cleanly, adding row 18 with a real hash. `pending_asaas_payments`,
`payments.asaas_payment_id` and `users.asaas_customer_id` are live on the Coolify
database.

The gap is only ever a problem for a migration that would *recreate* something already
there. 0021 is purely additive, which is why it was safe to run without repairing the
bookkeeping first.

### Objects already in the Asaas sandbox

Created by hand on 2026-09-28; the CPF/CNPJ behind them are generated and collide with
nothing real. Useful as fixtures rather than recreating them — the evaluation window
allows only 10 subaccounts and **7 are used**.

| What | Id |
| --- | --- |
| Subaccount CNPJ "Academia Tatame Smoke 375360" | `b1e0272a-3201-41bd-9454-479528c7e6d2` |
| Subaccount CPF "Academia CPF Smoke 926184" | `e714a46e-a1ec-4c55-84e8-8af0baefd14e` |
| Customer (fictional student) | `cus_000009262465` |
| Pix charge, pending, with a valid QR code | `pay_v2s11oiq3q4gcirb` |
| Charge settled by hand, split `CANCELLED` | `pay_to6xc4jjssi0847w` |
| Customer created with **no document**, then patched with one (D7 probe) | `cus_000009273325` |
| Pix charge that only succeeded after that patch | `pay_flhul7uhgq4drw4d` |
| Charge deleted by hand, still serving a valid QR (B4 probe) | `pay_hzcb83456el2ymjo` |
| Checkout paid with a sandbox card, split credited (B5 probe) | `28934c1d-2ded-4ee0-a7bb-8f305b28681a` |
| The payment that checkout produced, carrying `checkoutSession` | `pay_cgdpb527fk94b2r0` |
| Customer Asaas minted from the checkout page, not by us | `cus_000009273872` |
| `walletId` of "Academia Tatame Smoke 375360" — the **account** id above is not it | `742f6df1-c4ee-4645-87a6-523b50345be5` |

The last one is the evidence behind D5: `receiveInCash` leaves the split
`CANCELLED` with `cancellationReason: PAYMENT_RECEIVED_IN_CASH` and the subaccount
balance at zero.

## Charge-lifecycle validation — 2026-09-29

Probed by hand before B4 was written, against `https://api-sandbox.asaas.com`.

| Call | Result |
| --- | --- |
| `GET /v3/payments/{id}/pixQrCode` | `{success, encodedImage, payload, expirationDate}` |
| `DELETE /v3/payments/{id}` | 200 `{deleted: true, id}` |
| the same `DELETE`, repeated | 200 again — **idempotent** |
| `DELETE` on an id that never existed | 404 |
| `GET /v3/payments/{id}` after deleting | 200, `status: PENDING`, **`deleted: true`** |
| **`GET .../pixQrCode` on the deleted charge** | **200, with a perfectly valid-looking QR** |
| `GET /v3/pix/addressKeys` on the root account | one `EVP` key, `ACTIVE` |

The sixth row is the one that shaped B4. A cancelled charge is indistinguishable
from a live one through the QR endpoint, so "reuse an open charge" cannot trust a
stored id — it reads the charge back and checks `deleted`. And it is why D5 deletes
the Asaas charge and the `pending_asaas_payments` row as one unit: a row outliving
its charge is a dead QR code in a student's hands.

The idempotent `DELETE` is what makes D5 safe to retry, and the 404 means a charge
already gone is the outcome the caller wanted — `deletePayment` treats it as success.

## Checkout validation — 2026-09-29

Probed by hand before B5 was written, against `https://api-sandbox.asaas.com`,
including paying one with a sandbox card in a browser.

| Call | Result |
| --- | --- |
| `POST /v3/checkouts` with nothing | 400, naming `billingTypes` — then `chargeTypes`, `items`, `callback.successUrl`, `callback.cancelUrl` one at a time |
| `splits` (plural) vs `split` (singular) | **both accepted**; the response always echoes `split` |
| `percentualValue` — the `/v3/payments` spelling | **400** — "Um dos campos fixedValue, percentageValue, totalFixedValue deve ser informado" |
| `percentageValue: 100` | 200, stored as `percentageValue: 100.0000` |
| an arbitrary ngrok callback url | accepted — **nothing has to be pre-registered** |
| `GET /v3/checkouts/{id}`, and the list | **404 both** — a checkout cannot be read back |
| `customer: <an existing customer>` | 400 — `address`, `addressNumber`, `postalCode`, `province`, `city` required on it |
| `customerData: {name, cpfCnpj, email}` | 400 — the same five plus `phoneNumber` |
| **the payment produced by paying one** | `externalReference: null`, **`checkoutSession: <the checkout id>`** |
| the split on that payment | `percentualValue 100`, `totalValue 146,53` = `netValue`, `AWAITING_CREDIT`, `creditDate` 34 days out |
| `POST /v3/checkouts/{id}/cancel` | 200, `status: CANCELED` |
| the same cancel, repeated | **400 `invalid_action`** — "O Checkout não está ativo para ser cancelado" |
| cancel on a paid or expired checkout | the same 400 |
| cancel on an id that never existed | 404 |

Four of these shaped B5:

1. **`percentageValue`, not `percentualValue`.** The two endpoints disagree on
   the spelling of the same idea, so they need separate types and a
   copy-paste between them fails at Asaas rather than at compile time.
2. **There is no payment id until the student pays**, the checkout cannot be
   read back, and the payment does **not** inherit the checkout's
   `externalReference`. `payment.checkoutSession` is the only way back, so the
   pending row is keyed by the session id — and `pending_asaas_payments.kind`
   exists to say so. Without it `confirmManual` would call
   `DELETE /v3/payments/{checkoutId}`, get a 404, read it as success, and
   leave a payable link behind: D5's hole, re-opened on the card rail.
3. **Cancel is not idempotent**, unlike `DELETE /v3/payments`. `cancelCheckout`
   treats 404 *and* 400 `invalid_action` as success, because both mean the
   session is no longer payable — which is what the caller asked for. Any
   other 400 still raises: swallowing it would report a cancellation that
   never happened.
4. **No customer can be attached** — see **D8**. The card rail never asks the
   student for a document; the Asaas page does.

The assembled payload the service builds was fired at the live sandbox and
accepted, split stored at 100%.

**Found while probing, and it blocks B6/B8:** `GET /v3/webhooks` on the **root
account answers `totalCount: 0`**. A6 registers `PAYMENT_*` and
`ACCOUNT_STATUS_*` webhooks on each *subaccount*, but every charge lives on the
root account. Whether a subaccount receives `PAYMENT_*` for a split it is
merely the recipient of is unverified, and if it does not, no payment webhook
will ever arrive. Settle this before writing B8 — a webhook can be registered
through `POST /v3/webhooks` with the root key.

Also confirmed while probing: `CHECKOUT_PAID`, `CHECKOUT_CANCELED` and
`CHECKOUT_EXPIRED` are valid webhook event names, alongside `PAYMENT_CREATED`,
`PAYMENT_DELETED` and `PAYMENT_CHARGEBACK_REQUESTED`. B6 does not need the
`CHECKOUT_*` ones — the payment carries `checkoutSession` — but B8 has to
decide whether an unregistered event type is a drop or a shrug.


## Status

**Slice A (TAT-179) — implemented, partially validated.** A1-A20 merged on `main`,
one commit per task, plus the fee correction above on
`fix/tat-179-asaas-sandbox-findings`. The split maths and subaccount creation are
confirmed against the sandbox, the account-status webhook is confirmed too (see the
webhook validation section above), and on 2026-09-29 the onboarding round trip **was
finally driven through the app end to end**: form → account created → documents screen,
which stays, lists the group Asaas returned, and settles the status from Asaas on its
own. What is still untested is everything only production exercises — a document group
that actually needs a document, a rejection, and a suspension.
**Slice B (TAT-104) — B1 to B5 done.** Both student rails now open a split
charge: `POST /v1/payments/pix` and `POST /v1/payments/checkout`. Nothing
records a payment yet — that is B6 and B8, and until they land a student can
pay in the sandbox and no `payments` row appears.

**Migration `0022_awesome_masque` is not yet applied to the Coolify database.**
`0021` is. 0022 is purely additive (a `pending_asaas_kind` enum and a
defaulted column) and its `when` is newer than 0021's, so it applies alone and
cleanly despite the `__drizzle_migrations` bookkeeping gap described below.

| Task | Status | Notes |
| --- | --- | --- |
| A1 | Done | `ASAAS_*` + `PAYOUT_ACCOUNT_ENCRYPTION_KEY`, all optional |
| A2 | Done | `lib/crypto.ts`, 12 unit tests |
| A3 | Done | `lib/asaas.ts`, 25 unit tests |
| A4 | Done | migration `0020_gray_klaw` |
| A5 | Done | interface + postgres + in-memory |
| A6 | Done | 15 unit tests |
| A7 | Done | 9 unit tests; the 4 upload ones went with D6 |
| A8 | Done | 10 mapper + 8 refresh unit tests |
| A9 | Done | 10 unit tests |
| A10 | Done | 10 unit tests |
| A11 | Done | 6 manager routes + `POST /webhooks/asaas` |
| A12 | Done | 11 unit tests |
| A13 | Done | `use-payout-account.ts` hooks |
| A14 | Done | onboarding form, CEP lookup, prefill without write-back |
| A15 | Done | documents screen, upload vs. onboarding link |
| A16 | Done | "Conta de recebimento" card on Financeiro |
| A17 | Done | fee and net value on plan create and edit |
| A18 | Done | unit coverage written per task |
| A19 | Done | 8 integration tests against a fake Asaas |
| A20 | Done | typecheck + lint + 559 unit + 61 integration green; mobile tsc adds 0 errors |

### Slice B

| Task | Status | Notes |
| --- | --- | --- |
| B1 | Done | migration `0021_yummy_gambit`, applied to the Coolify database |
| B2 | Done | 16 integration tests; the contract runs against Postgres **and** in-memory |
| B3 | Done | `asaas-customer.service.ts`, 9 unit tests; client gained `createCustomer` / `findCustomerByExternalReference`, 6 more |
| B4 | Done | `POST /v1/payments/pix`, 19 unit tests; implements D5; client gained `createPayment` / `getPixQrCode` / `findPayment` / `deletePayment` |
| B5 | Done | `POST /v1/payments/checkout` is Asaas now; migration `0022_awesome_masque` adds `pending_asaas_payments.kind`; 19 unit + 9 client tests, 1 more repository contract test; client gained `createCheckout` / `cancelCheckout` |
| B6-B13 | Pending | |

Two things B2 decided that the task list did not spell out:

1. **The repository contract is tested against both implementations.** The in-memory
   repository is what every service unit test measures and Postgres is what production
   runs; where they disagree the unit tests measure a fiction. `createPendingAsaas`
   ignoring a repeat id is the concrete case — `onConflictDoNothing` in Postgres, and
   in memory it had to be written to match. The unique constraint on
   `payments.asaas_payment_id` is the one behaviour only Postgres can answer, so that
   test is Postgres-only.
2. **`findPendingAsaasBySubscriptionMonth` exists with no caller.** B4 needs it to hand
   a student back the charge they already have open for the month instead of opening a
   second one, and it is a query over the pending table, which is B2's half of the work.

And one the sandbox forced open during B3:

3. **The student's CPF had no source.** Asaas creates a customer from a name alone and
   then refuses to charge it. The platform stores no document for anyone, so B3 could
   not be written until that was decided — see **D7**: typed on the payment screen,
   sent straight to Asaas, never stored, asked exactly once per student. It adds an
   optional `cpfCnpj` to `POST /payments/pix` (B4) and a field plus a `CPF_REQUIRED`
   error to the mobile screen (B10).

And three from B4:

4. **The payout gate on a charge is not the same gate as on enrolment.**
   `SubscriptionService` gates enrolment behind `PAYOUT_ACCOUNT_REQUIRED`, which
   defaults off. `createPixCharge` does not read the flag at all: the payout
   account is where the `walletId` comes from, so without one there is nothing to
   split into and the charge would pay the platform instead of the academy. One
   lookup is both the gate and the wallet source.
5. **A failed QR must not lose the charge.** The pending row is written *before*
   the QR is fetched, because the QR is exactly the call that fails while the root
   account's Pix key is being provisioned. A charge with no pending row is one the
   retry cannot find, so it would open a second charge for the same month.
6a. **From B5 — one row shape, two kinds of handle.** `pending_asaas_payments`
   holds a payment id for Pix and a checkout session id for card, told apart by
   `kind`. Both cancel endpoints answer 404 for the other kind's id and both
   wrappers read 404 as success, so anything that guesses reports success while
   leaving a payable charge alive. Every path that cancels — `confirmManual`,
   and both charge paths meeting on a month that already has one open — goes
   through `cancelAsaasHandle`, and the mutation that made it ignore `kind` is
   caught by three tests.

6b. **From B5 — the two rails disagree about a charge that was already paid.**
   `DELETE /v3/payments/{id}` on a paid charge answers 400 `invalid_action` ("Só é
   possível remover cobranças pendentes ou vencidas"), and `deletePayment` swallows
   only 404 — so a manual confirmation for a month already paid by Pix is blocked.
   `POST /v3/checkouts/{id}/cancel` answers the *same* 400 for a paid session as for
   an already-cancelled or expired one, so `cancelCheckout` must swallow it, and the
   card rail proceeds instead. Once B6 lands that month carries two payment rows. It
   is the same root cause as finding 6 below, and the same fix closes both.

6. **`confirmManual` has no duplicate-month guard, and still does not.** Noted, not
   fixed — it is outside B4's line item. The spec's edge case ("WHEN a student pays
   exactly as the manager confirms the same month manually THEN the reference-month
   uniqueness SHALL keep a single payment row") assumes a uniqueness constraint
   that does not exist on `payments (subscription_id, reference_month)`. D5 closes
   the Asaas half of that race; the manual-versus-manual half is still open.

### Carried forward

1. ~~**No Asaas credentials yet.**~~ **Superseded 2026-09-28** by the sandbox
   validation above. What is still unverified is narrower: the onboarding round
   trip driven from the app, and both webhooks actually delivered by Asaas.
2. **`POST /webhooks/asaas` accepts `PAYMENT_*` and ignores it** so Asaas does
   not retry for days. B8 replaces that branch with the real dispatch.
3. ~~`DOCUMENT_REQUIRES_ONBOARDING_URL` carries the url in `HttpError.details`~~
   — **moot since D6.** The 409 lived on the upload route, which is gone. The
   screen reads the url from the document list, as it already did.
4. ~~No PDF upload~~ — **moot since D6, and the reason it was taken.** The
   uploader could only attach images, so a CNPJ academy asked for a contrato
   social or certificado MEI could never finish in the app; `expo-document-picker`
   would have meant a new native build to duplicate a flow Asaas already runs in
   its own interface. The app now sends the manager there instead, so the
   dependency is **not** on the path to a real academy onboarding. Revisit only if
   Asaas turns out to leave a document group uncovered.
5. **`ApiError` gained `detail`.** `error-handler.ts` overwrites the `error`
   field with the code when a failure carries one, and the mobile client read
   only that field, so the Asaas sentence never reached a screen. `message`
   still holds the code because `PLAN_LIMIT_*` and `PAYOUT_ACCOUNT_REQUIRED`
   are matched on it; the prose now travels alongside in `detail`.
6. **`plans/create.tsx` lost a hardcoded fee panel** claiming "3,99% + R$0,39"
   for card and "R$0,80" for Pix. Not Asaas's numbers, and it was gated behind
   a paid-plan check so most managers never saw it.
7. **Drizzle snapshot drift.** `0019_tutorials` was hand-written with no meta
   snapshot, so generation re-emitted `CREATE TABLE tutorials` into 0020; it was
   stripped and the 0020 snapshot now records the table. The chain is consistent
   from here.

