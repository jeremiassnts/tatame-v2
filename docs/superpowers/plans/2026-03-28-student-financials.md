# Student Financial Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 student financial screens (My Subscription, Plans List, Plan Detail, Check-in History), restructure student/instructor navigation to replace Academia tab, and add the API endpoints for check-in history and weekly count.

**Architecture:** Express REST API with service/repository pattern for two new check-in endpoints. React Native screens with Expo Router file-based routing, TanStack React Query v5 hooks. The student tab "Academia" becomes "Assinatura" with a stack navigator. Academy info moves to home screen navigation for both student and instructor.

**Tech Stack:** TypeScript, Express, Drizzle ORM, PostgreSQL, React Native, Expo Router, TanStack React Query v5, NativeWind/Tailwind, Zod

---

## File Map

### API (new/modified)

| File | Action | Purpose |
|------|--------|---------|
| `packages/validators/src/checkin.schema.ts` | Modify | Add `checkinHistoryQuerySchema` and `weeklyCheckinCountResponseSchema` |
| `packages/validators/src/index.ts` | Modify | Re-export new checkin schemas |
| `apps/api/src/modules/checkin/checkin.repository.ts` | Modify | Add `findByUserGroupedByWeek` interface method |
| `apps/api/src/modules/checkin/checkin.repository.postgres.ts` | Modify | Implement `findByUserGroupedByWeek` with Drizzle |
| `apps/api/src/modules/checkin/checkin.service.ts` | Modify | Add `getWeeklyCount` and `getHistory` methods |
| `apps/api/src/modules/checkin/checkin.routes.ts` | Modify | Add `GET /checkins/me/weekly-count` and `GET /checkins/me/history` |

### Mobile (new)

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/app/(app)/(student)/(subscription)/_layout.tsx` | Create | Stack navigator for subscription screens |
| `apps/mobile/app/(app)/(student)/(subscription)/index.tsx` | Create | M-STU-10: My Subscription screen |
| `apps/mobile/app/(app)/(student)/(subscription)/plans/index.tsx` | Create | M-STU-08: Plans list screen |
| `apps/mobile/app/(app)/(student)/(subscription)/plans/[planId].tsx` | Create | M-STU-09: Plan detail screen |
| `apps/mobile/app/(app)/(student)/(subscription)/checkin-history.tsx` | Create | M-STU-11: Check-in history screen |
| `apps/mobile/lib/hooks/use-checkin.ts` | Modify | Add `useWeeklyCheckinCount` and `useCheckinHistory` hooks |
| `apps/mobile/lib/hooks/use-subscription.ts` | Modify | Add `useMyPayments` and `useSelectPlan` hooks |

### Mobile (modified)

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/app/(app)/(student)/_layout.tsx` | Modify | Replace Academia tab with Assinatura, add academy-info route |
| `apps/mobile/app/(app)/(student)/(home)/index.tsx` | Modify | Add onPress to subscription card + academy card navigation |
| `apps/mobile/app/(app)/(student)/(home)/academy-info.tsx` | Create | Academy info accessible from home |
| `apps/mobile/app/(app)/(instructor)/_layout.tsx` | Modify | Remove Academia tab, add academy-info route |
| `apps/mobile/app/(app)/(instructor)/(home)/academy-info.tsx` | Create | Academy info accessible from instructor home |
| `apps/mobile/app/(app)/(instructor)/(home)/index.tsx` | Modify | Add onPress to academy card |

### Deleted

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/app/(app)/(student)/(academy)/` | Delete | No longer a tab — moved to `(home)/academy-info.tsx` |
| `apps/mobile/app/(app)/(instructor)/(academy)/` | Delete | Same — moved to `(home)/academy-info.tsx` |

---

## Note: POST /subscriptions/me/plan already works

The spec mentions modifying this endpoint to "cancel old + create new subscription". The existing `SubscriptionService.selectPlan()` already calls `replaceActiveSubscriptionForAcademy()` which does exactly this in a transaction: cancels active subscription, creates a new one with fresh dates. **No API changes needed for plan selection.**

---

## Task 1: Add checkin validator schemas

**Files:**
- Modify: `packages/validators/src/checkin.schema.ts`
- Modify: `packages/validators/src/index.ts`

- [x] **Step 1: Add schemas to checkin.schema.ts**

Add to the end of `packages/validators/src/checkin.schema.ts`:

```typescript
export const checkinHistoryQuerySchema = z.object({
  cursor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 4)),
});

export type CheckinHistoryQuery = z.infer<typeof checkinHistoryQuerySchema>;
```

- [x] **Step 2: Export new schemas from index.ts**

In `packages/validators/src/index.ts`, update the checkin export block to include:

```typescript
export {
  checkinHistoryQuerySchema,
  checkinResponseSchema,
  createCheckinBodySchema,
  createCheckinResponseSchema,
  type CheckinHistoryQuery,
  type CreateCheckinBody,
  type CreateCheckinResponse,
} from "./checkin.schema.js";
```

- [x] **Step 3: Verify build**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/validators build`
Expected: Build succeeds

- [x] **Step 4: Commit**

```bash
git add packages/validators/src/checkin.schema.ts packages/validators/src/index.ts
git commit -m "feat(validators): add checkin history query schema"
```

---

## Task 2: Extend checkin repository with history query

**Files:**
- Modify: `apps/api/src/modules/checkin/checkin.repository.ts`
- Modify: `apps/api/src/modules/checkin/checkin.repository.postgres.ts`

- [x] **Step 1: Add interface methods to checkin.repository.ts**

Add to the `ICheckinRepository` interface and add new types at the top:

