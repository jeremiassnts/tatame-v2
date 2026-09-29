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
   inline on the payment object instead. B7 confirmed this is enough: a refund
   delivery arrives with the split already `CANCELLED`, so the call was never
   needed.

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
| Card payment refunded by hand, split `CANCELLED` (B7 probe) | `pay_aalcgxwj24pkd6m5` |
| A second one, refunded to confirm B7 live against the running API | `pay_224vjtax7yvvmsfe` |
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

**Found while probing, and it turned out to block B6/B8 — now settled.** See
**Webhook delivery — 2026-09-29** below: a subaccount is *not* notified of a
payment it merely receives a split from, so the root account needs a webhook of
its own.

Also confirmed while probing: `CHECKOUT_PAID`, `CHECKOUT_CANCELED` and
`CHECKOUT_EXPIRED` are valid webhook event names, alongside `PAYMENT_CREATED`,
`PAYMENT_DELETED` and `PAYMENT_CHARGEBACK_REQUESTED`. B6 does not need the
`CHECKOUT_*` ones — the payment carries `checkoutSession` — but B8 has to
decide whether an unregistered event type is a drop or a shrug.


## Webhook delivery — 2026-09-29

The question B6 and B8 could not be written without: **who is told when a split
charge is paid?** Settled by experiment, against the real sandbox, with the API
behind its ngrok tunnel and ngrok's request inspector as the witness.

| Step | Result |
| --- | --- |
| Baseline: deliveries at the tunnel | 4, all `ACCOUNT_STATUS_*` from the account created that morning — the tunnel works |
| `GET /v3/webhooks` on the root account | `totalCount: 0` — nothing registered |
| Pay a checkout split 100% into the academy's real wallet | payment `CONFIRMED`, split `AWAITING_CREDIT` … and **no delivery in 60s** |
| Register `POST /v3/webhooks` on the root account | 200 |
| Pay another, same wallet | **delivered within a second** |

**A subaccount is not notified of a payment it is merely the split recipient
of.** A6 registers `PAYMENT_*` and `ACCOUNT_STATUS_*` on each *subaccount*, but
every charge lives on the root account — so without a webhook there, no student
payment would ever have been recorded, and B6 would have passed its tests while
recording nothing in production.

The real delivery, which every fixture in the suite is now shaped after:

```json
{ "id": "evt_…", "event": "PAYMENT_CONFIRMED", "dateCreated": "2026-09-29 12:06:31",
  "account": { "id": "<the root account>", "ownerId": null },
  "payment": { "id": "pay_…", "status": "CONFIRMED", "value": 150.0, "netValue": 146.53,
               "billingType": "CREDIT_CARD", "checkoutSession": "<the checkout id>",
               "externalReference": null, "confirmedDate": "2026-09-29",
               "paymentDate": null, "split": [ { "percentualValue": 100.0,
               "totalValue": 146.53, "status": "AWAITING_CREDIT" } ] } }
```

Three things it settled:

1. **`checkoutSession` is on the webhook.** B6 finds a card payment without
   reading it back from Asaas.
2. **`externalReference` is null** on a checkout's payment, confirming it is
   not inherited. The session id really is the only way back.
3. The header is `Asaas-Access-Token` and the agent is `Asaas_Hmlg/3.0`.

These six event names are valid on `POST /v3/webhooks` and were registered:
`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_REFUNDED`,
`PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE`,
`PAYMENT_AWAITING_CHARGEBACK_REVERSAL`. The last four are B7's, and B7 has
landed: they emit `payment.reversed`. Nothing the root webhook is registered
for reaches `UNKNOWN_EVENT_TYPE` any more, which is the slice's success
criterion.
`CHECKOUT_PAID`, `CHECKOUT_CANCELED` and `CHECKOUT_EXPIRED` are also valid and
deliberately **not** registered — the payment already points back at its
session, so they would be a second delivery saying the same thing.

### Telling one environment's deliveries from another's

The webhook token is **not** what separates environments: copying config
between them copies the token with it, which is exactly the mistake that causes
a cross-environment delivery in the first place.

What separates them is the account id on the delivery. `GET /v3/myAccount/status`
on the root key returns the same id a `PAYMENT_*` event carries in
`account.id`, so the API can learn which account is its own with no
configuration and refuse the rest — reported as `FOREIGN_ACCOUNT`.

