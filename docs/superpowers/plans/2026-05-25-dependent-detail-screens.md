# Dependent Detail Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 3 missing screens navigable from the dependent detail quick-action grid: checkin history, subscription management, and payment history — all filtered by dependentId.

**Architecture:** New API endpoints for dependent-scoped queries (`/checkins/dependent/:id/history`, `/subscriptions/dependent/:id`, `/payments/dependent/:id`). New React Query hooks per endpoint. New mobile screens under both `(student)/(more)` and `(guardian)/(dependents)` stacks. Each screen mirrors its student equivalent but scoped to one dependent.

**Tech Stack:** Express (API), React Native / Expo (mobile), Drizzle ORM (Postgres), React Query (mobile data fetching), NativeWind (styling)

**Spec:** `docs/superpowers/specs/2026-05-22-guardian-dependents-screens.md` (screens 4, 8)
**Existing plan:** `docs/superpowers/plans/2026-05-24-guardian-dependents.md` (Tasks 18-19 related)

---

## Phase 1: Backend — New dependent-scoped API endpoints

### Task 1: Add dependent checkin history endpoint

**Files:**
- Modify: `apps/api/src/modules/checkin/checkin.repository.ts`
- Modify: `apps/api/src/modules/checkin/checkin.repository.postgres.ts`
- Modify: `apps/api/src/modules/checkin/checkin.repository.in-memory.ts`
- Modify: `apps/api/src/modules/checkin/checkin.service.ts`
- Modify: `apps/api/src/modules/checkin/checkin.routes.ts`

- [ ] **Step 1: Add `listByDependent` to checkin repository interface**

In `apps/api/src/modules/checkin/checkin.repository.ts`, add:

```typescript
listByDependent(
  dependentId: string,
  opts: { limit: number; cursor?: string },
): Promise<{ rows: CheckinRow[]; nextCursor: string | null }>;
```

- [ ] **Step 2: Implement in Postgres repository**

In `apps/api/src/modules/checkin/checkin.repository.postgres.ts`, implement `listByDependent`. Follow the same pattern as the existing `listByUser` method but filter on `checkins.dependentId` instead of `checkins.userId`. Include the same join on `classes` for class name and pagination via cursor.

- [ ] **Step 3: Implement in in-memory repository**

In `apps/api/src/modules/checkin/checkin.repository.in-memory.ts`, implement `listByDependent` filtering by `dependentId` in memory.

- [ ] **Step 4: Add `getHistoryForDependent` to checkin service**

In `apps/api/src/modules/checkin/checkin.service.ts`, add a method:

```typescript
async getHistoryForDependent(opts: {
  userId: string;
  role: Role;
  dependentId: string;
  limit: number;
  cursor?: string;
}) {
  // Validate ownership: guardian/student must own the dependent, manager must be in same academy
  // Then call this.checkinRepo.listByDependent(opts.dependentId, { limit, cursor })
  // Group by week same as getHistory does for the student
}
```

Use the `DependentService.assertGuardianOwnership` pattern or inline the ownership check. Reference how `getHistory` groups results by week.

- [ ] **Step 5: Add `GET /checkins/dependent/:dependentId/history` route**

In `apps/api/src/modules/checkin/checkin.routes.ts`, add:

```typescript
checkinRouter.get(
  "/dependent/:dependentId/history",
  authorize(Role.Student, Role.Guardian, Role.Manager),
  async (req, res, next) => {
    try {
      const auth = req.appAuth!;
      const { dependentId } = req.params;
      if (!dependentId) { res.status(400).json({ error: "dependentId required" }); return; }
      const cursor = req.query.cursor as string | undefined;
      const result = await checkinService.getHistoryForDependent({
        userId: auth.userId,
        role: auth.role,
        dependentId,
        limit: 20,
        cursor,
      });
      res.json(result);
    } catch (e) { next(e); }
  },
);
```

- [ ] **Step 6: Add `countByDependentCurrentWeek` to checkin service**

Add a method that returns the weekly checkin count for a specific dependent (for the subscription screen later). Reuse `countByDependentAndWeek` from the repository with current week reference.

- [ ] **Step 7: Add `GET /checkins/dependent/:dependentId/weekly-count` route**

```typescript
checkinRouter.get(
  "/dependent/:dependentId/weekly-count",
  authorize(Role.Student, Role.Guardian, Role.Manager),
  async (req, res, next) => {
    // Validate ownership, then return { count, weekReference }
  },
);
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/checkin/
git commit -m "feat(guardian): add dependent checkin history and weekly-count endpoints"
```

---

### Task 2: Add dependent subscription endpoint