```typescript
import type { InferSelectModel } from "drizzle-orm";
import type { checkins } from "@tatame/db";

export type CheckinRow = InferSelectModel<typeof checkins>;

export type CheckinHistoryItem = {
  id: string;
  className: string;
  date: string;
  startTime: string;
};

export interface ICheckinRepository {
  countByClassAndDate(classId: string, sessionDate: string): Promise<number>;

  countByUserAndWeek(userId: string, weekReference: string): Promise<number>;

  insert(data: {
    classId: string;
    userId: string;
    date: string;
    weekReference: string;
  }): Promise<CheckinRow>;

  findByUserWithClass(
    userId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<CheckinHistoryItem[]>;
}
```

- [x] **Step 2: Implement findByUserWithClass in PostgresCheckinRepository**

Add at the end of the `PostgresCheckinRepository` class in `checkin.repository.postgres.ts`:

```typescript
import { and, count, desc, eq, lt } from "drizzle-orm";
import { checkins, classes, type Database } from "@tatame/db";
import type {
  CheckinHistoryItem,
  CheckinRow,
  ICheckinRepository,
} from "./checkin.repository.js";

// ... existing class methods ...

  async findByUserWithClass(
    userId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<CheckinHistoryItem[]> {
    const conditions = [eq(checkins.userId, userId)];
    if (opts.cursor) {
      conditions.push(lt(checkins.weekReference, opts.cursor));
    }

    const rows = await this.db
      .select({
        id: checkins.id,
        date: checkins.date,
        weekReference: checkins.weekReference,
        className: classes.name,
        startTime: classes.startTime,
      })
      .from(checkins)
      .innerJoin(classes, eq(checkins.classId, classes.id))
      .where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      .orderBy(desc(checkins.date))
      .limit(opts.limit);

    return rows.map((r) => ({
      id: r.id,
      className: r.className,
      date: r.date.slice(0, 10),
      startTime: r.startTime,
    }));
  }
```

Note: The `limit` here will be computed by the service (number of weeks * reasonable per-week max) — the service does the grouping.

- [x] **Step 3: Verify TypeScript compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter api exec tsc --noEmit`
Expected: No type errors

- [x] **Step 4: Commit**

```bash
git add apps/api/src/modules/checkin/checkin.repository.ts apps/api/src/modules/checkin/checkin.repository.postgres.ts
git commit -m "feat(api): add findByUserWithClass to checkin repository"
```

---

## Task 3: Add checkin service methods for weekly count and history

**Files:**
- Modify: `apps/api/src/modules/checkin/checkin.service.ts`

- [x] **Step 1: Add getWeeklyCount method**

Add to the `CheckinService` class (after the existing `checkIn` method):

```typescript
  async getWeeklyCount(userId: string): Promise<{
    count: number;
    weekReference: string;
  }> {
    const today = utcTodayDateString();
    const weekRef = mondayOfWeekContaining(today);
    const count = await this.checkinRepo.countByUserAndWeek(userId, weekRef);
    return { count, weekReference: weekRef };
  }