The guard **fails open**: an undetermined id accepts everything. Refusing the
money stream on a lookup failure loses real payments to prevent a
misconfiguration that may not exist.

Worth knowing what the damage actually was before the guard: a foreign payment
has no pending row here, so **nothing was ever written**. What it produced was
`NO_PENDING_CHARGE` — "money in, nothing recorded", the loudest signal in the
handler — for an event that was never ours.

`ACCOUNT_STATUS_*` needed nothing: its `account.id` is the *subaccount's*, and
the handler already refuses an account with no row here.

Also checked, and it is why no academy can forge a delivery: **the auth token
is never readable back.** `GET /v3/webhooks` and `GET /v3/webhooks/{id}` both
answer `hasAuthToken: true` with no `authToken` field, on the list and on the
single read.

### Two webhook tokens

| Variable | Registered on | Rotating it |
| --- | --- | --- |
| `ASAAS_WEBHOOK_TOKEN` | every academy's subaccount, by `buildWebhooks` at creation | `PUT /v3/webhooks/{id}` per academy, each needing its stored key decrypted — **no code does this** |
| `ASAAS_PAYMENT_WEBHOOK_TOKEN` | the root account, by hand | one `PUT`; falls back to the above when unset |

The route picks the expected token from the event prefix: `ACCOUNT_STATUS_*`
must carry the account token, `PAYMENT_*` the payment one. An event belonging
to neither is accepted on either, since it is going to be reported as
unhandled anyway and guessing which registration sent it would turn a report
into a 401.

The failure mode to respect is that a wrong value **401s in silence** and Asaas
eventually interrupts the webhook, so both directions are pinned by tests and
mutation-checked, and the fallback has a test of its own — an environment that
never split them must keep working.

**`PUT /v3/webhooks/{id}` with only `authToken` rotates a token in place** and
preserves url, events, `sendType` and `enabled`. Verified against the sandbox
on 2026-09-29. This is also the correction to an earlier claim here that the
account-status token could not be rotated at all: it can, it just costs a pass
over every academy.

**Use a different value per environment.** The `FOREIGN_ACCOUNT` guard below
catches a crossed delivery even when the tokens match, but there is no reason
to lean on it.

### What has to exist in the Asaas account

Per environment, once. Not created by the app: it is platform configuration,
and doing it at startup would race across instances and duplicate.

| What | Where | Why |
| --- | --- | --- |
| A webhook on the **root** account at `{API_PUBLIC_URL}/v1/webhooks/asaas`, `apiVersion: 3`, `authToken: ASAAS_WEBHOOK_TOKEN`, the six `PAYMENT_*` events above | root | Nothing records a student payment without it |
| A Pix key on the **root** account | root | `GET /payments/{id}/pixQrCode` fails until it exists; Asaas provisions it asynchronously |
| Nothing per academy | subaccount | A6 registers the subaccount's `ACCOUNT_STATUS_*` webhook at creation |

`sendType: SEQUENTIALLY` is what the subaccount registrations already use, and
it matters here: it is what keeps `PAYMENT_CONFIRMED` from overtaking
`PAYMENT_RECEIVED` for the same payment. The handler survives either order
anyway — the unique constraint is what settles it — but out-of-order delivery
would make the logs harder to read for no benefit.


## Reversal validation — 2026-09-29 (B7)

Probed the same way: refund a real card charge in the sandbox and read what
arrives, rather than trusting the docs.

`POST /v3/payments/pay_aalcgxwj24pkd6m5/refund` on a `CONFIRMED` card payment
split 100% into an academy wallet:

| What arrived | Result |
| --- | --- |
| Deliveries | **exactly one** `PAYMENT_REFUNDED`, ~2s later. No `PAYMENT_DELETED`, no second event |
| Payload | the **whole payment object** — much larger than the `PAYMENT_CONFIRMED` the fixtures were shaped after |
| `payment.status` | `REFUNDED` |
| `split[0].status` | `CANCELLED`, `cancellationReason: PAYMENT_REFUNDED` |
| `refunds[0]` | `{ status: DONE, value: 150.0, refundedSplits: null }` |

`refundedSplits` is null because the split was still `AWAITING_CREDIT` — the
money had not reached the academy yet, so there was nothing to claw back. A
refund after the credit date (2026-11-02 on these charges) is the case nobody
has seen, and it is the one where the academy actually loses money it already
had. The evaluation window will close before that date.

