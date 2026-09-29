# Context — Asaas Payment Split

Decisions captured with the user before writing the spec. These close the gray areas
that would otherwise change the architecture.

## D1 — Platform commission

**Decision:** No Tatame commission. The Asaas fee is passed through; the academy
receives the net value of the charge.

**Implication:** the split is `percentualValue: 100` to the academy wallet. Asaas
calculates splits over `netValue` (charge value minus Asaas fees), so 100% to the
academy means Tatame nets exactly zero on the transaction and pays nothing out of
pocket. Revenue stays on the manager subscription (Stripe).

**Rejected:** fixed platform percentage — no product need today, and it would force a
configurable rate plus explicit disclosure in the plan UI.

## D2 — Manager onboarding

**Decision:** in-app form. The app collects the data, calls the API, and shows
loading / error / success states. Documents are submitted in-app whenever the Asaas
API allows it.

**Constraint found in the docs:** `GET /v3/myAccount/documents` returns a document
group per pending item. When a group carries `onboardingUrl`, Asaas *rejects* an API
upload for it and the holder must use that link. So both paths must exist:

- group without `onboardingUrl` → upload in-app via `POST /v3/myAccount/documents/{id}`
- group with `onboardingUrl` → the app opens the link (the manager finishes there,
  and the result comes back through the account-status webhook)

## D3 — Who absorbs the fee

**Decision:** the academy receives the net value. The student pays exactly the plan
price. The plan creation screen states this explicitly with the current Asaas rates.

**Rejected:** gross-up on the student, and a per-plan toggle — both add a column to
the plan and complicate every price display.

## D4 — Migration

**Decision:** Asaas replaces both student rails. Student Pix moves from AbacatePay to
Asaas, and the student card checkout moves from Stripe Checkout to Asaas Checkout.
Stripe stays for the manager subscription only.

**Implication:** an academy without an approved payout account has no automatic
payment at all — only manual confirmation by the manager.

## D5 — Manual settlement versus an open Asaas charge

**Decision:** confirming a month by hand cancels the open Asaas charge for that
month.

**Found in the sandbox, not in the docs:** `POST /v3/payments/{id}/receiveInCash`
leaves the charge at `RECEIVED_IN_CASH` with `netValue` equal to the gross, and
marks the split `CANCELLED` with `cancellationReason: PAYMENT_RECEIVED_IN_CASH`.
The subaccount balance stays at zero. That is correct on Asaas's side — no money
moved through the rail — but it means a manual confirmation credits the academy
nothing through the split, and the charge stays payable.

**Implication:** the manager's existing manual confirmation has to cancel the
Asaas charge, or a student can pay a Pix for a month already settled and the
money lands in the subaccount with no payment row to match it.

**Rejected:** blocking manual confirmation while a charge is open — the manager
takes cash at the counter and cannot be told to wait. Also rejected: leaving both
alive, which is the double-payment hole above.

## Open assumption (flagged, not blocking)

Existing academies have plans and active subscriptions created before payout accounts
existed. The spec assumes **already-enrolled students keep paying normally** and the
gate applies only to *new* plan creation and *new* enrollments. If the platform owner
wants a hard cutoff, PAYOUT-07 changes.

---

## D6 — The app does not collect documents

**Decision (2026-09-29):** the manager submits identity documents in their own Asaas
account. The app reports what Asaas wants and how far it got, names the Asaas e-mail
as the way in, and opens the Asaas login. The in-app uploader and the API route
behind it were removed.

**What settled it:** Asaas documents a *standard* (non-BaaS) subaccount as having its
own access to the Asaas interface — "the account holder receives an email to reset
their password and proceeds with document submission directly through the interface",
and "mandatory documents are submitted directly through the Asaas interface". Ours are
standard subaccounts, so the uploader duplicated a flow Asaas already runs.

**Three reasons, in the order they matter:**

1. Identity documents — RG, CNH, selfie, contrato social — no longer travel through
   our API on the way to Asaas. They never rested here, but not being in the path is
   the safer posture, and a file upload endpoint is attack surface on its own.
2. The uploader could only take images from the gallery, so a CNPJ academy asked for a
   contrato social or an MEI certificate could never have finished in the app. Closing
   that gap needed `expo-document-picker` and a native rebuild, for a path Asaas
   already provides.