```

Note: `utcTodayDateString` is already imported from `../subscription/subscription.service.js` and `mondayOfWeekContaining` is already defined in this file.

- [x] **Step 2: Add getHistory method**

Add below `getWeeklyCount`:

```typescript
  async getHistory(
    userId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{
    items: Array<{
      weekReference: string;
      weekLabel: string;
      count: number;
      checkins: Array<{
        id: string;
        className: string;
        date: string;
        dayOfWeek: string;
        time: string;
      }>;
    }>;
    nextCursor: string | null;
  }> {
    const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const MONTH_NAMES = [
      "jan", "fev", "mar", "abr", "mai", "jun",
      "jul", "ago", "set", "out", "nov", "dez",
    ];

    // Fetch more rows than needed — we'll group by week and trim.
    const rawItems = await this.checkinRepo.findByUserWithClass(userId, {
      cursor: opts.cursor,
      limit: opts.limit * 20, // generous per-week fetch
    });

    // Group by weekReference
    const weekMap = new Map<
      string,
      Array<{ id: string; className: string; date: string; startTime: string }>
    >();
    for (const item of rawItems) {
      const weekRef = mondayOfWeekContaining(item.date);
      let arr = weekMap.get(weekRef);
      if (!arr) {
        arr = [];
        weekMap.set(weekRef, arr);
      }
      arr.push(item);
    }

    // Sort weeks descending, take `limit` weeks
    const sortedWeeks = [...weekMap.keys()].sort((a, b) => b.localeCompare(a));
    const selectedWeeks = sortedWeeks.slice(0, opts.limit);
    const nextCursor =
      sortedWeeks.length > opts.limit ? sortedWeeks[opts.limit]! : null;

    function formatWeekLabel(monday: string): string {
      const parts = monday.split("-").map(Number);
      const y = parts[0] ?? 0;
      const m = parts[1] ?? 1;
      const d = parts[2] ?? 1;
      const start = new Date(Date.UTC(y, m - 1, d));
      const end = new Date(Date.UTC(y, m - 1, d + 6));
      const startDay = start.getUTCDate();
      const endDay = end.getUTCDate();
      const endMonth = MONTH_NAMES[end.getUTCMonth()]!;
      const endYear = end.getUTCFullYear();
      return `${startDay}–${endDay} ${endMonth} ${endYear}`;
    }

    function formatTime(t: string): string {
      const p = t.split(":");
      return `${(p[0] ?? "0").padStart(2, "0")}:${p[1] ?? "00"}`;
    }

    const items = selectedWeeks.map((weekRef) => {
      const checkins = weekMap.get(weekRef) ?? [];
      return {
        weekReference: weekRef,
        weekLabel: formatWeekLabel(weekRef),
        count: checkins.length,
        checkins: checkins.map((c) => {
          const p = c.date.split("-").map(Number);
          const dt = new Date(Date.UTC(p[0] ?? 0, (p[1] ?? 1) - 1, p[2] ?? 1));
          return {
            id: c.id,
            className: c.className,
            date: c.date,
            dayOfWeek: DAY_NAMES[dt.getUTCDay()]!,
            time: formatTime(c.startTime),
          };
        }),
      };
    });

    return { items, nextCursor };
  }
```

- [x] **Step 3: Verify TypeScript compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter api exec tsc --noEmit`
Expected: No type errors

- [x] **Step 4: Commit**

```bash
git add apps/api/src/modules/checkin/checkin.service.ts
git commit -m "feat(api): add weekly count and history methods to checkin service"
```

---

## Task 4: Add checkin API routes

**Files:**
- Modify: `apps/api/src/modules/checkin/checkin.routes.ts`

- [x] **Step 1: Add imports**

Add to existing imports at the top of `checkin.routes.ts`:

```typescript
import type { CheckinHistoryQuery } from "@tatame/validators";
import { checkinHistoryQuerySchema, createCheckinBodySchema } from "@tatame/validators";
```

(Replace the existing `createCheckinBodySchema` import line.)

- [x] **Step 2: Add GET /me/weekly-count route**

Add **before** the existing `POST /` route (Express matches routes in order, and `/me/weekly-count` must not be captured by a parameterized route):

```typescript
checkinRouter.get(
  "/me/weekly-count",
  authorize(Role.Student, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const userId = req.appAuth!.userId;
      const result = await checkinService.getWeeklyCount(userId);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);
```

- [x] **Step 3: Add GET /me/history route**

Add after the weekly-count route:

```typescript
checkinRouter.get(
  "/me/history",
  authorize(Role.Student, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const query = checkinHistoryQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Invalid query");
      }
      const userId = req.appAuth!.userId;
      const result = await checkinService.getHistory(userId, {
        cursor: query.data.cursor,
        limit: query.data.limit,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);
```

- [x] **Step 4: Verify TypeScript compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter api exec tsc --noEmit`
Expected: No type errors

- [x] **Step 5: Commit**

```bash
git add apps/api/src/modules/checkin/checkin.routes.ts
git commit -m "feat(api): add GET /checkins/me/weekly-count and /me/history endpoints"
```

---

## Task 5: Add mobile hooks (useWeeklyCheckinCount, useCheckinHistory, useMyPayments, useSelectPlan)

**Files:**
- Modify: `apps/mobile/lib/hooks/use-checkin.ts`
- Modify: `apps/mobile/lib/hooks/use-subscription.ts`

- [x] **Step 1: Add useWeeklyCheckinCount and useCheckinHistory to use-checkin.ts**

Append to the end of `apps/mobile/lib/hooks/use-checkin.ts`:

```typescript
type WeeklyCheckinCountResponse = {
  count: number;
  weekReference: string;
};

export function useWeeklyCheckinCount() {
  const api = useApi();

  return useQuery({
    queryKey: ["checkins", "me", "weekly-count"],
    queryFn: () =>
      api.get<WeeklyCheckinCountResponse>("/checkins/me/weekly-count"),
  });
}

type CheckinHistoryWeek = {
  weekReference: string;
  weekLabel: string;
  count: number;
  checkins: Array<{
    id: string;
    className: string;
    date: string;
    dayOfWeek: string;
    time: string;
  }>;
};

type CheckinHistoryResponse = {
  items: CheckinHistoryWeek[];
  nextCursor: string | null;
};

export function useCheckinHistory() {
  const api = useApi();

  return useInfiniteQuery({
    queryKey: ["checkins", "me", "history"],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set("cursor", pageParam);
      const qs = params.toString();
      return api.get<CheckinHistoryResponse>(
        `/checkins/me/history${qs ? `?${qs}` : ""}`,
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
```

Also add `useInfiniteQuery` to the imports at the top:

```typescript
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
```

- [x] **Step 2: Add useMyPayments and useSelectPlan to use-subscription.ts**

Append to the end of `apps/mobile/lib/hooks/use-subscription.ts`:

```typescript
type PaymentItem = {
  id: string;
  subscriptionId: string;
  userId: string;
  academyId: string;
  amountCents: number;
  method: string;
  confirmedBy: string | null;
  referenceMonth: string;
  notes: string | null;
  paidAt: string;
  createdAt: string;
};

type PaymentsResponse = { items: PaymentItem[] };

export function useMyPayments() {
  const api = useApi();

  return useQuery({
    queryKey: ["payments", "me"],
    queryFn: () => api.get<PaymentsResponse>("/payments/me"),
    select: (data) => data.items,
  });
}

export function useSelectPlan() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) =>
      api.post<MySubscriptionResponse>("/subscriptions/me/plan", { planId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription", "me"] });
      queryClient.invalidateQueries({ queryKey: ["payments", "me"] });
      queryClient.invalidateQueries({ queryKey: ["checkins", "me"] });
    },
  });
}
```

Also add `useMutation` and `useQueryClient` to the imports:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
```

- [x] **Step 3: Verify TypeScript**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter mobile exec tsc --noEmit`
Expected: No type errors (or only pre-existing ones)

- [x] **Step 4: Commit**

```bash
git add apps/mobile/lib/hooks/use-checkin.ts apps/mobile/lib/hooks/use-subscription.ts
git commit -m "feat(mobile): add hooks for weekly checkin count, history, payments, and plan selection"
```

---

## Task 6: Restructure student navigation — replace Academia tab with Assinatura

**Files:**
- Create: `apps/mobile/app/(app)/(student)/(subscription)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(student)/(home)/academy-info.tsx`
- Modify: `apps/mobile/app/(app)/(student)/_layout.tsx`
- Modify: `apps/mobile/app/(app)/(student)/(home)/index.tsx`
- Delete: `apps/mobile/app/(app)/(student)/(academy)/_layout.tsx`
- Delete: `apps/mobile/app/(app)/(student)/(academy)/index.tsx`

- [ ] **Step 1: Create subscription stack layout**

Create `apps/mobile/app/(app)/(student)/(subscription)/_layout.tsx`:

```typescript
import { Stack } from "expo-router";

export default function SubscriptionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0C0C0C" },
        animation: "slide_from_right",
      }}
    />
  );
}
```

- [ ] **Step 2: Create academy-info screen under (home)**

Create `apps/mobile/app/(app)/(student)/(home)/academy-info.tsx`:

```typescript
import { AcademyInfo } from "@/components/AcademyInfo";
import { useCancelMembership } from "@/lib/hooks/use-membership";
import { useCurrentUser } from "@/lib/hooks/use-user";

