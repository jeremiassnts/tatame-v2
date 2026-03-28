# Student Financial Screens Design

## Overview

Implement the student-facing financial screens: subscription management, plan browsing/selection, payment history, and check-in history. Also restructure navigation so the "Academia" tab becomes "Assinatura" for students, and academy info is accessible only from the home screen card (for both students and instructors).

## Design References

- M-STU-08 (At2zo): Subscription Plans list
- M-STU-09 (LIpc2): Plan Detail with selection
- M-STU-10 (YYbfl): My Subscription (main tab screen)
- M-STU-11 (9IxiV): Check-in History

## Navigation Changes

### Student Tabs (before → after)

| Tab | Before | After |
|-----|--------|-------|
| 1 | Início | Início (unchanged) |
| 2 | Membros | Membros (unchanged) |
| 3 | Agenda | Agenda (unchanged) |
| 4 | Academia | **Assinatura** |

### Student Route Structure

```
/(app)/(student)/
  ├─ (home)/
  │   ├─ index.tsx              — Home (add onPress to subscription card → /(subscription)/)
  │   └─ academy-info.tsx       — Academy info (moved from tab, accessed via home card)
  ├─ (members)/index.tsx
  ├─ (classes)/index.tsx
  └─ (subscription)/            — NEW: replaces (academy) tab
      ├─ _layout.tsx            — Stack navigator (slide_from_right, headerShown: false)
      ├─ index.tsx              — M-STU-10 "Minha assinatura" (redirects to plans/ if no active subscription)
      ├─ plans/index.tsx        — M-STU-08 "Planos de assinatura"
      ├─ plans/[planId].tsx     — M-STU-09 "Detalhes do plano"
      └─ checkin-history.tsx    — M-STU-11 "Histórico de check-ins"
```

### Instructor Changes

- Remove "Academia" tab from instructor `_layout.tsx`
- Academy info screen accessible only from the home screen's academy card (same pattern as student)

### Home → Subscription Navigation

The existing subscription card on the student home screen gets an `onPress` handler that navigates to `/(subscription)/`.

## API Changes

### New Endpoint: `GET /checkins/me/weekly-count`

Returns the student's check-in count for the current week.

- **Auth:** Student, Instructor
- **Response:**
  ```typescript
  {
    count: number,
    weekReference: string // ISO date of Monday, e.g. "2026-03-23"
  }
  ```
- **Implementation:** Uses existing `CheckinRepository.countByUserAndWeek()`. Calculates current week's Monday on the server side.

### New Endpoint: `GET /checkins/me/history`

Returns the student's check-in history grouped by week, with cursor-based pagination.

- **Auth:** Student, Instructor
- **Query params:** `{ cursor?: string, limit?: number }`
  - `cursor`: `weekReference` of the last loaded week (for pagination)
  - `limit`: number of weeks to return (default: 4)
- **Response:**
  ```typescript
  {
    items: Array<{
      weekReference: string,     // "2026-03-17"
      weekLabel: string,         // "17–23 mar 2026"
      count: number,
      checkins: Array<{
        id: string,
        className: string,       // "No-Gi", "Jiu-Jitsu Gi"
        date: string,            // "2026-03-20"
        dayOfWeek: string,       // "Qui"
        time: string,            // "18:35"
      }>
    }>,
    nextCursor: string | null
  }
  ```
- **Implementation:** New method `findByUserGroupedByWeek(userId, cursor, limit)` in `CheckinRepository`. JOINs with `classes` table to get class name and scheduled time.

### Modified Endpoint: `POST /subscriptions/me/plan`

Adjusted behavior for plan changes:

1. If student has an active subscription → mark it as `cancelled` with `cancelledAt = now`
2. Create a new subscription with:
   - `planId` = selected plan
   - `startDate` = today
   - `expirationDate` = today + plan.recurrenceMonths
   - `status` = active
3. Return the new subscription

This preserves subscription history for the student.

### New Hook: `useMyPayments()`

For `GET /payments/me`. Returns the student's payment history. The endpoint already exists, only the mobile hook is missing.

### New Hook: `useWeeklyCheckinCount()`

For `GET /checkins/me/weekly-count`. Simple query hook.

### New Hook: `useCheckinHistory()`