**Three things that could not be reproduced, and why they matter:**

1. **Partial refunds are refused here.** `POST …/refund {"value": 50}` on a
   R$ 150 charge answers 400 `invalid_action`, "Valor da cobrança insuficiente
   para o estorno solicitado" — which is wrong on its face and presumably means
   "not while the split is uncredited". So `PAYMENT_PARTIALLY_REFUNDED` has
   never been seen. It is in `REVERSAL_EVENTS` anyway, and **not** registered.
2. **A chargeback cannot be provoked by API at all.** `GET /v3/chargebacks`
   exists and answers an empty list; `POST /v3/payments/{id}/simulateChargeback`,
   `/chargeback` and `/v3/sandbox/chargeback` are all 404. The
   `payment.chargeback` object (`{ status, reason }`) is therefore shaped after
   the documentation, not a capture, and the handler reads both fields
   defensively. **The first real chargeback will be in production.**
3. **A refund that arrives for a payment we never recorded** is a case the
   sandbox cannot stage either. It emits `payment.reversed` with
   `recorded: false`, which is worth looking for: it means the settlement was
   dropped too and a `NO_PENDING_CHARGE` should be further back in the log.

**What B7 decided.** One event, `payment.reversed`, `outcome: rejected` so it
logs at warn. No enumerated reason — the Asaas event name is `app.type`, and
the split Asaas cancelled is `app.splitStatus` / `app.splitCancellationReason`.
The handler resolves the payment row first so the record names the student,
academy and subscription; whose wallet the money comes out of is the only
question worth asking of a reversal, and the platform nets zero on these
charges, so the answer is always the academy.

**It writes nothing.** Whether a reversed month leaves the student overdue
again is a product decision nobody has made, and having the webhook invent one
would make it invisibly. The integration suite guards this rather than the
telemetry: a refund delivered end to end leaves the payment row byte-identical.

Confirmed live afterwards — a second real refund (`pay_224vjtax7yvvmsfe`) was
delivered to the running API through the tunnel and answered 200, so the full
forty-field payload goes through the route unvalidated and reaches the handler
intact. `POST /v1/webhooks/asaas` does no schema validation on the body at all;
the token is the whole boundary.


## What the database said — 2026-09-29 (B9, B10)

Queried before deleting anything, and it moved two decisions.

| Question | Answer |
| --- | --- |
| `select method, count(*) from payments group by method` | 253 `manual`, 2 `card` (then `stripe`), **zero `pix`** |
| Last payment of any kind | May 2026 |
| `pending_pix_payments` | 4 rows, all 25 May, one test session |
| `academy_payout_accounts` | 1 row, `approved` |
| `select version()` | PostgreSQL 16.13 |

**AbacatePay has never recorded a payment.** The plan kept its webhook handler
"until charges created before the cutover have drained"; there is nothing to
drain and there never was. The handler, `NO_PENDING_PIX`,
`createPendingPix` / `findPendingPixByQrCodeId` and the `pending_pix_payments`
table are therefore dead code. Left in place deliberately — removing them is a
migration and a commit of its own.

**The `stripe` → `card` rename cost 2 rows, not 255.** The handoff's figure was
the whole payments table. Done in B9's wake as migration `0023`, an
`ALTER TYPE ... RENAME VALUE` that rewrites nothing.

> **`0023` must not be applied to Coolify before the code deploys.** `0021` and
> `0022` were additive and safe to run early; this one is not. The running API
> queries `method IN ('stripe', 'pix')` in `admin.repository.postgres.ts` and
> `platform-summary.repository.postgres.ts`, and both start erroring the moment
> the value is renamed under them. Coolify still reads `manual, stripe, pix`.

That raw SQL is also what the integration suite caught and typecheck could not:
every union in TypeScript was already `card` and the build was green, and only
replaying the migration against real Postgres found the string literal.

## The mobile rail, settled by B10

- **`encodedImage` is raw base64**, no `data:` prefix. AbacatePay's field was a
  data URI and was passed straight to `<Image uri>`; unchanged, the QR renders
  as nothing.
- **`expirationDate` is `"YYYY-MM-DD HH:mm:ss"`**, not ISO. Hermes 0.81 *does*
  parse it — checked by running it through the engine in
  `react-native/sdks/hermesc`, not assumed — so the explicit parser is not
  fixing a crash. What it buys is returning `null` on unparseable input rather
  than rendering the string "Invalid Date" to a student.
