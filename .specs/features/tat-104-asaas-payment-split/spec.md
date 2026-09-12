# Asaas Payment Split Specification

Covers two Linear issues that cannot ship apart:

| Issue | Scope | Requirement prefix |
| --- | --- | --- |
| **TAT-104** | Student payments through Asaas with automatic split to the academy | `SPLIT-` |
| **TAT-179** (new, related) | Manager receiving account: onboarding, status, gating, fee disclosure | `PAYOUT-` |

## Problem Statement

Today a student's Pix payment lands in the Tatame AbacatePay account and a card
payment lands in the Tatame Stripe account. Every cent then has to be transferred to
the academy by hand — the `payments.transferred_at` column is the scar of that manual
process. It does not scale past a handful of academies and it makes Tatame hold third
party money it has no business holding.

Asaas supports Pix and card on a single rail with native split and subaccounts, so a
student payment can settle directly into the academy's own account at the moment it is
received, with no manual step and no float sitting on the platform.

## Goals

- [ ] A student payment (Pix or card) credits the academy's Asaas wallet automatically, with zero manual transfers
- [ ] A manager can create and track their receiving account from the Financeiro screen, without leaving the app when Asaas allows it
- [ ] A manager sees the real Asaas rates and the exact net amount before saving a plan price
- [ ] No plan can be created, and no student can enroll, for an academy that has nowhere to receive the money

## Out of Scope

| Feature | Reason |
| --- | --- |
| Migrating the manager subscription off Stripe | Stripe stays for manager billing; a later migration is a separate decision |
| Platform commission on student payments | D1 — Tatame takes no cut today |
| Boleto as a student payment method | Not offered today; adding it is a product decision, not a split requirement |
| Installments (`installmentCount`) on student payments | Plans are recurring monthly charges, not installments |
| Asaas receivable anticipation | Academy-level financial product, unrelated to split |
| Backfilling historical payments into Asaas | Past payments stay as they are; `transferred_at` keeps its meaning for legacy rows |
| Automatic recurring charge (Asaas subscriptions) | Today the student initiates each payment; keeping that avoids changing the whole payment UX at once |

---

## User Stories

### P1: Manager creates a receiving account ⭐ MVP

**User Story**: As a manager, I want to create my receiving account from the Financeiro
screen so that student payments reach my bank account without depending on Tatame.

**Why P1**: Nothing else in the feature works without an approved account. It is the
gate for plan creation, enrollment and split.

**Acceptance Criteria**:

1. WHEN a manager opens Financeiro and has no payout account THEN the system SHALL show a "Conta de recebimento" card with a call to action to create it
2. WHEN a manager submits the onboarding form with name, e-mail, CPF/CNPJ, birth date (CPF only), company type (CNPJ only), mobile phone, monthly revenue and full address THEN the system SHALL create an Asaas subaccount and persist its `id`, `walletId` and encrypted `apiKey`
3. WHEN the subaccount is created THEN the system SHALL register the account-status and payment webhooks for it and store the account with status `pending`
4. WHEN the form is submitted THEN the app SHALL show a loading state, and on failure SHALL show the Asaas validation message in Portuguese without losing what the manager typed
5. WHEN a payout account already exists for the academy THEN the system SHALL reject a second creation attempt with 409
6. WHEN Asaas rejects the data (invalid CEP, CPF/CNPJ already used, invalid document) THEN the system SHALL surface that reason and leave no half-created account persisted
7. WHEN the form opens THEN every field SHALL be editable with a prefilled default where one exists, and the form SHALL NOT write any edit back to the academy or user record
8. WHEN a CEP is typed THEN the screen SHALL fill street, neighborhood and city from it, since `academies.address` is free text and cannot be split reliably

**Independent Test**: In sandbox, submit the form and see the card switch from "criar conta" to a pending account showing the Asaas account id.

---

### P1: Manager completes and tracks document review ⭐ MVP

**User Story**: As a manager, I want to send my documents and see where my account
stands so that I know when I can start receiving.

**Why P1**: An account that is created but never approved cannot receive a split, so
the manager needs a path to `APPROVED` that does not go through support.

**Acceptance Criteria**:

1. WHEN a payout account exists THEN the system SHALL list the pending document groups with title, description and status
2. WHEN a document group has no `onboardingUrl` THEN the app SHALL let the manager pick a file and upload it in-app, showing progress and the resulting status
3. WHEN a document group has an `onboardingUrl` THEN the app SHALL open that link instead of attempting an upload, because Asaas refuses API uploads for those groups
4. WHEN Asaas sends an `ACCOUNT_STATUS_*` webhook THEN the system SHALL update the stored status and, on `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED`, mark the account `approved` and stamp `approvedAt`
5. WHEN a status becomes rejected THEN the system SHALL store and display the rejection reason and allow resubmission
6. WHEN the manager pulls to refresh THEN the system SHALL re-read the live status from Asaas rather than trusting only the webhook