**Files:**
- Modify: `apps/api/src/modules/subscription/subscription.repository.ts`
- Modify: `apps/api/src/modules/subscription/subscription.repository.postgres.ts`
- Modify: `apps/api/src/modules/subscription/subscription.repository.in-memory.ts`
- Modify: `apps/api/src/modules/subscription/subscription.routes.ts`

- [ ] **Step 1: Add `findByDependentId` to subscription repository interface**

In `subscription.repository.ts`, add:

```typescript
findByDependentId(dependentId: string): Promise<StudentSubscriptionRow | undefined>;
```

- [ ] **Step 2: Implement in Postgres repository**

Query `student_subscriptions` where `dependentId = :dependentId` and status is not cancelled, ordered by `createdAt` desc, limit 1.

- [ ] **Step 3: Implement in in-memory repository**

Filter in-memory array by `dependentId`.

- [ ] **Step 4: Add `GET /subscriptions/dependent/:dependentId` route**

Returns the same shape as `GET /subscriptions/me` but for a dependent: `{ subscription, plan, academyPlan }`. Validate that the requesting user (guardian/student) owns the dependent.

Reference the existing `GET /subscriptions/me` handler for the response format. Look up `subscription.planId` to get the plan, and look up the academy's manager subscription to get `academyPlan`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/subscription/
git commit -m "feat(guardian): add dependent subscription endpoint"
```

---

### Task 3: Add dependent payment history endpoint

**Files:**
- Modify: `apps/api/src/modules/payment/payment.repository.ts`
- Modify: `apps/api/src/modules/payment/payment.repository.postgres.ts`
- Modify: `apps/api/src/modules/payment/payment.repository.in-memory.ts`
- Modify: `apps/api/src/modules/payment/payment.routes.ts`

- [ ] **Step 1: Add `findByDependentId` to payment repository interface**

In `payment.repository.ts`, add:

```typescript
findByDependentId(dependentId: string): Promise<PaymentRow[]>;
```

- [ ] **Step 2: Implement in Postgres repository**

Query `payments` where `dependentId = :dependentId`, ordered by `paidAt` desc.

- [ ] **Step 3: Implement in in-memory repository**

Filter in-memory array by `dependentId`.

- [ ] **Step 4: Add `GET /payments/dependent/:dependentId` route**

Returns `PaymentRow[]` for the dependent. Validate ownership (guardian/student owns the dependent). Allow `Role.Student`, `Role.Guardian`, `Role.Manager`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/payment/
git commit -m "feat(guardian): add dependent payment history endpoint"
```

---

## Phase 2: Mobile — New hooks

### Task 4: Create dependent-scoped React Query hooks

**Files:**
- Modify: `apps/mobile/lib/hooks/use-dependents.ts`

- [ ] **Step 1: Add checkin history hook**