- **The QR is valid about a year**, not minutes, even though `dueDate` is today.
  The countdown the AbacatePay screen ran was meaningless here and is a date now.
- **There is no charge-status endpoint on this rail.** The screen watches for the
  payment row the webhook writes. `/payments/me` is `Role.Student` only, so a
  guardian paying a dependent reads `/payments/dependent/:id` instead — and the
  match is on the subscription as well as the month, because a student enrolled
  in two academies has two subscriptions for the same month.
- **A guardian needs no API change.** `selectPlan` writes `userId` = whoever
  called it, so a dependent's subscription hangs off the guardian and
  `listWithPlanByUserAndAcademy` finds it. Both screens pass `subscriptionId`
  explicitly, so there is no ambiguity with the guardian's own plan.
- **`GET /users/me` gained `documentRequired`.** The document is needed only on a
  student's very first charge — `ensureCustomer` returns early once
  `asaas_customer_id` is set and discards whatever was sent. Asking always is
  monthly friction for a discarded value; asking after a `CPF_REQUIRED` 400 puts
  an error on the normal path. The flag is stale only when the recovery lookup
  finds a customer the column never recorded, and then the field is shown
  needlessly — much cheaper than the reverse.
- **The mobile app has no test runner at all** — no script, no config, no test
  files. So none of the above is covered by an automated test on that side; the
  API half is, and `tsc` adds zero errors against a baseline of 10 pre-existing.


## The B13 gate — what it covers, and what it does not

Closed 2026-09-29. Run as written it used to be misleading, because two of the
four commands did not cover what their names suggest.

| Command | Result | What it actually covers |
| --- | --- | --- |
| `pnpm typecheck` | 13/13 | api, web, every package — **not mobile**: `apps/mobile`'s script is `echo 'skipped: NativeWind className types need metro plugin'` |
| `pnpm lint` | 8/8 | fixed here. `apps/web` had **no ESLint config at all**, so `next lint` opened its interactive setup and exited 1 — 6/8, and pre-existing |
| `pnpm test:unit` | 692 | api only; nothing else in the workspace has unit tests |
| `pnpm test:integration` | 97 | api only, Postgres testcontainer replaying every migration |
| `pnpm --filter @tatame/web build` | clean | not part of the gate command; worth running once before a PR |

**The web lint config.** `eslint-config-next` is deliberately not used: it pins
`eslint@^7 || ^8 || ^9` and the workspace is on 10, which `apps/api` already
sets, and `eslint-plugin-import` is its heaviest dependency and the usual
laggard on a new eslint major. `@next/eslint-plugin-next` and
`eslint-plugin-react-hooks` are plain plugins with no eslint peer of their own,
so `apps/web/eslint.config.mjs` composes them directly. The script is `eslint .`
because `next lint` is deprecated in 15 and removed in 16.

It surfaced 8 pre-existing errors. Three were fixed — an unread destructured
prop and two `<a href="/">` that should be `<Link>`, a full reload on the
landing page's own logo. The other five are `react-hooks/set-state-in-effect`
and `static-components`, the React-Compiler-era rules new in
eslint-plugin-react-hooks 7; they are fair, but clearing them means refactoring
`apps/web` components that have no tests, so they are **warnings** with the
reason written beside them. Someone should do that pass; it is not a payment
slice's job.

**Mobile is still never typechecked by the gate, and has no test runner** — no
`test` script, no vitest/jest config, no test file anywhere. Check it by hand,
and compare against the baseline, because it is not zero:

```bash
cd apps/mobile && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c 'error TS'
# 10 — all pre-existing: `belt`/`stripes` on DependentItem, Record<Belt,…>
# indexing, a "guardian" comparison. None from this slice; verified by
# stashing the branch and re-running.
```

## What production's database says about the dead code — 2026-09-29

Asked again before deciding whether to delete `abacatepay-webhook.handler.ts`,
`stripe-checkout-webhook.handler.ts`, `NO_PENDING_PIX`, `createPendingPix` /
`findPendingPixByQrCodeId` and the `pending_pix_payments` table.

