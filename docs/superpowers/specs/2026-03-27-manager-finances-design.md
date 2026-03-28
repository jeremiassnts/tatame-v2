# Manager Financial Screens — Design Spec

## Overview

Implementation of the financial management module for the manager role in the mobile app. Covers subscription plan CRUD, student subscription listing, payment confirmation, and a financial dashboard.

## Screens

### M-MGR-17: Financial Dashboard (`/(finances)/index.tsx`)

The main financial overview screen, accessible via the "Finanças" tab.

**Summary cards:**
- **Revenue card**: total revenue for the current month (sum of payments with `referenceMonth` = current month), percentage change vs previous month
- **Pending card**: count of active subscriptions without a payment for the current month, total pending value (sum of their plan prices)
- **Active members card**: count of active subscriptions — informational only, no tap action

**Quick actions row:** 3 buttons navigating to:
- `plans/` (Planos)
- `subscriptions/` (Assinaturas)
- `confirm-payment` (Confirmar Pagamento)

**Payment history:** last 10 confirmed payments, most recent first. Each item shows student name, amount, date, reference month, and payment method.

### M-MGR-10: Subscription Plans List (`/(finances)/plans/index.tsx`)

**Header:** back button + title "Planos" + purple "+" button (navigates to `plans/create`)

**Content:**
- Subtitle: "X planos ativos"
- List of plan cards, each showing:
  - Plan name
  - Price formatted per recurrence period (e.g., R$199/mês, R$549/trimestre)
  - Badges: recurrence, checkin limit (or "Ilimitado"), subscriber count
  - Status badge (Ativo/Inativo)
- Tap on card → navigates to `plans/[planId]`
- FAB "+" button at bottom-right corner (also navigates to `plans/create`)

### M-MGR-11: Subscription Plan Detail (`/(finances)/plans/[planId].tsx`)

**Header:** back button + title "Detalhes do plano" + edit button (pencil icon) → navigates to `plans/edit/[planId]`

**Plan info card:**
- Plan name + status badge (Ativo/Inativo)
- Price formatted with recurrence suffix (e.g., R$199 /mês)
- Info grid: recurrence, checkins/week, creation date, active subscriber count

**Active subscribers list:**
- Section label "Assinantes ativos"
- Each row: avatar + name + expiration date + green active indicator
- Tap on subscriber row → navigates to `subscriptions/[subscriptionId]`

**Footer button:** "Desativar plano" (red, destructive) — shows Alert confirmation before executing `PATCH /subscriptions/plans/:planId` with `{ isActive: false }`. When plan is already inactive, button text changes to "Ativar plano" (green) and sets `{ isActive: true }`.

### M-MGR-12: Create / Edit Subscription Plan (`/(finances)/plans/create.tsx` and `/(finances)/plans/edit/[planId].tsx`)

**Form fields (React Hook Form + Zod):**
- **Nome do plano** — text input
- **Valor (R$)** — numeric input, displayed as reais (e.g., 199,00), stored as cents (19900)
- **Recorrência (meses)** — ModalSelect with options: 1 mês, 3 meses, 6 meses, 12 meses
- **Check-ins por semana** — numeric input + toggle "Ilimitado". When toggle is on, input is disabled and value is sent as `null`

**Footer button:** "Salvar plano" — calls `POST /subscriptions/plans` (create) or `PATCH /subscriptions/plans/:planId` (edit).

On edit mode, form is pre-filled with existing plan data.

After success: navigates back and invalidates `subscription-plans` query.

### M-MGR-13: Student Subscriptions List (`/(finances)/subscriptions/index.tsx`)

**Header:** back button + title "Assinaturas"

**Search bar:** filters student list by name (client-side filtering).

**Filter pills:** Todos | Ativos | Expirados | Pgto. pendente
- "Todos": no filter
- "Ativos": `status === "active"` and not expired by date
- "Expirados": `status === "expired"` or expired by date
- "Pgto. pendente": `status === "active"` and no payment record for current month

**Student subscription rows:** each shows:
- Avatar (first letter fallback)
- Student name
- Plan name badge (colored)
- Status badge (Ativo / Expirado / Pgto. pendente)
- Expiration date
- Chevron right

Tap → navigates to `subscriptions/[subscriptionId]`

### M-MGR-14: Student Subscription Detail (`/(finances)/subscriptions/[subscriptionId].tsx`)

**Header:** back button + title "Assinatura do aluno"

**Subscription card:**
- Student avatar + name + email
- Divider
- Info grid: plan name, status badge, start date, expiration date
- Payment banner: green if paid this month (shows "Pagamento em dia" + last payment date), yellow/red if pending

**Payment history:** list of payments for this subscription, each showing:
- Reference month (e.g., "Março 2026")
- Confirmation details (date, method)
- Amount (R$)

**Footer button:** "Confirmar pagamento" → navigates to `confirm-payment?subscriptionId=[id]`

### New Screen: Confirm Payment (`/(finances)/confirm-payment.tsx`)

**Header:** back button + title "Confirmar pagamento"

**Form fields (React Hook Form + Zod):**
- **Aluno** — ModalSelect listing students with active subscriptions (shows avatar + name + plan name). If `subscriptionId` query param is present, pre-selects the student and shows as read-only.
- **Valor (R$)** — auto-filled from the selected student's current plan `priceCents`, editable by manager
- **Mês de referência** — ModalSelect with recent months, defaults to current month (stored as YYYY-MM-01)
- **Observações** — optional text input (max 2000 chars)

