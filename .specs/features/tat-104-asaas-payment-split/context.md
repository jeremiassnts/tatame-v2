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