| Question | Answer |
| --- | --- |
| `payments` by method | 253 `manual`, 2 `stripe` — **zero `pix`** |
| the two non-manual rows | `pi_3Tb50XKxAZnjqqVo0aaiQbO6`, `pi_3Tb2p2KxAZnjqqVo2fEAXmkD` — Stripe PaymentIntents, not Pix |
| rows whose id is AbacatePay-shaped (`pix_char_%`) | 0 |
| `pending_pix_payments` | the same 4 rows, all one user, 25 May 18:04–18:13 — R$ 120,00 and three of R$ 1,00 |
| duplicates on `(subscription_id, reference_month)` | 0, and 0 nulls — which is what makes D9's constraint option viable, and D9 declines it anyway |

So the Pix payments production is remembered as having taken were a nine-minute
test session, and none of them became a payment row. The honest limit of this
evidence: four rows still pending proves no `billing.paid` was ever processed,
**not** that nobody paid — a payment whose webhook failed would look exactly the
same. Only AbacatePay's own dashboard answers that, and the amount at risk is
R$ 123,00 belonging to the developer who made them.

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
**Slice B (TAT-104) — B1 to B12 done.** The loop closes: both
student rails open a split charge (`POST /v1/payments/pix` and
`POST /v1/payments/checkout`), and `POST /v1/webhooks/asaas` turns the
settlement into a payment row, B7 reports the money that goes back out, B9 shut
the old rails and B10 moved the phone onto the new one. **B13 closed on
2026-09-29 and the slice is code-complete**, along with the duplicate-month
guard that open decisions 1 and 3 both asked for (D9).

**Migrations `0021_yummy_gambit` and `0022_awesome_masque` are both applied to
the Coolify database** (2026-09-29). 0022 was purely additive — a
`pending_asaas_kind` enum and a defaulted column — and its `when` is newer than
0021's, so it applied alone and cleanly despite the `__drizzle_migrations`
bookkeeping gap described below, adding row 19. Verified against the database:
`pending_asaas_payments.kind` exists as `pending_asaas_kind NOT NULL DEFAULT
'payment'`, and the enum holds exactly `payment` and `checkout`.

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
| B6 | Done | `asaas-payment.handler.ts`, 16 unit + 5 drop tests; idempotent by the unique constraint, not a flag |
| B8 | Done | `POST /v1/webhooks/asaas` dispatches both streams; 8 integration tests take a charge through the webhook to a payment row |
| B12 | Done | covered by `asaas-payment.integration.test.ts` — both rails, replayed |
| B7 | Done | `payment.reversed`, 10 unit tests + 1 integration guard; implements SPLIT-05 |
| B9 | Done | `/payments/checkout/pix`, `/pix-status/:id`, `createPixQrCode`, `createCheckoutSession` and `lib/abacatepay.ts` deleted; webhook handlers kept |
| B10 | Done | `components/PixPaymentView.tsx`; both route files are shells; `documentRequired` on `GET /users/me` |
| B11 | Done | Covered per task rather than in one pass — 687 unit, 97 integration |
| B13 | Done | typecheck 13/13, lint 8/8, 692 unit, 97 integration; mobile checked by hand — see **The B13 gate** below |

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

6. ~~**`confirmManual` has no duplicate-month guard, and still does not.**~~
   **Resolved 2026-09-29 by D9**, together with 6b — they were one hole seen from
   two sides. `confirmManual` asks `existsForSubscriptionReferenceMonth` before
   D5's cancellation and throws 409, and the webhook handler asks the same
   question before writing, reporting `DUPLICATE_MONTH` instead of a second row.
   No unique constraint, deliberately: a refunded month keeps its row, so a
   constraint would block re-paying it. The original note, for the record — noted,
   not fixed, outside B4's line item. The spec's edge case ("WHEN a student pays
   exactly as the manager confirms the same month manually THEN the reference-month
   uniqueness SHALL keep a single payment row") assumes a uniqueness constraint
   that does not exist on `payments (subscription_id, reference_month)`. D5 closes
   the Asaas half of that race; the manual-versus-manual half is still open.

### Carried forward

1. ~~**No Asaas credentials yet.**~~ **Superseded 2026-09-28** by the sandbox
   validation above. What is still unverified is narrower: the onboarding round
   trip driven from the app, and both webhooks actually delivered by Asaas.
2. ~~**`POST /webhooks/asaas` accepts `PAYMENT_*` and ignores it**~~ —
   **resolved 2026-09-29 by B8.** The route now dispatches `ACCOUNT_STATUS_*`
   and `PAYMENT_*` to their handlers and reports anything else.
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