**Footer button:** "Confirmar pagamento" → calls `POST /payments/` with `{ subscriptionId, amountCents, referenceMonth, notes }`.

After success: navigates back, invalidates `payments`, `financial-summary`, and `academy-subscriptions` queries. Shows success toast/alert.

## New Backend Endpoints

### `GET /subscriptions/academy` (Manager only)

Lists all student subscriptions for the academy, with user and plan data joined.

**Query params:**
- `status?` — filter by subscription status ("active", "expired", "cancelled")
- `planId?` — filter by specific plan
- `pendingPayment?` — boolean, if true returns only active subscriptions without a payment for the current month

**Response:**
```json
{
  "items": [
    {
      "subscription": { "id", "userId", "planId", "status", "startsAt", "expiresAt" },
      "plan": { "id", "name", "priceCents", "recurrenceMonths", ... },
      "user": { "id", "name", "email", "imageUrl" },
      "lastPayment": { "referenceMonth", "paidAt", "amountCents" } | null,
      "effectiveStatus": "active" | "expired" | "cancelled",
      "hasPaidCurrentMonth": boolean
    }
  ]
}
```

### `GET /subscriptions/academy/:subscriptionId` (Manager only)

Returns detailed subscription info for a specific student.

**Response:** same shape as a single item from the list above.

### `GET /finances/summary` (Manager only)

Returns aggregated financial data for the dashboard.

**Response:**
```json
{
  "revenueCurrentMonth": 18940,
  "revenuePreviousMonth": 16900,
  "pendingPaymentsCount": 3,
  "pendingPaymentsTotal": 1420,
  "activeSubscriptionsCount": 48
}
```

All monetary values in cents.

### `GET /payments/` (existing — needs `limit` query param)

The existing endpoint already supports `subscriptionId` filter. Add optional `limit` param for the dashboard's "last 10 payments" view.

## New Mobile Hooks

### `use-subscription-plans.ts`
- `useSubscriptionPlans()` — `GET /subscriptions/plans?includeInactive=true`
- `useSubscriptionPlan(planId)` — `GET /subscriptions/plans/:planId`
- `useCreatePlan()` — mutation `POST /subscriptions/plans`
- `useUpdatePlan(planId)` — mutation `PATCH /subscriptions/plans/:planId`

### `use-academy-subscriptions.ts`
- `useAcademySubscriptions(filter?)` — `GET /subscriptions/academy`
- `useAcademySubscription(subscriptionId)` — `GET /subscriptions/academy/:subscriptionId`

### `use-finances.ts`
- `useFinancialSummary()` — `GET /finances/summary`
- `usePaymentHistory(limit?)` — `GET /payments/?limit=10`
- `useConfirmPayment()` — mutation `POST /payments/`

## Navigation Structure

```
Tab Finanças → /(finances)/
  index.tsx                          → Dashboard (M-MGR-17)
  plans/
    index.tsx                        → Plans List (M-MGR-10)
    [planId].tsx                     → Plan Detail (M-MGR-11)
    create.tsx                       → Create Plan (M-MGR-12)
    edit/[planId].tsx                → Edit Plan (M-MGR-12)
  subscriptions/
    index.tsx                        → Subscriptions List (M-MGR-13)
    [subscriptionId].tsx             → Subscription Detail (M-MGR-14)
  confirm-payment.tsx                → Confirm Payment (new)
```

The "Finanças" tab in the bottom tab bar currently points to the manager home screen. It needs to be rewired to point to `/(finances)/`.

## File Changes Summary

**New files (mobile):**
- `apps/mobile/app/(app)/(manager)/(finances)/_layout.tsx`
- `apps/mobile/app/(app)/(manager)/(finances)/index.tsx`
- `apps/mobile/app/(app)/(manager)/(finances)/plans/index.tsx`
- `apps/mobile/app/(app)/(manager)/(finances)/plans/[planId].tsx`
- `apps/mobile/app/(app)/(manager)/(finances)/plans/create.tsx`
- `apps/mobile/app/(app)/(manager)/(finances)/plans/edit/[planId].tsx`
- `apps/mobile/app/(app)/(manager)/(finances)/subscriptions/index.tsx`
- `apps/mobile/app/(app)/(manager)/(finances)/subscriptions/[subscriptionId].tsx`
- `apps/mobile/app/(app)/(manager)/(finances)/confirm-payment.tsx`
- `apps/mobile/lib/hooks/use-subscription-plans.ts`
- `apps/mobile/lib/hooks/use-academy-subscriptions.ts`
- `apps/mobile/lib/hooks/use-finances.ts`

**New files (API):**
- `apps/api/src/modules/finance/finance.routes.ts`
- `apps/api/src/modules/finance/finance.service.ts`
- Updates to `apps/api/src/modules/subscription/subscription.routes.ts` (new academy endpoints)
- Updates to `apps/api/src/modules/subscription/subscription.service.ts`
- Updates to `apps/api/src/modules/subscription/subscription.repository.ts` (new interface methods)
- Updates to `apps/api/src/modules/subscription/subscription.repository.postgres.ts`
- Updates to `packages/validators/src/subscription.schema.ts` (new query schemas)

**Modified files:**
- `apps/mobile/app/(app)/(manager)/_layout.tsx` — rewire Finanças tab to `/(finances)/`