3. Nothing about the upload was ever exercised against the real Asaas: the sandbox
   approves the only document group on creation, so there was never a pending group
   to upload into.

**The cost, accepted:** the manager leaves the app into an Asaas-branded interface and
manages one more password, and we depend on an e-mail we do not control being found —
spam included. If Asaas ever returns a group its own interface does not cover, the
academy has no path and the uploader has to come back; it is one `git revert` away.

**Untouched:** a group carrying an `onboardingUrl` is still opened as a link, which is
Asaas's own rule — it refuses every other channel for those.

---

## D7 — The student's document is typed, never stored

**Decision (2026-09-29):** the student types their CPF/CNPJ on the payment screen the
first time they pay. It goes straight to Asaas at customer creation and only the
resulting `asaas_customer_id` comes back to us. From the second charge on, nobody is
asked anything.

**What forced the question:** the platform stores no document for anyone, and B3 could
not be written without knowing where the student's would come from. The sandbox drew
the line precisely:

| Call | Result |
| --- | --- |
| `POST /v3/customers` with only a `name` | **200** — customer created, `cpfCnpj: null` |
| `POST /v3/payments` for that customer | **400** — "Para criar esta cobrança é necessário preencher o CPF ou CNPJ do cliente." |
| `POST /v3/customers/{id}` adding the document | 200 |
| the same charge, retried | 200, `value 150,00 → netValue 149,01` |

So the document is optional to *create* a customer and mandatory to *charge* one. The
useless half of that pair is not worth being able to express, and `createCustomer`
requires `cpfCnpj`.

**Why not store it.** It is the same decision the design already took for the manager —
"`cpfCnpj` — always typed; the platform stores no document today" — and `users`
gains no column. B1 already put `asaas_customer_id` on `users`, which is exactly what
makes the question a one-time one: the document lives at Asaas, keyed by an id we do
hold.

**Rejected:** a `users.cpf_cnpj` column, which would put a personal document on every
student row to save a field the student sees once; and asking at signup or in the
profile, which needs the same column and changes screens outside TAT-104.

**The cost, accepted:** `POST /payments/pix` takes an optional `cpfCnpj`, required only
when the student has no customer yet, and answers 400 `CPF_REQUIRED` when it is needed
and missing. The mobile screen (B10) has to render that field and that error.

**Also settled here:** customers are created with `notificationDisabled: true`. Asaas
bills the customer by e-mail and SMS on its own, and the payment webhook already
notifies and e-mails the student in wording we control.

---

## D8 — The card rail does not use the student's Asaas customer

**Decision (2026-09-29):** the Asaas checkout is created with no customer
attached. The student identifies themselves on the Asaas page, which mints a
customer of its own. `POST /payments/checkout` therefore takes no `cpfCnpj` and
never calls `ensureCustomer`.

**What forced it.** B5 was expected to reuse B3's `ensureCustomer` wholesale.
The sandbox refused:

| Call | Result |
| --- | --- |
| `POST /v3/checkouts` with `customer: cus_000009262465` | **400** — `address`, `addressNumber`, `postalCode`, `province`, `city` "deve existir para o customer informado" |
| the same with `customerData: {name, cpfCnpj, email}` | **400** — the same five, plus `phoneNumber` |
| with neither | **200** — the Asaas page collects identification, address and card |

Our customers are a name and a document and nothing else (D7), and the platform
holds no address for a student. So the only customer a checkout will accept is
one we cannot build.

**This narrows D7 rather than replacing it.** D7 still holds for Pix, which is
where `asaas_customer_id` is written and reused. Card is simply a rail the
question is never asked on — the student types the same data into Asaas's form
instead of ours. A student who has only ever paid by card has no
`asaas_customer_id`, and their first Pix charge will ask for the document then.

**Rejected:** collecting an address to make the binding possible — it is a
screen and a column for no benefit the student can see, since Asaas asks for
the address on its own page regardless. Also rejected: sending a placeholder
address, which is inventing data about a person.

**The cost, accepted:** a student who pays by card has two customer records at
Asaas over time, one per rail, and the platform can only ever see the Pix one.
Reconciliation does not go through the customer — it goes through
`payment.checkoutSession` and the pending row — so nothing downstream depends
on them being the same.
