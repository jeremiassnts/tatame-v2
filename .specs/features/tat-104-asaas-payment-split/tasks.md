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
| A7 | `PayoutAccountService` documents — list groups, upload when there is no `onboardingUrl`, expose the link when there is | A3,A5 | PAYOUT-03, PAYOUT-04 |
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
| B5 | `PaymentService.createCheckout` on Asaas — `POST /v3/checkouts` with `splits` and callbacks, same `{ checkoutUrl }` contract | A3,A5,B3 | SPLIT-03 |
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

1. The Tatame root Asaas account must be a **CNPJ** — subaccount creation requires it.
2. Sandbox credentials (`ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`) provisioned.
3. Confirm the production rollout fits the Asaas evaluation window: up to 10 subaccounts
   and R$ 2.000 per charge during the first 60 days.

## Status

**Slice A (TAT-179) — complete.** A1-A20 merged on `main`, one commit per task.
Slice B (TAT-104) is untouched.

| Task | Status | Notes |
| --- | --- | --- |
| A1 | Done | `ASAAS_*` + `PAYOUT_ACCOUNT_ENCRYPTION_KEY`, all optional |
| A2 | Done | `lib/crypto.ts`, 12 unit tests |
| A3 | Done | `lib/asaas.ts`, 25 unit tests |
| A4 | Done | migration `0020_gray_klaw` |
| A5 | Done | interface + postgres + in-memory |
| A6 | Done | 15 unit tests |
| A7 | Done | 13 unit tests |
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

### Carried forward

1. **No Asaas credentials yet.** Everything is verified against a fake; nothing
   has touched sandbox. The blockers below are still open.
2. **`POST /webhooks/asaas` accepts `PAYMENT_*` and ignores it** so Asaas does
   not retry for days. B8 replaces that branch with the real dispatch.
3. **`DOCUMENT_REQUIRES_ONBOARDING_URL` carries the url in `HttpError.details`,
   which `error-handler.ts` drops** — only `details.code` reaches the client.
   The documents list already gives the app the url, so the 409 is a safety
   net, not the path the screen takes. A15 should read the url from the list.
4. **No PDF upload.** `expo-document-picker` is not a dependency, so A15 uses
   `expo-image-picker` and a manager can only attach images. The Asaas documents
   a CNPJ account is asked for — contrato social, certificado MEI, ata de
   constituição — are normally PDFs. Adding the dependency means a new native
   build, since `android/` and `ios/` are committed, so it was left as a
   decision rather than taken silently.
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

