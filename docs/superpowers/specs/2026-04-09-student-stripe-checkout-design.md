# TAT-94: Student Subscription Payments via Stripe Checkout

## Goal

Enable students to pay academy subscription fees through Stripe Checkout (hosted page) opened from the mobile app via in-app browser. After successful payment, record the subscription as paid for the correct billing period. Additionally, allow managers to register their Pix key for receiving payment transfers.

## Architecture Overview

### Payment Flow

1. Student opens "Minha assinatura" screen, sees "Pagamento pendente" card with "Pagar agora" button
2. App calls `POST /v1/payments/checkout` → API creates Stripe Checkout Session (`mode: 'payment'`) → returns URL
3. App opens URL via `expo-web-browser` (in-app browser)
4. Student completes payment on Stripe Checkout (cards, wallets, etc.)
5. Stripe redirects to `tatame://payment-success` or `tatame://payment-cancel`
6. App closes browser, shows processing banner; pull-to-refresh to update status
7. Webhook `checkout.session.completed` records payment in DB with `method: 'stripe'`
8. Emails sent to student (confirmation) and manager (notification)

### Financial Model

- All payments land in the platform's Stripe account (single account, no Stripe Connect)
- Manager registers Pix key in the app for manual/external transfers
- Future evolution: Stripe Connect for direct payouts

## Backend / API

### New Endpoint — Create Checkout Session

```
POST /v1/payments/checkout
```

- **Auth**: Student with active subscription
- **Body**: `{ subscriptionId? }` (optional — defaults to student's active subscription)
- **Logic**:
  - Validates student has active subscription in current academy
  - Validates no payment exists for current month (same `hasPaidCurrentMonth` logic)
  - Creates Stripe Checkout Session:
    - `mode: 'payment'`
    - Amount from plan's `priceCents`
    - `metadata`: `{ subscriptionId, userId, academyId, referenceMonth }`
    - `success_url`: `tatame://payment-success?session_id={CHECKOUT_SESSION_ID}`
    - `cancel_url`: `tatame://payment-cancel`
- **Returns**: `{ checkoutUrl: string }`

### New Endpoints — Pix Key

```
PUT /v1/academies/pix-key
```

- **Auth**: Manager
- **Body**: `{ pixKeyType: 'cpf' | 'email' | 'phone' | 'random', pixKey: string }`
- **Logic**: Saves to `academies` table

```
DELETE /v1/academies/pix-key
```

- **Auth**: Manager
- **Logic**: Nullifies `pix_key` and `pix_key_type` on the academy

### Database Changes

Add to `academies` table:
- `pix_key` — text, nullable
- `pix_key_type` — enum (`cpf`, `email`, `phone`, `random`), nullable

New migration required.

### Webhook Handler

Expand existing `stripe-webhook.handler.ts`:

- New handler for `checkout.session.completed` with student payment metadata
- **Differentiation**: if `metadata.subscriptionId` exists → student payment; otherwise → existing manager flow
- **Idempotency**: check if payment with same `stripePaymentId` already exists before creating
- **Flow**:
  1. Receive `checkout.session.completed`
  2. Extract metadata: `subscriptionId`, `userId`, `academyId`, `referenceMonth`
  3. Check idempotency
  4. Create `payments` record: `method: 'stripe'`, `stripePaymentId`, `confirmedBy: null`
  5. Send confirmation email to student
  6. Send notification email to manager:
     - With Pix registered: "Student X paid R$ Y, the amount will be in your account soon"
     - Without Pix registered: same + "Voce ainda nao tem chave de Pix cadastrada na plataforma, entre no aplicativo e acesse a aba Financeiro para adicionar"

**Security:**
- Webhook signature already verified via `stripe-signature` header
- Checkout Session created only for authenticated student with active subscription and no payment in current month
- Metadata is immutable (set server-side, student cannot manipulate)
- No sensitive data exposed to client (only `checkoutUrl`)

## Mobile — Student Subscription Screen

**Reference designs (Pencil):** Node IDs `YYbfl` (pending) and `Nk0pL` (paid)

Use MCP Pencil tool with `batch_get` on these node IDs to get the exact visual reference for implementation.

### Payment Card — Two States

**Pending** (no payment for current month):
- Header: "Pagamento pendente" + red badge "Pendente"
- Info: plan name, due date, amount
- Purple button "Pagar agora" → calls checkout endpoint → opens browser

**Paid** (payment exists for current month):
- Header: "Mensalidade atual" + green badge "Pago"
- Info: plan name, payment date, amount
- Gray disabled button "Pago"

### Post-Checkout Flow

- **On success** (`tatame://payment-success`):
  - Close browser
  - Show banner/alert at top of screen: "Pagamento sendo processado. Em breve aparecera aqui."
  - No automatic polling — pull-to-refresh (scroll up) to update
- **On cancel** (`tatame://payment-cancel`):
  - Close browser, no changes

### Existing Elements (no changes needed)

- Payment history list (already shows method and reference)
- Next payment note (calendar icon + date + amount)

## Mobile — Manager Finance Screen

**Reference designs (Pencil):** Node IDs `3sIUB` (with Pix, card `55ENs`), `KSv3g` (without Pix, card `L5lJb`)

Use MCP Pencil tool with `batch_get` on these node IDs to get the exact visual reference for implementation.

### Pix Key Card — Two States

**Not registered** (design KSv3g / node L5lJb):
- Large key icon
- "Nenhuma chave cadastrada"
- Explanatory description
- Purple button "+ Cadastrar chave PIX"

**Registered** (design 3sIUB / node 55ENs):
- Header: QR icon + "Chave PIX" + "Editar" button
- Key type (E-mail, CPF, etc.)
- Key value
- Green dot + "Chave ativa para recebimentos"

### Pix Registration/Edit Modal

- Bottom sheet following existing app modal patterns
- Select for key type: CPF, E-mail, Telefone, Aleatoria
- Text input for key value
- "Salvar" button
- Edit mode: same modal, pre-filled with current data

### Alert on Manager Home Screen

- Banner at top of home screen (`(manager)/(home)/index.tsx`) when `pixKey` is null
- Subtle background, alert icon, text: "Configure sua chave PIX para receber pagamentos dos alunos"
- Tap → navigates to Finance screen

## Emails

Two new email templates (via existing Resend integration):

1. **Student payment confirmation**: plan name, amount, reference period
2. **Manager payment notification**:
   - With Pix: "Student X paid R$ Y, the amount will be in your account soon"
   - Without Pix: same + prompt to register Pix key in the app

## Out of Scope

- Apple/Google IAP
- Stripe Billing subscription lifecycle (recurring)
- Stripe Connect for direct payouts to managers
- Proration logic