```typescript
export function useDependentCheckinHistory(dependentId: string | null) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: ["checkins", dependentId, "history"],
    queryFn: ({ pageParam }) =>
      api.get<CheckinHistoryResponse>(
        `/checkins/dependent/${dependentId}/history${pageParam ? `?cursor=${pageParam}` : ""}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!dependentId,
  });
}
```

Use the same `CheckinHistoryResponse` type as `useCheckinHistory` in `use-checkin.ts`. Import `useInfiniteQuery` from `@tanstack/react-query`.

- [ ] **Step 2: Add weekly checkin count hook**

```typescript
export function useDependentWeeklyCheckinCount(dependentId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["checkins", dependentId, "weekly-count"],
    queryFn: () => api.get<{ count: number; weekReference: string }>(
      `/checkins/dependent/${dependentId}/weekly-count`,
    ),
    enabled: !!dependentId,
  });
}
```

- [ ] **Step 3: Add subscription hook**

```typescript
export function useDependentSubscription(dependentId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["subscription", dependentId],
    queryFn: () => api.get<MySubscriptionResponse>(
      `/subscriptions/dependent/${dependentId}`,
    ),
    enabled: !!dependentId,
  });
}
```

Use the same `MySubscriptionResponse` type as in `use-subscription.ts`.

- [ ] **Step 4: Add payment history hook**

```typescript
export function useDependentPayments(dependentId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["payments", dependentId],
    queryFn: () => api.get<PaymentItem[]>(
      `/payments/dependent/${dependentId}`,
    ),
    enabled: !!dependentId,
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/hooks/use-dependents.ts
git commit -m "feat(guardian): add dependent-scoped checkin, subscription, and payment hooks"
```

---

## Phase 3: Mobile — New screens (student stack)

### Task 5: Create dependent checkin history screen (student)

**Files:**
- Create: `apps/mobile/app/(app)/(student)/(more)/dependent-checkin-history.tsx`
- Modify: `apps/mobile/app/(app)/(student)/(more)/_layout.tsx`

- [ ] **Step 1: Create the screen**

Mirror the structure of `apps/mobile/app/(app)/(student)/(subscription)/checkin-history.tsx` but:
- Read `dependentId` from `useLocalSearchParams<{ dependentId: string }>()`
- Use `useDependentCheckinHistory(dependentId)` instead of `useCheckinHistory()`
- Also call `useDependent(dependentId)` to show the dependent's name in the header: "Check-ins de {name}"
- Same weekly grouping, infinite scroll, pull-to-refresh, empty state

- [ ] **Step 2: Register in layout**

In `apps/mobile/app/(app)/(student)/(more)/_layout.tsx`, add:

```typescript
<Stack.Screen name="dependent-checkin-history" />
```

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(app)/(student)/(more)/"
git commit -m "feat(guardian): add dependent checkin history screen for students"
```

---

### Task 6: Create dependent subscription screen (student)

**Files:**
- Create: `apps/mobile/app/(app)/(student)/(more)/dependent-subscription.tsx`
- Modify: `apps/mobile/app/(app)/(student)/(more)/_layout.tsx`

- [ ] **Step 1: Create the screen**

Mirror the structure of `apps/mobile/app/(app)/(student)/(subscription)/index.tsx` but:
- Read `dependentId` from `useLocalSearchParams<{ dependentId: string }>()`
- Use `useDependentSubscription(dependentId)` instead of `useMySubscription()`
- Use `useDependentWeeklyCheckinCount(dependentId)` instead of `useWeeklyCheckinCount()`
- Use `useDependentPayments(dependentId)` instead of `useMyPayments()`
- Header: "Assinatura de {name}" (using `useDependent` for the name)
- "Alterar plano" navigates to the existing plans screen with `dependentId` param: `router.push({ pathname: "/(app)/(student)/(subscription)/plans", params: { dependentId } })`
- If no subscription, show "Escolher plano" button that navigates the same way
- Payment buttons (PIX/card) should pass `dependentId` context — check if the existing checkout hooks/endpoints support this. If not, show a note that payment is done via the guardian's subscription management

- [ ] **Step 2: Register in layout**

In `apps/mobile/app/(app)/(student)/(more)/_layout.tsx`, add:

```typescript
<Stack.Screen name="dependent-subscription" />
```

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(app)/(student)/(more)/"
git commit -m "feat(guardian): add dependent subscription screen for students"
```

---

### Task 7: Create dependent payment history screen (student)

**Files:**
- Create: `apps/mobile/app/(app)/(student)/(more)/dependent-payment-history.tsx`
- Modify: `apps/mobile/app/(app)/(student)/(more)/_layout.tsx`

- [ ] **Step 1: Create the screen**

Simpler screen showing a flat list of payments:
- Read `dependentId` from `useLocalSearchParams<{ dependentId: string }>()`
- Use `useDependentPayments(dependentId)` for the data
- Use `useDependent(dependentId)` for the name in header: "Pagamentos de {name}"
- Each payment row shows: referenceMonth (formatted as "Jan 2026"), amountCents (formatted as "R$ 120,00"), method (PIX/card), paidAt date
- Pull-to-refresh, empty state: "Nenhum pagamento registrado"

Format helpers (inline, same as subscription screen):
```typescript
function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function formatMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
```

- [ ] **Step 2: Register in layout**

In `apps/mobile/app/(app)/(student)/(more)/_layout.tsx`, add:

```typescript
<Stack.Screen name="dependent-payment-history" />
```

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(app)/(student)/(more)/"
git commit -m "feat(guardian): add dependent payment history screen for students"
```

---

## Phase 4: Mobile — Wire up navigation from detail screens

### Task 8: Update dependent detail screens with navigation

**Files:**
- Modify: `apps/mobile/app/(app)/(student)/(more)/dependent-detail.tsx`
- Modify: `apps/mobile/app/(app)/(guardian)/(dependents)/[dependentId].tsx`

- [ ] **Step 1: Update student dependent detail TODO actions**

In `apps/mobile/app/(app)/(student)/(more)/dependent-detail.tsx`, replace the 3 TODO handlers:

```typescript
const quickActions: QuickAction[] = [
  {
    icon: <CalendarDays size={22} color="#A078E8" />,
    label: "Histórico de check-ins",
    onPress: () =>
      router.push(`/(app)/(student)/(more)/dependent-checkin-history?dependentId=${id}`),
  },
  {
    icon: <CreditCard size={22} color="#A078E8" />,
    label: "Assinatura",
    onPress: () =>
      router.push(`/(app)/(student)/(more)/dependent-subscription?dependentId=${id}`),
  },
  {
    icon: <History size={22} color="#A078E8" />,
    label: "Histórico de pagamentos",
    onPress: () =>
      router.push(`/(app)/(student)/(more)/dependent-payment-history?dependentId=${id}`),
  },
  {
    icon: <Pencil size={22} color="#A078E8" />,
    label: "Editar",
    onPress: () =>
      router.push(`/(app)/(student)/(more)/edit-dependent?id=${id}`),
  },
];
```

- [ ] **Step 2: Update guardian dependent detail TODO actions**

In `apps/mobile/app/(app)/(guardian)/(dependents)/[dependentId].tsx`, replace the same 3 TODOs. The guardian navigates to the same screens but under the guardian route group. Since guardian doesn't have these screens yet under its own group, navigate to the student group or create aliases.

Simplest approach: create the screens under guardian too (Tasks 9-11 below), or have guardian navigate to `/(app)/(student)/(more)/` routes. Decide based on whether the guardian has the `(more)` stack. If not, create minimal wrapper screens under `(guardian)/(dependents)/`.

For now, navigate using full paths:

```typescript
onPress: () =>
  router.push(`/(app)/(guardian)/(dependents)/checkin-history?dependentId=${dependentId}`),
```

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(app)/(student)/(more)/dependent-detail.tsx" "apps/mobile/app/(app)/(guardian)/(dependents)/[dependentId].tsx"
git commit -m "feat(guardian): wire up dependent detail quick actions to new screens"
```

---

## Phase 5: Mobile — Guardian-side screens

### Task 9: Create dependent screens under guardian group

**Files:**
- Create: `apps/mobile/app/(app)/(guardian)/(dependents)/checkin-history.tsx`
- Create: `apps/mobile/app/(app)/(guardian)/(dependents)/subscription.tsx`
- Create: `apps/mobile/app/(app)/(guardian)/(dependents)/payment-history.tsx`
- Modify: `apps/mobile/app/(app)/(guardian)/(dependents)/_layout.tsx` (if it exists, register screens)

- [ ] **Step 1: Create guardian checkin history screen**

Same as `dependent-checkin-history.tsx` from Task 5 but reading `dependentId` from query params. Can be a copy or a shared component — follow the project pattern of duplicating screens per role group.

- [ ] **Step 2: Create guardian subscription screen**

Same as `dependent-subscription.tsx` from Task 6.

- [ ] **Step 3: Create guardian payment history screen**

Same as `dependent-payment-history.tsx` from Task 7.

- [ ] **Step 4: Register in guardian dependents layout**

Check if `apps/mobile/app/(app)/(guardian)/(dependents)/_layout.tsx` exists. If so, add `Stack.Screen` entries for the 3 new screens. If not, create it as a Stack navigator.

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(app)/(guardian)/(dependents)/"
git commit -m "feat(guardian): add dependent checkin, subscription, and payment screens for guardians"
```

---

## Phase 6: Populate dependent detail quick info

### Task 10: Show real data in dependent detail quick info section

**Files:**
- Modify: `apps/mobile/app/(app)/(student)/(more)/dependent-detail.tsx`
- Modify: `apps/mobile/app/(app)/(guardian)/(dependents)/[dependentId].tsx`

- [ ] **Step 1: Add hooks to student dependent detail**

Import and call `useDependentSubscription`, `useDependentWeeklyCheckinCount` (or a monthly count if that's what's displayed — the screen says "Check-ins este mês"). Replace the hardcoded "Sem plano", "—", "—" with real data:

```typescript
const { data: subData } = useDependentSubscription(id);
// Show plan name or "Sem plano"
// Show checkins count
// Show last checkin date
```

- [ ] **Step 2: Same for guardian dependent detail**

Apply the same changes to the guardian version.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(app)/(student)/(more)/dependent-detail.tsx" "apps/mobile/app/(app)/(guardian)/(dependents)/[dependentId].tsx"
git commit -m "feat(guardian): show real subscription and checkin data in dependent detail"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1–3 | Backend: dependent-scoped API endpoints (checkin history, subscription, payments) |
| 2 | 4 | Mobile: React Query hooks for dependent-scoped data |
| 3 | 5–7 | Mobile: new screens under student (more) stack |
| 4 | 8 | Mobile: wire up navigation from dependent detail |
| 5 | 9 | Mobile: duplicate screens under guardian group |
| 6 | 10 | Mobile: populate quick info section with real data |