export default function StudentAcademyInfoScreen() {
  const { data: user } = useCurrentUser();
  const cancelMembership = useCancelMembership();

  return (
    <AcademyInfo
      onLeave={() => cancelMembership.mutate()}
      isLeaving={cancelMembership.isPending}
      memberSince={user?.activeMembership?.joinedAt ?? null}
    />
  );
}
```

- [ ] **Step 3: Update student _layout.tsx**

Replace the full content of `apps/mobile/app/(app)/(student)/_layout.tsx`:

```typescript
import { Tabs } from "expo-router";
import { Calendar, CreditCard, Home, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function StudentLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#0C0C0C" },
        tabBarStyle: {
          backgroundColor: "#1A1A1A",
          borderTopColor: "#2A2A2A",
          borderTopWidth: 1,
          height: 56 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#A078E8",
        tabBarInactiveTintColor: "#ABABAB",
        tabBarLabelStyle: {
          fontFamily: "Poppins_500Medium",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(members)"
        options={{
          title: "Membros",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(classes)"
        options={{
          title: "Agenda",
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(subscription)"
        options={{
          title: "Assinatura",
          tabBarIcon: ({ color, size }) => (
            <CreditCard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="register-belt" options={{ href: null }} />
    </Tabs>
  );
}
```

- [ ] **Step 4: Add navigation to subscription card and academy card in student home**

In `apps/mobile/app/(app)/(student)/(home)/index.tsx`, modify the subscription card Pressable (around line 138) to add navigation:

```typescript
<Pressable
  onPress={() => router.push("/(app)/(student)/(subscription)")}
  className="flex-row items-center gap-3 rounded-2xl border border-surface-border bg-surface p-4"
>
```

Also add an academy card below the existing header section. After the header `View` (the one with `academyName` and the bell/avatar buttons, ending around line 106), add a Pressable for academy info. Find the existing `{academyName}` Text and wrap the name section in a Pressable:

Modify the header section: change the `<View style={{ gap: 2 }}>` containing `academyName` to a `Pressable`:

```typescript
<Pressable onPress={() => router.push("/(app)/(student)/(home)/academy-info")} style={{ gap: 2 }}>
  <Text
    className="font-poppins-bold text-primary"
    style={{ fontSize: 20, letterSpacing: -0.5 }}
  >
    {academyName}
  </Text>
</Pressable>
```

- [ ] **Step 5: Delete old academy tab files**

```bash
rm apps/mobile/app/(app)/(student)/(academy)/_layout.tsx
rm apps/mobile/app/(app)/(student)/(academy)/index.tsx
rmdir apps/mobile/app/(app)/(student)/(academy)
```

- [ ] **Step 6: Commit**

```bash
git add -A apps/mobile/app/(app)/(student)/
git commit -m "feat(mobile): replace student Academia tab with Assinatura, move academy info to home"
```

---

## Task 7: Restructure instructor navigation — remove Academia tab

**Files:**
- Create: `apps/mobile/app/(app)/(instructor)/(home)/academy-info.tsx`
- Modify: `apps/mobile/app/(app)/(instructor)/_layout.tsx`
- Modify: `apps/mobile/app/(app)/(instructor)/(home)/index.tsx`
- Delete: `apps/mobile/app/(app)/(instructor)/(academy)/_layout.tsx`
- Delete: `apps/mobile/app/(app)/(instructor)/(academy)/index.tsx`

- [ ] **Step 1: Create academy-info screen under instructor (home)**

Create `apps/mobile/app/(app)/(instructor)/(home)/academy-info.tsx`:

```typescript
import { AcademyInfo } from "@/components/AcademyInfo";
import { useCancelMembership } from "@/lib/hooks/use-membership";
import { useCurrentUser } from "@/lib/hooks/use-user";

export default function InstructorAcademyInfoScreen() {
  const { data: user } = useCurrentUser();
  const cancelMembership = useCancelMembership();

  return (
    <AcademyInfo
      onLeave={() => cancelMembership.mutate()}
      isLeaving={cancelMembership.isPending}
      memberSince={user?.activeMembership?.joinedAt ?? null}
    />
  );
}
```

- [ ] **Step 2: Update instructor _layout.tsx — remove Academia tab**

Replace the full content of `apps/mobile/app/(app)/(instructor)/_layout.tsx`:

```typescript
import { Tabs } from "expo-router";
import { Calendar, Home, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function InstructorLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#0C0C0C" },
        tabBarStyle: {
          backgroundColor: "#1A1A1A",
          borderTopColor: "#2A2A2A",
          borderTopWidth: 1,
          height: 56 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#A078E8",
        tabBarInactiveTintColor: "#ABABAB",
        tabBarLabelStyle: {
          fontFamily: "Poppins_500Medium",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(classes)"
        options={{
          title: "Aulas",
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(members)"
        options={{
          title: "Membros",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 3: Add academy card navigation to instructor home**

In `apps/mobile/app/(app)/(instructor)/(home)/index.tsx`, find the academy card (the `<View className="rounded-2xl border border-surface-border bg-surface" ...>` around line 157). Wrap it in a Pressable:

Replace:
```typescript
<View
  className="rounded-2xl border border-surface-border bg-surface"
  style={{ padding: 20, gap: 16 }}
>
```

With:
```typescript
<Pressable
  onPress={() => router.push("/(app)/(instructor)/(home)/academy-info")}
  className="rounded-2xl border border-surface-border bg-surface"
  style={{ padding: 20, gap: 16 }}
>
```

And close with `</Pressable>` instead of `</View>` (find the matching closing tag around line 193).

- [ ] **Step 4: Delete old instructor academy tab files**

```bash
rm apps/mobile/app/(app)/(instructor)/(academy)/_layout.tsx
rm apps/mobile/app/(app)/(instructor)/(academy)/index.tsx
rmdir apps/mobile/app/(app)/(instructor)/(academy)
```

- [ ] **Step 5: Commit**

```bash
git add -A apps/mobile/app/(app)/(instructor)/
git commit -m "feat(mobile): remove instructor Academia tab, move academy info to home"
```

---

## Task 8: Build M-STU-10 — My Subscription screen

**Design reference:** Node ID `YYbfl` in `/Volumes/ExternalDisk1/repos/tatame-v2/design.pen`

**Before writing any code:** Use the Pencil MCP tools to read the design:
1. `mcp__pencil__batch_get` with `nodeIds: ["YYbfl"]`, `readDepth: 4` to understand the full component tree
2. `mcp__pencil__get_screenshot` with `nodeId: "YYbfl"` to see the visual reference

**Files:**
- Create: `apps/mobile/app/(app)/(student)/(subscription)/index.tsx`

- [ ] **Step 1: Read design node structure**

Use `mcp__pencil__batch_get` with `filePath: "/Volumes/ExternalDisk1/repos/tatame-v2/design.pen"`, `nodeIds: ["YYbfl"]`, `readDepth: 4` to understand the component hierarchy.

Also take a screenshot with `mcp__pencil__get_screenshot` for `nodeId: "YYbfl"`.

- [ ] **Step 2: Create the My Subscription screen**

Create `apps/mobile/app/(app)/(student)/(subscription)/index.tsx`:

```typescript
import { BackButton } from "@/components/BackButton";
import { useWeeklyCheckinCount } from "@/lib/hooks/use-checkin";
import { useMyPayments, useMySubscription } from "@/lib/hooks/use-subscription";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Calendar, ChevronRight } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function formatDate(value: string): string {
  const d = new Date(value.includes("T") ? value : value + "T00:00:00");
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function MySubscriptionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: subResponse, isLoading: subLoading } = useMySubscription();
  const { data: weeklyCount } = useWeeklyCheckinCount();
  const { data: payments } = useMyPayments();
  const [refreshing, setRefreshing] = useState(false);

  const subscription = subResponse?.subscription;
  const plan = subResponse?.plan;
  const hasActive = subscription != null && subscription.effectiveStatus === "active";

  useEffect(() => {
    if (!subLoading && !hasActive) {
      router.replace("/(app)/(student)/(subscription)/plans");
    }
  }, [subLoading, hasActive, router]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["subscription", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["checkins", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["payments", "me"] }),
    ]);
    setRefreshing(false);
  };

  if (subLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={["top"]}>
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  if (!hasActive || !plan || !subscription) return null;

  const checkinLimit = plan.weeklyCheckinLimit;
  const checkinLabel = checkinLimit
    ? `${weeklyCount?.count ?? 0} / ${checkinLimit}`
    : `${weeklyCount?.count ?? 0}`;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A078E8" />
        }
      >
        <View style={{ gap: 20 }}>
          {/* Header */}
          <View className="flex-row items-center gap-3" style={{ paddingTop: 8 }}>
            <BackButton />
            <Text className="flex-1 text-center font-poppins-semibold text-base text-primary">
              Minha assinatura
            </Text>
            <View className="h-10 w-10" />
          </View>

          {/* Plan Card */}
          <Pressable
            onPress={() => router.push("/(app)/(student)/(subscription)/plans")}
            className="rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 20, gap: 12 }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-poppins-semibold text-base text-primary">{plan.name}</Text>
              <View className="rounded-full px-3 py-1" style={{ backgroundColor: "#32D74B20" }}>
                <Text className="font-poppins-semibold text-xs" style={{ color: "#32D74B" }}>
                  Ativa
                </Text>
              </View>
            </View>
            <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
              R$ {(plan.priceCents / 100).toFixed(0)} / mês
            </Text>
            <View className="flex-row" style={{ gap: 24 }}>
              <View style={{ gap: 2 }}>
                <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>Início</Text>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {formatDate(subscription.startsAt)}
                </Text>
              </View>
              <View style={{ gap: 2 }}>
                <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>Expira em</Text>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {formatDate(subscription.expiresAt)}
                </Text>
              </View>
            </View>
          </Pressable>

          {/* Check-ins Card */}
          <Pressable
            onPress={() => router.push("/(app)/(student)/(subscription)/checkin-history")}
            className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 16 }}
          >
            <Text className="font-poppins-semibold text-sm text-primary">
              Check-ins esta semana
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="font-poppins-bold text-base" style={{ color: "#A078E8" }}>
                {checkinLabel}
              </Text>
              <ChevronRight size={16} color={TEXT_MUTED} />
            </View>
          </Pressable>

          {/* Payments Section */}
          <View style={{ gap: 12 }}>
            <Text className="font-poppins-semibold text-base text-primary">Pagamentos</Text>
            {payments && payments.length > 0 ? (
              <View className="rounded-2xl border border-surface-border bg-surface" style={{ overflow: "hidden" }}>
                {payments.slice(0, 5).map((p, i) => (
                  <View
                    key={p.id}
                    className="flex-row items-center justify-between"
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: "#2A2A2A",
                    }}
                  >
                    <View style={{ gap: 2 }}>
                      <Text className="font-poppins-semibold text-sm text-primary">
                        {formatDate(p.paidAt)}
                      </Text>
                      <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                        {plan.name} · mensal
                      </Text>
                    </View>
                    <Text className="font-poppins-semibold text-sm" style={{ color: "#FF453A" }}>
                      {formatCurrency(p.amountCents)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className="items-center rounded-2xl border border-surface-border bg-surface py-6">
                <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                  Nenhum pagamento registrado
                </Text>
              </View>
            )}
          </View>

          {/* Next Payment Footer */}
          {payments && payments.length > 0 && (
            <View className="flex-row items-center gap-2" style={{ paddingHorizontal: 4 }}>
              <Calendar size={14} color={TEXT_MUTED} />
              <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                Próximo pagamento: {formatDate(subscription.expiresAt)} · {formatCurrency(plan.priceCents)}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Take screenshot to compare with design**

Use `mcp__pencil__get_screenshot` to compare the design node `YYbfl` with the built screen. Adjust styling if needed.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/(student)/(subscription)/index.tsx
git commit -m "feat(mobile): add My Subscription screen (M-STU-10)"
```

---

## Task 9: Build M-STU-08 — Subscription Plans List screen

**Design reference:** Node ID `At2zo` in `/Volumes/ExternalDisk1/repos/tatame-v2/design.pen`

**Before writing any code:** Use the Pencil MCP tools to read the design:
1. `mcp__pencil__batch_get` with `nodeIds: ["At2zo"]`, `readDepth: 4`
2. `mcp__pencil__get_screenshot` with `nodeId: "At2zo"`

**Files:**
- Create: `apps/mobile/app/(app)/(student)/(subscription)/plans/index.tsx`

- [ ] **Step 1: Read design node structure and take screenshot**

Use `mcp__pencil__batch_get` with `filePath: "/Volumes/ExternalDisk1/repos/tatame-v2/design.pen"`, `nodeIds: ["At2zo"]`, `readDepth: 4`.

Also take a screenshot with `mcp__pencil__get_screenshot` for `nodeId: "At2zo"`.

- [ ] **Step 2: Create the Plans List screen**

Create `apps/mobile/app/(app)/(student)/(subscription)/plans/index.tsx`:

```typescript
import { BackButton } from "@/components/BackButton";
import { useMySubscription } from "@/lib/hooks/use-subscription";
import { useSubscriptionPlans } from "@/lib/hooks/use-subscription-plans";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";

export default function SubscriptionPlansScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: plans, isLoading } = useSubscriptionPlans();
  const { data: subResponse } = useMySubscription();
  const [refreshing, setRefreshing] = useState(false);

  const currentPlanId = subResponse?.subscription?.effectiveStatus === "active"
    ? subResponse.subscription.planId
    : null;

  const activePlans = plans?.filter((p) => p.isActive) ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] }),
      queryClient.invalidateQueries({ queryKey: ["subscription", "me"] }),
    ]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A078E8" />
        }
      >
        <View style={{ gap: 20 }}>
          {/* Header */}
          <View className="flex-row items-center gap-3" style={{ paddingTop: 8 }}>
            <BackButton />
            <Text className="flex-1 text-center font-poppins-semibold text-base text-primary">
              Planos de assinatura
            </Text>
            <View className="h-10 w-10" />
          </View>

          <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
            Escolha o plano ideal para você
          </Text>

          {isLoading ? (
            <ActivityIndicator color="#A078E8" style={{ marginTop: 32 }} />
          ) : (
            <View style={{ gap: 12 }}>
              {activePlans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                return (
                  <Pressable
                    key={plan.id}
                    onPress={() =>
                      router.push(`/(app)/(student)/(subscription)/plans/${plan.id}`)
                    }
                    className="rounded-2xl border bg-surface"
                    style={{
                      padding: 20,
                      gap: 8,
                      borderColor: isCurrent ? "#A078E8" : "#2A2A2A",
                      borderWidth: isCurrent ? 2 : 1,
                    }}
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="font-poppins-semibold text-base text-primary">
                        {plan.name}
                      </Text>
                      {isCurrent && (
                        <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: "#A078E820" }}>
                          <Text className="font-poppins-semibold text-[10px]" style={{ color: "#A078E8" }}>
                            Atual
                          </Text>
                        </View>
                      )}
                      <View className="flex-1" />
                      <ChevronRight size={18} color={TEXT_MUTED} />
                    </View>
                    <Text className="font-poppins-bold text-primary" style={{ fontSize: 22 }}>
                      R$ {(plan.priceCents / 100).toFixed(0)} / mês
                    </Text>
                    <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                      {plan.weeklyCheckinLimit
                        ? `${plan.weeklyCheckinLimit} check-ins por semana`
                        : "Ilimitado"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Take screenshot to compare with design**

Use `mcp__pencil__get_screenshot` on `At2zo` to compare with the built screen. Adjust styling as needed.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/(student)/(subscription)/plans/index.tsx
git commit -m "feat(mobile): add Subscription Plans list screen (M-STU-08)"
```

---

## Task 10: Build M-STU-09 — Plan Detail screen

**Design reference:** Node ID `LIpc2` in `/Volumes/ExternalDisk1/repos/tatame-v2/design.pen`

**Before writing any code:** Use the Pencil MCP tools to read the design:
1. `mcp__pencil__batch_get` with `nodeIds: ["LIpc2"]`, `readDepth: 4`
2. `mcp__pencil__get_screenshot` with `nodeId: "LIpc2"`

**Files:**
- Create: `apps/mobile/app/(app)/(student)/(subscription)/plans/[planId].tsx`

- [ ] **Step 1: Read design node structure and take screenshot**

Use `mcp__pencil__batch_get` with `filePath: "/Volumes/ExternalDisk1/repos/tatame-v2/design.pen"`, `nodeIds: ["LIpc2"]`, `readDepth: 4`.

Also take a screenshot with `mcp__pencil__get_screenshot` for `nodeId: "LIpc2"`.

- [ ] **Step 2: Create the Plan Detail screen**

Create `apps/mobile/app/(app)/(student)/(subscription)/plans/[planId].tsx`:

```typescript
import { BackButton } from "@/components/BackButton";
import { useMySubscription, useSelectPlan } from "@/lib/hooks/use-subscription";
import { useSubscriptionPlan } from "@/lib/hooks/use-subscription-plans";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, CheckCircle, Clock, RefreshCw } from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";

export default function PlanDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const { data: plan, isLoading } = useSubscriptionPlan(planId);
  const { data: subResponse } = useMySubscription();
  const selectPlan = useSelectPlan();

  const currentPlanId =
    subResponse?.subscription?.effectiveStatus === "active"
      ? subResponse.subscription.planId
      : null;
  const isCurrentPlan = plan?.id === currentPlanId;
  const hasActiveSubscription = currentPlanId != null;

  const handleSelectPlan = () => {
    if (!plan) return;
    Alert.alert(
      "Confirmar troca de plano",
      `Deseja trocar para o plano ${plan.name}? Sua assinatura será atualizada imediatamente.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: () =>
            selectPlan.mutate(plan.id, {
              onSuccess: () => {
                Alert.alert("Plano atualizado", "Sua assinatura foi atualizada com sucesso.");
                router.dismiss(2);
              },
              onError: () => {
                Alert.alert("Erro", "Não foi possível trocar de plano. Tente novamente.");
              },
            }),
        },
      ],
    );
  };

  if (isLoading || !plan) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={["top"]}>
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const features = [
    {
      icon: RefreshCw,
      text: "Renovação mensal automática",
    },
    {
      icon: CheckCircle,
      text: plan.weeklyCheckinLimit
        ? `${plan.weeklyCheckinLimit} check-ins por semana`
        : "Check-ins ilimitados",
    },
    {
      icon: Calendar,
      text: `Expira ${plan.recurrenceMonths * 30} dias após ativação`,
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}
        >
          <View style={{ gap: 24 }}>
            {/* Header */}
            <View className="flex-row items-center gap-3" style={{ paddingTop: 8 }}>
              <BackButton />
              <Text className="flex-1 text-center font-poppins-semibold text-base text-primary">
                Detalhes do plano
              </Text>
              <View className="h-10 w-10" />
            </View>

            {/* Plan Name & Price */}
            <View style={{ gap: 8 }}>
              <Text className="font-poppins-bold text-primary" style={{ fontSize: 26, letterSpacing: -0.5 }}>
                {plan.name}
              </Text>
              <View className="flex-row items-baseline">
                <Text className="font-poppins-bold" style={{ fontSize: 36, color: "#A078E8" }}>
                  R$ {(plan.priceCents / 100).toFixed(0)}
                </Text>
                <Text className="font-poppins text-base" style={{ color: TEXT_SECONDARY }}>
                  {" "}/ mês
                </Text>
              </View>
            </View>

            {/* Check-in Info */}
            <View className="flex-row items-center gap-2">
              <Clock size={16} color={TEXT_SECONDARY} />
              <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
                {plan.weeklyCheckinLimit
                  ? `${plan.weeklyCheckinLimit} check-ins por semana`
                  : "Check-ins ilimitados"}
              </Text>
            </View>

            {/* Features List */}
            <View
              className="rounded-2xl border border-surface-border bg-surface"
              style={{ overflow: "hidden" }}
            >
              {features.map((feature, i) => (
                <View
                  key={i}
                  className="flex-row items-center gap-3"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: "#2A2A2A",
                  }}
                >
                  <feature.icon size={18} color={TEXT_SECONDARY} />
                  <Text className="font-poppins text-sm text-primary">{feature.text}</Text>
                </View>
              ))}
            </View>

            {/* Current Plan Info Box */}
            {hasActiveSubscription && !isCurrentPlan && subResponse?.plan && (
              <View
                className="flex-row items-start gap-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: "#A078E810" }}
              >
                <View className="mt-0.5 h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "#A078E830" }}>
                  <Text className="font-poppins-bold text-[10px]" style={{ color: "#A078E8" }}>i</Text>
                </View>
                <Text className="flex-1 font-poppins text-[13px] text-primary">
                  Você está no {subResponse.plan.name}. Ao selecionar este plano, sua assinatura será
                  atualizada imediatamente.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* CTA Button */}
        {!isCurrentPlan && (
          <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
            <Pressable
              onPress={handleSelectPlan}
              disabled={selectPlan.isPending}
              className="items-center rounded-2xl py-4"
              style={{
                backgroundColor: selectPlan.isPending ? "#A078E880" : "#A078E8",
              }}
            >
              {selectPlan.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-poppins-semibold text-base text-white">
                  Selecionar este plano
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Take screenshot to compare with design**

Use `mcp__pencil__get_screenshot` on `LIpc2` to compare. Adjust styling as needed.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/(student)/(subscription)/plans/[planId].tsx
git commit -m "feat(mobile): add Plan Detail screen (M-STU-09)"
```

---

## Task 11: Build M-STU-11 — Check-in History screen

**Design reference:** Node ID `9IxiV` in `/Volumes/ExternalDisk1/repos/tatame-v2/design.pen`

**Before writing any code:** Use the Pencil MCP tools to read the design:
1. `mcp__pencil__batch_get` with `nodeIds: ["9IxiV"]`, `readDepth: 4`
2. `mcp__pencil__get_screenshot` with `nodeId: "9IxiV"`

**Files:**
- Create: `apps/mobile/app/(app)/(student)/(subscription)/checkin-history.tsx`

- [ ] **Step 1: Read design node structure and take screenshot**

Use `mcp__pencil__batch_get` with `filePath: "/Volumes/ExternalDisk1/repos/tatame-v2/design.pen"`, `nodeIds: ["9IxiV"]`, `readDepth: 4`.

Also take a screenshot with `mcp__pencil__get_screenshot` for `nodeId: "9IxiV"`.

- [ ] **Step 2: Create the Check-in History screen**

Create `apps/mobile/app/(app)/(student)/(subscription)/checkin-history.tsx`:

```typescript
import { BackButton } from "@/components/BackButton";
import { useCheckinHistory } from "@/lib/hooks/use-checkin";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";

type CheckinEntry = {
  id: string;
  className: string;
  date: string;
  dayOfWeek: string;
  time: string;
};

type Section = {
  title: string;
  count: number;
  data: CheckinEntry[];
};

export default function CheckinHistoryScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useCheckinHistory();
  const [refreshing, setRefreshing] = useState(false);

  const sections: Section[] = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) =>
      page.items.map((week) => ({
        title: week.weekLabel,
        count: week.count,
        data: week.checkins,
      })),
    );
  }, [data]);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["checkins", "me", "history"] });
    setRefreshing(false);
  };

  const onEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View
        className="flex-row items-center gap-3"
        style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 }}
      >
        <BackButton />
        <Text className="flex-1 text-center font-poppins-semibold text-base text-primary">
          Histórico de check-ins
        </Text>
        <View className="h-10 w-10" />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#A078E8" />
        </View>
      ) : sections.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
            Nenhum check-in registrado
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A078E8" />
          }
          renderSectionHeader={({ section }) => (
            <View
              className="flex-row items-center justify-between"
              style={{ paddingTop: 20, paddingBottom: 12 }}
            >
              <Text className="font-poppins-semibold text-sm text-primary">
                {section.title}
              </Text>
              <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
                {section.count} check-ins
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View
              className="flex-row items-center gap-3"
              style={{ paddingVertical: 10 }}
            >
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: "#32D74B" }}
              />
              <View style={{ gap: 2 }}>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {item.className}
                </Text>
                <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                  {item.dayOfWeek}, {formatDisplayDate(item.date)} · {item.time}
                </Text>
              </View>
            </View>
          )}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color="#A078E8" style={{ marginTop: 16 }} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
```

- [ ] **Step 3: Take screenshot to compare with design**

Use `mcp__pencil__get_screenshot` on `9IxiV` to compare. Adjust styling as needed.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/(student)/(subscription)/checkin-history.tsx
git commit -m "feat(mobile): add Check-in History screen (M-STU-11)"
```

---

## Task 12: Wire up student home check-in count with real data

**Files:**
- Modify: `apps/mobile/app/(app)/(student)/(home)/index.tsx`

- [ ] **Step 1: Replace hardcoded check-in count**

In `apps/mobile/app/(app)/(student)/(home)/index.tsx`:

Add import:
```typescript
import { useWeeklyCheckinCount } from "@/lib/hooks/use-checkin";
```

Add hook call inside the component (after other hooks):
```typescript
const { data: weeklyCount } = useWeeklyCheckinCount();
```

Replace the hardcoded `0` in the check-ins card (line 132):
```typescript
<Text className="font-poppins-bold text-primary" style={{ fontSize: 28 }}>
  {weeklyCount?.count ?? 0}
</Text>
```

Also add the weekly count query to the refresh invalidation:
```typescript
queryClient.invalidateQueries({ queryKey: ["checkins", "me"] }),
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(student)/(home)/index.tsx
git commit -m "feat(mobile): wire student home check-in count to real data"
```

---

## Task 13: Final verification

- [ ] **Step 1: Verify API TypeScript compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter api exec tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Verify mobile TypeScript compiles**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter mobile exec tsc --noEmit`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 3: Verify validators build**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm --filter @tatame/validators build`
Expected: Build succeeds

- [ ] **Step 4: Review all new files exist**

```bash
ls -la apps/mobile/app/(app)/(student)/(subscription)/_layout.tsx
ls -la apps/mobile/app/(app)/(student)/(subscription)/index.tsx
ls -la apps/mobile/app/(app)/(student)/(subscription)/plans/index.tsx
ls -la "apps/mobile/app/(app)/(student)/(subscription)/plans/[planId].tsx"
ls -la apps/mobile/app/(app)/(student)/(subscription)/checkin-history.tsx
ls -la apps/mobile/app/(app)/(student)/(home)/academy-info.tsx
ls -la apps/mobile/app/(app)/(instructor)/(home)/academy-info.tsx
```

- [ ] **Step 5: Verify deleted files are gone**

```bash
test ! -d apps/mobile/app/(app)/(student)/(academy) && echo "OK: student academy deleted"
test ! -d apps/mobile/app/(app)/(instructor)/(academy) && echo "OK: instructor academy deleted"
```

- [ ] **Step 6: Final commit if needed**

Only if there are uncommitted fixes from verification.