For `GET /checkins/me/history`. Uses `useInfiniteQuery` with cursor-based pagination via `nextCursor`.

## Screen Specifications

### M-STU-10 — Minha Assinatura (`(subscription)/index.tsx`)

**Data:** `useMySubscription()`, `useWeeklyCheckinCount()`, `useMyPayments()`

**Redirect logic:** If `useMySubscription()` returns no active subscription → `router.replace('/(subscription)/plans/')`.

**Layout (top to bottom):**
1. **Header:** Back button + "Minha assinatura"
2. **Plan card:** Plan name, "R$ {price} / mês", badge "Ativa" (green), start date, expiration date
3. **Check-ins card:** "Check-ins esta semana" + "{count}/{limit}" (or "{count}/Ilimitado"), tappable → navigates to `checkin-history`
4. **Payments section:** "Pagamentos" header, list of recent payments (date, plan name + "mensal", amount in red "R$ X,XX")
5. **Footer info:** Calendar icon + "Próximo pagamento: {next date} · R$ {amount}"

**Actions:**
- Tap check-ins card → navigate to `checkin-history`
- Button/link "Trocar plano" or plan card tap → navigate to `plans/`

### M-STU-08 — Planos de Assinatura (`(subscription)/plans/index.tsx`)

**Data:** `useSubscriptionPlans()`, `useMySubscription()`

**Layout:**
1. **Header:** Back button + "Planos de assinatura"
2. **Subtitle:** "Escolha o plano ideal para você"
3. **Plan cards list:** Each card shows:
   - Plan name
   - Badge "Atual" (if current plan) or "Popular" (hardcoded for the unlimited plan, or based on a new `isPopular` boolean column on the plans table)
   - Price "R$ {price} / mês"
   - Check-ins: "{weeklyCheckinLimit} check-ins por semana" or "Ilimitado"
   - Chevron right → navigate to `plans/[planId]`
   - Current plan card has purple/highlighted border

### M-STU-09 — Detalhes do Plano (`(subscription)/plans/[planId].tsx`)

**Data:** `useSubscriptionPlan(planId)`, `useMySubscription()`

**Layout:**
1. **Header:** Back button + "Detalhes do plano"
2. **Plan name** (large text)
3. **Price:** "R$ {price}" large + "/ mês" smaller
4. **Check-in info:** Clock icon + "{limit} check-ins por semana"
5. **Features list** (icon + text for each):
   - Renovação mensal automática
   - {limit} check-ins por semana
   - Expira {recurrenceMonths * 30} dias após ativação
6. **Info box** (shown if user has active subscription on a different plan): "Você está no {current plan name}. Ao selecionar este plano, sua assinatura será atualizada imediatamente."
7. **CTA button:** "Selecionar este plano" (full-width, purple). Disabled if already on this plan.

**Action:** Tap CTA → Alert confirmation → call `POST /subscriptions/me/plan` → on success, invalidate subscription queries, navigate back to index.

### M-STU-11 — Histórico de Check-ins (`(subscription)/checkin-history.tsx`)

**Data:** `useCheckinHistory()` (infinite query)

**Layout:**
1. **Header:** Back button + "Histórico de check-ins"
2. **SectionList** grouped by week:
   - **Section header:** "{weekLabel}" + "{count} check-ins" (right-aligned)
   - **Items:** Green dot + class name (bold) + "{dayOfWeek}, {date} · {time}" (gray subtitle)
3. **Infinite scroll:** `onEndReached` loads next page via `fetchNextPage()`
4. **Empty state:** Message if no check-ins recorded

## Existing Code Reuse

- **Stack layout pattern:** Copy from `(finances)/_layout.tsx`
- **Card patterns:** Reuse StatCard, existing card styles from manager finance screens
- **FilterTabs:** Not needed for these screens
- **BackButton:** Existing component
- **ModalSelect:** Not needed
- **FormInput:** Not needed (no forms in student financial screens)
- **Currency formatting:** Reuse the `formatCurrency` pattern from manager screens (cents → "R$ X.XXX,XX")
- **Date formatting:** Reuse existing date format patterns with pt-BR locale

## Out of Scope

- Payment processing/gateway integration (payments are confirmed manually by the manager)
- Push notifications for payment reminders
- Plan creation/editing (manager-only feature, already implemented)
- Subscription cancellation by student (not in the designs)
