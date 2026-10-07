/**
 * Whether the card rail is offered to students.
 *
 * Off since the Pix rail shipped: the Asaas checkout is a one-off charge, so a
 * student pays by typing name, CPF, phone and a full address into Asaas's page
 * **every month** — Asaas refuses a checkout bound to a customer we can build
 * (see D8 in `.specs/features/tat-104-asaas-payment-split/context.md`).
 *
 * The API side is untouched and still works: `POST /payments/checkout` and the
 * webhook handler stay live for charges already in flight. Only the entry
 * points in the app are hidden, so turning this back on is one line.
 *
 * TAT-189 replaces the rail with an Asaas subscription (`chargeTypes:
 * ["RECURRENT"]`), which asks for that data once. Flip this when it lands.
 */
export const CARD_PAYMENT_ENABLED: boolean = false;