**Independent Test**: Upload a sandbox document, then force the approval webhook and see the card turn green.

---

### P1: Fees are explicit when pricing a plan ⭐ MVP

**User Story**: As a manager, I want to see the fee and what I actually receive while I
type the plan price so that I am not surprised at the end of the month.

**Why P1**: The whole model is "the academy receives the net value" (D3). Hiding the
fee turns that decision into a complaint.

**Acceptance Criteria**:

1. WHEN the plan creation or edit screen loads THEN the system SHALL fetch the current Asaas rates for the platform account and cache them
2. WHEN a price is typed THEN the screen SHALL show, for Pix and for card, the fee applied and the net value the academy receives
3. WHEN the card settlement delay is known THEN the screen SHALL state it in days, since card money is not immediate
4. WHEN the rates cannot be fetched THEN the screen SHALL still allow saving the plan and SHALL say the rates are momentarily unavailable, never showing a stale or invented number
5. WHEN the Pix free-transaction allowance applies THEN the disclosure SHALL say the first N monthly Pix credits are free

**Independent Test**: Type `150,00` and see "Pix: taxa R$ 1,99 · você recebe R$ 148,01".

---

### P1: Plan creation and enrollment require a receiving account ⭐ MVP

**User Story**: As the platform, I want plans and enrollments blocked without an
approved payout account so that no student ever pays into a void.

**Why P1**: This is the invariant the whole feature protects.

**Acceptance Criteria**:

1. WHEN a manager tries to create a plan and the academy has no approved payout account THEN the API SHALL return 403 with code `PAYOUT_ACCOUNT_REQUIRED`
2. WHEN the app receives `PAYOUT_ACCOUNT_REQUIRED` THEN it SHALL explain why and offer a direct route to the onboarding screen
3. WHEN the plan creation screen loads and the account is missing or not approved THEN the screen SHALL disable the submit action up front instead of failing on save
4. WHEN a student tries to select a plan of an academy without an approved payout account THEN the API SHALL return 403 with code `PAYOUT_ACCOUNT_REQUIRED`
5. WHEN a student already has an active subscription created before this feature THEN the system SHALL keep it payable, so the gate applies only to new enrollments

**Independent Test**: With a pending account, the create-plan button is disabled and the API refuses the call.

---

### P1: Student pays by Pix through Asaas with split ⭐ MVP

**User Story**: As a student, I want to pay my membership by Pix so that my academy
receives the money directly.

**Why P1**: Pix is the dominant method in the current flow and replaces AbacatePay.

**Acceptance Criteria**:

1. WHEN a student requests a Pix charge THEN the system SHALL ensure an Asaas customer exists for that student and reuse it on later charges
2. WHEN the charge is created THEN the system SHALL send `split: [{ walletId, percentualValue: 100 }]` for the academy's wallet
3. WHEN the charge is created THEN the app SHALL show the QR code image and the copy-and-paste payload with its expiration
4. WHEN a charge already exists and is unpaid for the same subscription and reference month THEN the system SHALL return the existing charge instead of creating a duplicate
5. WHEN the payment for the reference month was already confirmed THEN the system SHALL return 409
6. WHEN the academy has no approved payout account THEN the system SHALL return 403 with code `PAYOUT_ACCOUNT_REQUIRED`

**Independent Test**: Pay the sandbox QR code and see the payment row appear with the split recorded.

---

### P1: Student pays by card through Asaas with split ⭐ MVP

**User Story**: As a student, I want to pay by card so that I do not depend on having
Pix balance at that moment.

**Why P1**: Replaces the Stripe Checkout student flow, which must not survive the
migration (D4).

**Acceptance Criteria**:

1. WHEN a student requests a card payment THEN the system SHALL create an Asaas Checkout carrying the same split and return its link
2. WHEN the checkout succeeds, is canceled or expires THEN Asaas SHALL return the student to the corresponding callback URL
3. WHEN the checkout is created THEN the system SHALL persist enough reference (subscription, reference month, academy) to reconcile the webhook without trusting the client
4. WHEN the academy has no approved payout account THEN the system SHALL return 403 with code `PAYOUT_ACCOUNT_REQUIRED`

**Independent Test**: Open the returned link in sandbox, pay with a test card, and see the payment recorded.

---

### P1: Payments are reconciled from Asaas webhooks ⭐ MVP

**User Story**: As the platform, I want payments recorded only from Asaas webhooks so
that a payment is never invented by the client.

**Why P1**: Money correctness. This is where the current AbacatePay/Stripe handlers
already earned their reporting of dropped webhooks.

**Acceptance Criteria**:

1. WHEN a webhook arrives THEN the system SHALL reject it unless the `asaas-access-token` header matches the configured token
2. WHEN `PAYMENT_RECEIVED` or `PAYMENT_CONFIRMED` arrives THEN the system SHALL create the payment row with the Asaas payment id, amount, method and reference month, and notify the student
3. WHEN the same event is delivered more than once THEN the system SHALL record the payment exactly once
4. WHEN a webhook cannot be matched to a pending charge THEN the system SHALL emit `payment.webhook_unhandled` with the reason, as the existing handlers do
5. WHEN `PAYMENT_REFUNDED` or a chargeback event arrives THEN the system SHALL emit an event so it is visible, since Asaas reverses the split on the academy's side too

**Independent Test**: Replay the same sandbox webhook twice and confirm a single payment row.

---

### P2: Manager sees the receiving account on the Financeiro dashboard

**User Story**: As a manager, I want the account state visible where I already look at
money so that I notice a problem before a student complains.

**Acceptance Criteria**:

1. WHEN the account is approved THEN the card SHALL show it is active and the bank data returned by Asaas
2. WHEN the account is pending or rejected THEN the card SHALL show what is missing and route to the pending action

---

### P3: Manager opens their Asaas account

**User Story**: As a manager, I want to reach my Asaas account so that I can withdraw
and see statements.

**Acceptance Criteria**:

1. WHEN the account is approved THEN the app SHALL offer a link to the Asaas login

---

## Edge Cases

- WHEN a subaccount is created but the response is lost mid-flight THEN the system SHALL NOT let a second creation attempt orphan the first — creation is guarded by the unique academy constraint and reconciled by CPF/CNPJ lookup
- WHEN the stored `apiKey` cannot be decrypted THEN document and status calls SHALL fail loudly rather than silently skipping the account
- WHEN Asaas is unreachable while a student is paying THEN the system SHALL return 502 and SHALL NOT create a local payment row
- WHEN the academy's account is approved but later suspended THEN the next charge attempt SHALL fail and the status SHALL be refreshed from the webhook
- WHEN a plan price is below the Asaas minimum charge value THEN plan creation SHALL be rejected with a clear message
- WHEN a new subaccount is inside the Asaas 60-day evaluation window THEN charges above the platform's per-account cap may be blocked by Asaas, and the resulting error SHALL be surfaced verbatim rather than swallowed
- WHEN a student pays exactly as the manager confirms the same month manually THEN the reference-month uniqueness SHALL keep a single payment row

---

## Requirement Traceability

| Requirement ID | Story | Issue | Phase | Status |
| --- | --- | --- | --- | --- |
| PAYOUT-01 | P1: Manager creates a receiving account | TAT-179 | Implemented | API done, mobile pending |
| PAYOUT-02 | P1: Manager creates a receiving account (webhooks + persistence) | TAT-179 | Implemented | Done |
| PAYOUT-03 | P1: Document submission in-app | TAT-179 | Implemented | API done, mobile pending |
| PAYOUT-04 | P1: Document submission via onboarding link | TAT-179 | Implemented | API done, mobile pending |
| PAYOUT-05 | P1: Account status tracking + webhook | TAT-179 | Implemented | Done |
| PAYOUT-06 | P1: Fee disclosure on plan creation | TAT-179 | Implemented | API done, mobile pending |
| PAYOUT-07 | P1: Gate plan creation and enrollment | TAT-179 | Implemented | Done |
| PAYOUT-08 | P2: Financeiro dashboard card | TAT-179 | - | Pending |
| PAYOUT-09 | P3: Link to the Asaas account | TAT-179 | - | Pending |
| SPLIT-01 | P1: Asaas customer per student | TAT-104 | Design | Pending |
| SPLIT-02 | P1: Pix charge with 100% split | TAT-104 | Design | Pending |
| SPLIT-03 | P1: Card checkout with 100% split | TAT-104 | Design | Pending |
| SPLIT-04 | P1: Webhook reconciliation and idempotency | TAT-104 | Design | Pending |
| SPLIT-05 | P1: Refund and chargeback visibility | TAT-104 | Design | Pending |
| SPLIT-06 | P1: Retire AbacatePay and Stripe student checkout | TAT-104 | Design | Pending |

**Coverage:** 15 total, mapped in `tasks.md`.

---

## Success Criteria

- [ ] A student payment in sandbox settles into the academy's subaccount with no manual transfer
- [ ] A manager reaches `APPROVED` from the app alone whenever Asaas does not force the onboarding link
- [ ] The net value shown at plan creation matches the amount actually credited, to the cent
- [ ] No plan exists whose academy cannot receive money
- [ ] Zero `payment.webhook_unhandled` events in a clean end-to-end sandbox run
