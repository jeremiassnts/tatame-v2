# Schedule & Class Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 11 class schedule screens across manager, instructor, and student roles with shared components.

**Architecture:** Thin route wrappers per role that delegate to shared components (`WeekDayStrip`, `ClassDetailView`, `ClassForm`, etc.) with role-based props (`canEdit`, `canDelete`, `canCheckin`). API hooks abstract data fetching. New API endpoint for class checkins list.

**Tech Stack:** React Native / Expo Router, TanStack Query, NativeWind/Tailwind, Express.js, Drizzle ORM, Zod

---

## File Structure

### New files — API

| File | Responsibility |
|------|----------------|
| `apps/api/src/modules/checkin/checkin.repository.ts` | Add `findByClassAndDate` to interface |
| `apps/api/src/modules/checkin/checkin.repository.postgres.ts` | Implement `findByClassAndDate` |
| `apps/api/src/modules/class/class.routes.ts` | Add `GET /classes/:classId/checkins` sub-route |

### New files — Mobile hooks

| File | Responsibility |
|------|----------------|
| `apps/mobile/lib/hooks/use-classes.ts` | `useClasses`, `useClass`, `useCreateClass`, `useUpdateClass`, `useDeleteClass` |
| `apps/mobile/lib/hooks/use-checkin.ts` | `useClassCheckins`, `useCheckin` |
| `apps/mobile/lib/hooks/use-graduation.ts` | `useMyGraduation`, `useRegisterBelt` |
| `apps/mobile/lib/hooks/use-subscription.ts` | `useMySubscription` |

### New files — Shared components

| File | Responsibility |
|------|----------------|
| `apps/mobile/components/WeekDayStrip.tsx` | 7-day horizontal selector |
| `apps/mobile/components/CapacityBar.tsx` | Occupation bar with gradient color |
| `apps/mobile/components/CheckinListItem.tsx` | Single check-in row |
| `apps/mobile/components/ClassDetailView.tsx` | Full class detail with role-based actions |
| `apps/mobile/components/ClassForm.tsx` | Create/edit form with role-based instructor field |

### New files — Manager screens

| File | Responsibility |
|------|----------------|
| `apps/mobile/app/(app)/(manager)/(classes)/index.tsx` | Replace placeholder with schedule list |
| `apps/mobile/app/(app)/(manager)/(classes)/[classId].tsx` | Class detail |
| `apps/mobile/app/(app)/(manager)/(classes)/create.tsx` | Create class |
| `apps/mobile/app/(app)/(manager)/(classes)/edit/[classId].tsx` | Edit class |

### New files — Instructor layout + screens

| File | Responsibility |
|------|----------------|
| `apps/mobile/app/(app)/(instructor)/_layout.tsx` | 4-tab bar layout |
| `apps/mobile/app/(app)/(instructor)/(home)/_layout.tsx` | Stack layout |
| `apps/mobile/app/(app)/(instructor)/(home)/index.tsx` | Instructor home |
| `apps/mobile/app/(app)/(instructor)/(classes)/_layout.tsx` | Stack layout |
| `apps/mobile/app/(app)/(instructor)/(classes)/index.tsx` | My classes list |
| `apps/mobile/app/(app)/(instructor)/(classes)/[classId].tsx` | Class detail |
| `apps/mobile/app/(app)/(instructor)/(classes)/create.tsx` | Create class |
| `apps/mobile/app/(app)/(instructor)/(classes)/edit/[classId].tsx` | Edit class |

### New files — Student layout + screens

| File | Responsibility |
|------|----------------|
| `apps/mobile/app/(app)/(student)/_layout.tsx` | Stack layout (no tab bar) |
| `apps/mobile/app/(app)/(student)/register-belt.tsx` | Initial belt registration |
| `apps/mobile/app/(app)/(student)/(home)/_layout.tsx` | Stack layout |
| `apps/mobile/app/(app)/(student)/(home)/index.tsx` | Student home dashboard |
| `apps/mobile/app/(app)/(student)/(classes)/_layout.tsx` | Stack layout |
| `apps/mobile/app/(app)/(student)/(classes)/index.tsx` | Weekly schedule |
| `apps/mobile/app/(app)/(student)/(classes)/[classId].tsx` | Class detail (read-only + check-in) |

### Modified files

| File | Change |
|------|--------|
| `apps/mobile/app/(app)/_layout.tsx` | Route instructor/student to their layouts + provide AcademyProvider |
| `apps/mobile/lib/api.ts` | Add `delete` method |
| `apps/mobile/components/ClassCard.tsx` | Extend with check-in button, capacity, instructor props |

---

## Task 1: Add `delete` method to API client

**Files:**
- Modify: `apps/mobile/lib/api.ts:84-118`

- [x] **Step 1: Add delete method to useApi**

In `apps/mobile/lib/api.ts`, add the `delete` method to the `useApi` return object after the `patch` method:

```typescript
async delete<T>(path: string): Promise<T> {
  const token = await getToken();
  return request<T>(path, { method: "DELETE", token });
},
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/lib/api.ts
git commit -m "feat(mobile): add delete method to API client"
```

---

## Task 2: Enrich class API responses with instructor name + add checkins list endpoint

**Files:**
- Modify: `apps/api/src/modules/class/class.repository.ts`
- Modify: `apps/api/src/modules/class/class.repository.postgres.ts`
- Modify: `apps/api/src/modules/class/class.routes.ts`
- Modify: `apps/api/src/modules/checkin/checkin.repository.ts`
- Modify: `apps/api/src/modules/checkin/checkin.repository.postgres.ts`

**Context:** The class API currently returns raw DB rows with `instructorId` but no `instructorName`. The screens need instructor names. Similarly, the checkins endpoint needs to return user names for the check-in list.

- [x] **Step 1: Enrich class list/detail responses with instructor name**

The class repository `findByAcademyId` and `findById` currently return raw `ClassRow` without instructor name. Update both methods in `class.repository.postgres.ts` to join with the `users` table and return `instructorName`:

In `apps/api/src/modules/class/class.repository.postgres.ts`, add the import:
```typescript
import { classes, users, type Database } from "@tatame/db";
```

Update `findByAcademyId` to use a join:
```typescript
async findByAcademyId(
  academyId: string,
  filters: {
    dayOfWeek?: number;
    includeInactive?: boolean;
    instructorId?: string;
  },
): Promise<ClassRow[]> {
  const conditions = [eq(classes.academyId, academyId)];
  if (!filters.includeInactive) {
    conditions.push(eq(classes.isActive, true));
  }
  if (filters.dayOfWeek !== undefined) {
    conditions.push(eq(classes.dayOfWeek, filters.dayOfWeek));
  }
  if (filters.instructorId) {
    conditions.push(eq(classes.instructorId, filters.instructorId));
  }
  const whereClause =
    conditions.length === 1 ? conditions[0]! : and(...conditions);

  const rows = await this.db
    .select({
      id: classes.id,
      academyId: classes.academyId,
      instructorId: classes.instructorId,
      name: classes.name,
      description: classes.description,
      dayOfWeek: classes.dayOfWeek,
      startTime: classes.startTime,
      endTime: classes.endTime,
      capacity: classes.capacity,
      isActive: classes.isActive,
      createdAt: classes.createdAt,
      updatedAt: classes.updatedAt,
      instructorName: users.name,
    })
    .from(classes)
    .leftJoin(users, eq(classes.instructorId, users.id))
    .where(whereClause)
    .orderBy(classes.dayOfWeek, classes.startTime);

  return rows;
}
```

Do the same for `findById`. Also update the `ClassRow` type in `class.repository.ts` to add `instructorName?: string | null`.

In the class routes, the response already passes through the row directly, so the instructor name will be included automatically.

- [x] **Step 2: Add findByClassAndDate to checkin repository interface**

In `apps/api/src/modules/checkin/checkin.repository.ts`, add to the `ICheckinRepository` interface:

```typescript
findByClassAndDateWithUser(
  classId: string,
  sessionDate: string,
): Promise<(CheckinRow & { userName: string; userProfileImageUrl: string | null })[]>;
```

- [x] **Step 3: Implement findByClassAndDateWithUser in Postgres repository**

In `apps/api/src/modules/checkin/checkin.repository.postgres.ts`, add import for `users` table and implement:

```typescript
import { and, count, eq } from "drizzle-orm";
import { checkins, users, type Database } from "@tatame/db";
```

```typescript
async findByClassAndDateWithUser(
  classId: string,
  sessionDate: string,
): Promise<(CheckinRow & { userName: string; userProfileImageUrl: string | null })[]> {
  const rows = await this.db
    .select({
      id: checkins.id,
      classId: checkins.classId,
      userId: checkins.userId,
      checkedInAt: checkins.checkedInAt,
      date: checkins.date,
      weekReference: checkins.weekReference,
      userName: users.name,
      userProfileImageUrl: users.profileImageUrl,
    })
    .from(checkins)
    .innerJoin(users, eq(checkins.userId, users.id))
    .where(
      and(eq(checkins.classId, classId), eq(checkins.date, sessionDate)),
    )
    .orderBy(checkins.checkedInAt);
  return rows;
}
```

Add `checkins.checkedInAt` import if needed (it's the column ref from `@tatame/db`).

- [x] **Step 4: Add GET /classes/:classId/checkins route**

In `apps/api/src/modules/class/class.routes.ts`, add at the bottom before the export (or after the existing routes). This needs a new import and a new route:

Add imports at top:
```typescript
import { PostgresCheckinRepository } from "../checkin/checkin.repository.postgres.js";
```

Add after the `classRouter.delete` handler:

```typescript
const checkinRepo = new PostgresCheckinRepository(db);

classRouter.get(
  "/:classId/checkins",
  authorize(Role.Manager, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const params = classIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid class id");
      }
      const date = typeof req.query.date === "string" ? req.query.date : undefined;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new HttpError(400, "date query param required (YYYY-MM-DD)");
      }
      // Verify the class belongs to this academy and the user has access
      await classService.getById(classCtx(req), params.data.classId);
      const rows = await checkinRepo.findByClassAndDateWithUser(params.data.classId, date);
      res.json({
        items: rows.map((r) => ({
          id: r.id,
          classId: r.classId,
          userId: r.userId,
          checkedInAt: r.checkedInAt.toISOString(),
          date: typeof r.date === "string" ? r.date.slice(0, 10) : r.date,
          userName: r.userName,
          userProfileImageUrl: r.userProfileImageUrl,
        })),
      });
    } catch (e) {
      next(e);
    }
  },
);
```

- [x] **Step 5: Verify API compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [x] **Step 6: Commit**

```bash
git add apps/api/src/modules/checkin/checkin.repository.ts apps/api/src/modules/checkin/checkin.repository.postgres.ts apps/api/src/modules/class/class.routes.ts apps/api/src/modules/class/class.repository.ts apps/api/src/modules/class/class.repository.postgres.ts
git commit -m "feat(api): enrich class responses with instructor name + add checkins endpoint"
```

---

## Task 3: Create mobile query hooks

**Status:** Done — commit `feat(mobile): add query hooks for classes, checkins, graduations, subscriptions`.

**Implementation notes (vs. snippets below):** `use-checkin` uses `CreateCheckinResponse` from `@tatame/validators` for the mutation return type and `encodeURIComponent(date)` on the class check-ins URL. `use-subscription` matches the API shape `{ subscription, plan }` as sibling fields (not `plan` nested under `subscription`). `use-classes` types `instructorName` as optional `string | null`.

**Files:**
- Create: `apps/mobile/lib/hooks/use-classes.ts`
- Create: `apps/mobile/lib/hooks/use-checkin.ts`
- Create: `apps/mobile/lib/hooks/use-graduation.ts`
- Create: `apps/mobile/lib/hooks/use-subscription.ts`

- [x] **Step 1: Create use-classes.ts**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import type { CreateClassBody, UpdateClassBody } from "@tatame/validators";

type ClassItem = {
  id: string;
  name: string;
  description: string | null;
  instructorId: string;
  instructorName?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number | null;
  isActive: boolean;
};

type ClassListResponse = { items: ClassItem[] };

export function useClasses(dayOfWeek: number) {
  const api = useApi();

  return useQuery({
    queryKey: ["classes", dayOfWeek],
    queryFn: () => api.get<ClassListResponse>(`/classes?dayOfWeek=${dayOfWeek}`),
    select: (data) => data.items,
  });
}

export function useClass(classId: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["class", classId],
    queryFn: () => api.get<ClassItem>(`/classes/${classId}`),
    enabled: Boolean(classId),
  });
}

export function useCreateClass() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateClassBody) =>
      api.post<ClassItem>("/classes", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

export function useUpdateClass(classId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateClassBody) =>
      api.patch<ClassItem>(`/classes/${classId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class", classId] });
    },
  });
}

export function useDeleteClass() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (classId: string) =>
      api.delete<ClassItem>(`/classes/${classId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}
```

- [x] **Step 2: Create use-checkin.ts**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

type CheckinItem = {
  id: string;
  classId: string;
  userId: string;
  checkedInAt: string;
  date: string;
  userName?: string;
  userProfileImageUrl?: string | null;
};

type CheckinListResponse = { items: CheckinItem[] };

type CreateCheckinResponse = {
  checkin: CheckinItem;
  warnings?: { subscriptionGrace?: true; paymentOverdue?: true };
};

export type { CheckinItem };

export function useClassCheckins(classId: string, date: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["checkins", classId, date],
    queryFn: () =>
      api.get<CheckinListResponse>(
        `/classes/${classId}/checkins?date=${date}`,
      ),
    select: (data) => data.items,
    enabled: Boolean(classId) && Boolean(date),
  });
}

export function useCheckin() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { classId: string; date: string }) =>
      api.post<CreateCheckinResponse>("/checkins", body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["checkins", variables.classId, variables.date],
      });
    },
  });
}
```

- [x] **Step 3: Create use-graduation.ts**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import type { RegisterInitialBeltBody, BeltPromotionResponse } from "@tatame/validators";

type GraduationsResponse = { items: BeltPromotionResponse[] };

export function useMyGraduation() {
  const api = useApi();

  return useQuery({
    queryKey: ["graduation", "me"],
    queryFn: () => api.get<GraduationsResponse>("/graduations/me"),
    select: (data) => data.items.find((g) => g.isCurrent) ?? null,
  });
}

export function useRegisterBelt() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: RegisterInitialBeltBody) =>
      api.post<BeltPromotionResponse>("/graduations/initial", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graduation", "me"] });
    },
  });
}
```

- [x] **Step 4: Create use-subscription.ts**

```typescript
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

type MySubscriptionResponse = {
  subscription: {
    id: string;
    status: string;
    startsAt: string;
    expiresAt: string;
    plan: {
      id: string;
      name: string;
      weeklyCheckinLimit: number | null;
    };
  } | null;
};

export function useMySubscription() {
  const api = useApi();

  return useQuery({
    queryKey: ["subscription", "me"],
    queryFn: () => api.get<MySubscriptionResponse>("/subscriptions/me"),
    select: (data) => data.subscription,
  });
}
```

- [x] **Step 5: Commit**

```bash
git add apps/mobile/lib/hooks/use-classes.ts apps/mobile/lib/hooks/use-checkin.ts apps/mobile/lib/hooks/use-graduation.ts apps/mobile/lib/hooks/use-subscription.ts
git commit -m "feat(mobile): add query hooks for classes, checkins, graduations, subscriptions"
```

---

## Task 4: Extend ClassCard component

**Status:** Done — commit `feat(mobile): extend ClassCard with capacity, instructor, and check-in button`.

**Files:**
- Modify: `apps/mobile/components/ClassCard.tsx`

The existing `ClassCard` is too simple — it only shows name and time. It needs to show instructor, capacity, and optionally a check-in button (for the student home).

- [x] **Step 1: Rewrite ClassCard with extended props**

Replace the contents of `apps/mobile/components/ClassCard.tsx`:

```typescript
import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

const TEXT_MUTED = "#525252";
const BORDER_STRONG = "#3A3A3A";

type ClassCardProps = {
  name: string;
  startTime: string;
  endTime: string;
  instructorName?: string;
  capacity?: number | null;
  checkinCount?: number;
  onPress?: () => void;
  showCheckinButton?: boolean;
  onCheckin?: () => void;
  checkinDisabled?: boolean;
  checkinLabel?: string;
};

export function ClassCard({
  name,
  startTime,
  endTime,
  instructorName,
  capacity,
  checkinCount,
  onPress,
  showCheckinButton,
  onCheckin,
  checkinDisabled,
  checkinLabel = "Check-in",
}: ClassCardProps) {
  const spotsText =
    capacity != null && checkinCount != null
      ? `${checkinCount}/${capacity} alunos`
      : capacity != null
        ? `${capacity} vagas`
        : undefined;

  const infoLine = [instructorName, spotsText].filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3.5 rounded-[14px] border border-surface-border bg-surface p-3.5"
    >
      <View className="w-[52px] items-center" style={{ gap: 2 }}>
        <Text
          className="font-poppins-semibold text-primary"
          style={{ fontSize: 14 }}
        >
          {startTime}
        </Text>
        <Text className="font-poppins text-[11px]" style={{ color: TEXT_MUTED }}>
          {endTime}
        </Text>
      </View>
      <View className="h-9 w-px" style={{ backgroundColor: BORDER_STRONG }} />
      <View className="min-w-0 flex-1" style={{ gap: 3 }}>
        <Text className="font-poppins-semibold text-sm text-primary">
          {name}
        </Text>
        {infoLine ? (
          <Text
            className="font-poppins text-xs"
            style={{ color: "#8A8A8A" }}
            numberOfLines={1}
          >
            {infoLine}
          </Text>
        ) : null}
      </View>
      {showCheckinButton ? (
        <Pressable
          onPress={onCheckin}
          disabled={checkinDisabled}
          className={`rounded-lg px-3 py-1.5 ${checkinDisabled ? "bg-[#3A3A3A]" : "bg-accent"}`}
        >
          <Text
            className={`font-poppins-semibold text-xs ${checkinDisabled ? "text-muted" : "text-white"}`}
          >
            {checkinLabel}
          </Text>
        </Pressable>
      ) : (
        <ChevronRight size={18} color={TEXT_MUTED} />
      )}
    </Pressable>
  );
}
```

- [x] **Step 2: Update dashboard to use new ClassCard props**

In `apps/mobile/app/(app)/(manager)/(home)/index.tsx`, the `DashboardClassRow` inline component can now be replaced with the updated `ClassCard`. Replace the `todayClasses.map` section to use `ClassCard` instead of `DashboardClassRow`, and remove the `DashboardClassRow` function. Import `ClassCard` from `@/components/ClassCard`.

Replace the map:
```typescript
todayClasses.map((cls) => (
  <ClassCard
    key={cls.id}
    name={cls.name}
    startTime={formatTime(cls.startTime)}
    endTime={formatTime(cls.endTime)}
    onPress={() => router.push(`/(app)/(manager)/(classes)/${cls.id}`)}
  />
))
```

Remove the `DashboardClassRow` function and the `Clock` and `ChevronRight` imports if no longer used (keep `ChevronRight` if used elsewhere in the file — check first).

- [x] **Step 3: Commit**

```bash
git add apps/mobile/components/ClassCard.tsx apps/mobile/app/(app)/(manager)/(home)/index.tsx
git commit -m "feat(mobile): extend ClassCard with capacity, instructor, and check-in button"
```

---

## Task 5: Create WeekDayStrip component

**Status:** Done — commit `feat(mobile): add WeekDayStrip component` (visual tokens aligned with `design.pen` node `s5xEh` / screen `zREdY`: 56px cells, `rounded-[12px]`, gap 6, unselected `#525252` labels, selected `bg-accent` without border).

**Files:**
- Create: `apps/mobile/components/WeekDayStrip.tsx`

- [x] **Step 1: Create WeekDayStrip**

```typescript
import { Pressable, Text, View } from "react-native";

const DAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

type WeekDayStripProps = {
  selectedDay: number;
  onDaySelect: (day: number) => void;
};

function getWeekDates(): { day: number; date: number }[] {
  const today = new Date();
  const currentDay = today.getDay();
  const result: { day: number; date: number }[] = [];

  for (let i = 0; i < 7; i++) {
    const diff = i - currentDay;
    const d = new Date(today);
    d.setDate(today.getDate() + diff);
    result.push({ day: i, date: d.getDate() });
  }

  return result;
}

export function WeekDayStrip({ selectedDay, onDaySelect }: WeekDayStripProps) {
  const weekDates = getWeekDates();

  return (
    <View className="flex-row" style={{ gap: 6 }}>
      {weekDates.map(({ day, date }) => {
        const isSelected = day === selectedDay;
        return (
          <Pressable
            key={day}
            onPress={() => onDaySelect(day)}
            className={`flex-1 items-center justify-center rounded-xl ${
              isSelected ? "bg-accent" : "border border-surface-border bg-surface"
            }`}
            style={{ height: 56, gap: 2 }}
          >
            <Text
              className={`font-poppins text-[10px] ${
                isSelected ? "text-white" : "text-muted"
              }`}
            >
              {DAY_LABELS[day]}
            </Text>
            <Text
              className={`font-poppins-bold text-base ${
                isSelected ? "text-white" : "text-primary"
              }`}
            >
              {date}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/components/WeekDayStrip.tsx
git commit -m "feat(mobile): add WeekDayStrip component"
```

---

## Task 6: Create CapacityBar and CheckinListItem components

**Status:** Done — commit `feat(mobile): add CapacityBar and CheckinListItem components` (tokens aligned with `design.pen` M-MGR-08 `jon0a`: capacity track `#242424`, bar height 6 / radius 3, label `#525252`; check-in rows padding 10×14, `CircleCheck` `#32D74B`).

**Files:**
- Create: `apps/mobile/components/CapacityBar.tsx`
- Create: `apps/mobile/components/CheckinListItem.tsx`

- [x] **Step 1: Create CapacityBar**

```typescript
import { Text, View } from "react-native";

type CapacityBarProps = {
  current: number;
  max: number | null;
};

function getBarColor(ratio: number): string {
  if (ratio < 0.6) return "#4ADE80";
  if (ratio < 0.85) return "#FFD60A";
  return "#F87171";
}

export function CapacityBar({ current, max }: CapacityBarProps) {
  if (max === null) {
    return (
      <View style={{ gap: 6 }}>
        <View className="flex-row items-center justify-between">
          <Text className="font-poppins text-xs text-muted">Ocupação</Text>
          <Text className="font-poppins-semibold text-xs text-primary">
            {current} alunos
          </Text>
        </View>
      </View>
    );
  }

  const ratio = max > 0 ? current / max : 0;
  const percentage = Math.min(ratio * 100, 100);
  const color = getBarColor(ratio);

  return (
    <View style={{ gap: 6 }}>
      <View className="flex-row items-center justify-between">
        <Text className="font-poppins text-xs text-muted">Ocupação</Text>
        <Text className="font-poppins-semibold text-xs" style={{ color }}>
          {current}/{max}
        </Text>
      </View>
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-surface-border">
        <View
          className="h-full rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}
```

- [x] **Step 2: Create CheckinListItem**

```typescript
import { Text, View } from "react-native";
import { CheckCircle } from "lucide-react-native";
import { Avatar } from "@/components/Avatar";

type CheckinListItemProps = {
  userName: string;
  userProfileImageUrl?: string | null;
  checkedInAt: string;
};

function formatCheckinTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function CheckinListItem({
  userName,
  userProfileImageUrl,
  checkedInAt,
}: CheckinListItemProps) {
  const letter = userName.charAt(0).toUpperCase();

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-surface-border bg-surface px-3.5 py-2.5">
      <Avatar
        variant="user"
        imageUrl={userProfileImageUrl}
        fallbackLetter={letter}
        size={36}
      />
      <View className="min-w-0 flex-1" style={{ gap: 2 }}>
        <Text className="font-poppins-semibold text-sm text-primary">
          {userName}
        </Text>
        <Text className="font-poppins text-xs text-muted">
          Check-in às {formatCheckinTime(checkedInAt)}
        </Text>
      </View>
      <CheckCircle size={20} color="#4ADE80" />
    </View>
  );
}
```

- [x] **Step 3: Commit**

```bash
git add apps/mobile/components/CapacityBar.tsx apps/mobile/components/CheckinListItem.tsx
git commit -m "feat(mobile): add CapacityBar and CheckinListItem components"
```

---

## Task 7: Create ClassDetailView component

**Status:** Done — commit `feat(mobile): add ClassDetailView shared component` (layout aligned with `design.pen` jon0a: accent bar + title block, 2-column info grid Horário/Dia | Instrutor/Vagas, `Timer` for schedule, `#525252` info labels/icons).

**Files:**
- Create: `apps/mobile/components/ClassDetailView.tsx`

- [x] **Step 1: Create ClassDetailView**

```typescript
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Calendar,
  Check,
  Clock,
  Pencil,
  Trash2,
  User,
  Users,
} from "lucide-react-native";
import { BackButton } from "@/components/BackButton";
import { CapacityBar } from "@/components/CapacityBar";
import { CheckinListItem } from "@/components/CheckinListItem";
import type { CheckinItem } from "@/lib/hooks/use-checkin";

const TEXT_SECONDARY = "#8A8A8A";

type ClassData = {
  id: string;
  name: string;
  description?: string | null;
  instructorName?: string;
  dayOfWeekLabel: string;
  startTime: string;
  endTime: string;
  capacity: number | null;
  checkinCount: number;
};

type ClassDetailViewProps = {
  classData: ClassData;
  checkins?: (CheckinItem & { userName: string; userProfileImageUrl?: string | null })[];
  canEdit?: boolean;
  canDelete?: boolean;
  canCheckin?: boolean;
  checkinDone?: boolean;
  checkinDisabled?: boolean;
  checkinDisabledReason?: string;
  showCheckins?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onCheckin?: () => void;
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-3 py-1">
      <Icon size={16} color={TEXT_SECONDARY} />
      <View style={{ gap: 1 }}>
        <Text className="font-poppins text-[11px] text-muted">{label}</Text>
        <Text className="font-poppins-medium text-sm text-primary">{value}</Text>
      </View>
    </View>
  );
}

export function ClassDetailView({
  classData,
  checkins,
  canEdit,
  canDelete,
  canCheckin,
  checkinDone,
  checkinDisabled,
  checkinDisabledReason,
  showCheckins,
  onEdit,
  onDelete,
  onCheckin,
}: ClassDetailViewProps) {
  const handleDelete = () => {
    Alert.alert("Excluir aula", `Tem certeza que deseja excluir "${classData.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: onDelete },
    ]);
  };

  return (
    <>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pb-2 pt-2">
        <BackButton />
        <Text className="font-poppins-bold text-lg text-primary">
          Detalhes da aula
        </Text>
        {canEdit ? (
          <Pressable
            onPress={onEdit}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <Pencil size={18} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View className="h-10 w-10" />
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Class info card */}
        <View
          className="rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 20, gap: 16 }}
        >
          <View style={{ gap: 4 }}>
            <Text className="font-poppins-bold text-xl text-primary">
              {classData.name}
            </Text>
            {classData.description ? (
              <Text className="font-poppins text-sm text-muted">
                {classData.description}
              </Text>
            ) : null}
          </View>

          <View className="h-px w-full bg-surface-border" />

          <View className="flex-row flex-wrap" style={{ gap: 16 }}>
            <View className="flex-1" style={{ minWidth: 140 }}>
              <InfoRow icon={Clock} label="Horário" value={`${classData.startTime} — ${classData.endTime}`} />
            </View>
            <View className="flex-1" style={{ minWidth: 140 }}>
              <InfoRow icon={User} label="Instrutor" value={classData.instructorName ?? "—"} />
            </View>
            <View className="flex-1" style={{ minWidth: 140 }}>
              <InfoRow icon={Calendar} label="Dia" value={classData.dayOfWeekLabel} />
            </View>
            <View className="flex-1" style={{ minWidth: 140 }}>
              <InfoRow
                icon={Users}
                label="Vagas"
                value={classData.capacity != null ? `${classData.checkinCount} / ${classData.capacity} alunos` : "Ilimitado"}
              />
            </View>
          </View>

          <CapacityBar current={classData.checkinCount} max={classData.capacity} />
        </View>

        {/* Check-ins section */}
        {showCheckins ? (
          <>
            <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
              Check-ins de hoje
            </Text>
            <View style={{ gap: 10 }}>
              {(!checkins || checkins.length === 0) ? (
                <View className="items-center rounded-xl border border-surface-border bg-surface py-6">
                  <Text className="font-poppins text-sm text-muted">
                    Nenhum check-in registrado
                  </Text>
                </View>
              ) : (
                checkins.map((c) => (
                  <CheckinListItem
                    key={c.id}
                    userName={c.userName}
                    userProfileImageUrl={c.userProfileImageUrl}
                    checkedInAt={c.checkedInAt}
                  />
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Bottom actions */}
      <View className="px-6 pb-6" style={{ gap: 12 }}>
        {canCheckin ? (
          <Pressable
            onPress={
              checkinDisabled && checkinDisabledReason
                ? () => Alert.alert("Check-in indisponível", checkinDisabledReason)
                : onCheckin
            }
            disabled={checkinDone}
          >
            <View className="overflow-hidden rounded-xl">
              <LinearGradient
                colors={checkinDone || checkinDisabled ? ["#3A3A3A", "#3A3A3A"] : ["#A078E8", "#7C5CBF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="h-[52px] flex-row items-center justify-center gap-2"
              >
                {checkinDone ? (
                  <>
                    <Check size={18} color="#4ADE80" />
                    <Text className="font-poppins-semibold text-[15px]" style={{ color: "#4ADE80" }}>
                      Check-in realizado
                    </Text>
                  </>
                ) : (
                  <Text className="font-poppins-semibold text-[15px] text-white">
                    Fazer check-in
                  </Text>
                )}
              </LinearGradient>
            </View>
          </Pressable>
        ) : null}

        {canDelete ? (
          <Pressable
            onPress={handleDelete}
            className="h-[52px] flex-row items-center justify-center gap-2 rounded-xl border"
            style={{ backgroundColor: "#FF453A15", borderColor: "#FF453A40" }}
          >
            <Trash2 size={18} color="#FF453A" />
            <Text className="font-poppins-semibold text-[15px]" style={{ color: "#FF453A" }}>
              Excluir aula
            </Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/components/ClassDetailView.tsx
git commit -m "feat(mobile): add ClassDetailView shared component"
```

---

## Task 8: Create ClassForm component

**Status:** Done — commit `feat(mobile): add ClassForm shared component` (aligned with `design.pen` e3e4u M-MGR-09: 52px selects with `ChevronDown`, field spacing 16; multi-day chips per plan/spec).

**Files:**
- Create: `apps/mobile/components/ClassForm.tsx`

- [x] **Step 1: Create ClassForm**

```typescript
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check, Lock } from "lucide-react-native";
import { FormInput } from "@/components/FormInput";
import { BackButton } from "@/components/BackButton";

const DAY_LABELS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const DAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const TEXT_SECONDARY = "#8A8A8A";

type Instructor = { id: string; name: string };

export type ClassFormData = {
  name: string;
  description: string;
  instructorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number | null;
  /** Only for create mode — additional days to create on */
  extraDays?: number[];
};

type ClassFormProps = {
  mode: "create" | "edit";
  canSelectInstructor?: boolean;
  currentInstructorName?: string;
  instructors?: Instructor[];
  initialData?: Partial<ClassFormData>;
  onSubmit: (data: ClassFormData) => void;
  isSubmitting?: boolean;
};

export function ClassForm({
  mode,
  canSelectInstructor,
  currentInstructorName,
  instructors,
  initialData,
  onSubmit,
  isSubmitting,
}: ClassFormProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [instructorId, setInstructorId] = useState(initialData?.instructorId ?? "");
  const [dayOfWeek, setDayOfWeek] = useState(initialData?.dayOfWeek ?? 1);
  const [startTime, setStartTime] = useState(initialData?.startTime ?? "");
  const [endTime, setEndTime] = useState(initialData?.endTime ?? "");
  const [capacityText, setCapacityText] = useState(
    initialData?.capacity != null ? String(initialData.capacity) : "",
  );
  const [unlimited, setUnlimited] = useState(initialData?.capacity === null);
  const [selectedExtraDays, setSelectedExtraDays] = useState<number[]>([]);
  const [showInstructorPicker, setShowInstructorPicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);

  const selectedInstructor = instructors?.find((i) => i.id === instructorId);

  const handleSubmit = () => {
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      instructorId,
      dayOfWeek,
      startTime,
      endTime,
      capacity: unlimited ? null : Number(capacityText) || null,
      extraDays: mode === "create" ? selectedExtraDays : undefined,
    });
  };

  const toggleExtraDay = (day: number) => {
    setSelectedExtraDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const title = mode === "create" ? "Nova aula" : "Editar aula";

  return (
    <>
      <View className="flex-row items-center justify-between px-6 pb-2 pt-2">
        <BackButton />
        <Text className="font-poppins-bold text-lg text-primary">{title}</Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <FormInput
          label="Nome da aula"
          value={name}
          onChangeText={setName}
          placeholder="Ex: Fundamentals"
        />

        <FormInput
          label="Descrição"
          value={description}
          onChangeText={setDescription}
          placeholder="Descrição opcional da aula..."
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: "top" }}
        />

        {/* Instructor field */}
        <View style={{ gap: 6 }}>
          <Text className="font-poppins-medium text-[13px] text-muted">
            {canSelectInstructor ? "Instrutor" : "Instrutor (definido automaticamente)"}
          </Text>
          {canSelectInstructor ? (
            <>
              <Pressable
                onPress={() => setShowInstructorPicker(!showInstructorPicker)}
                className="h-[52px] flex-row items-center justify-between rounded-xl border border-surface-border bg-surface px-4"
              >
                <Text className={`font-poppins text-[15px] ${selectedInstructor ? "text-primary" : "text-muted"}`}>
                  {selectedInstructor?.name ?? "Selecionar instrutor"}
                </Text>
              </Pressable>
              {showInstructorPicker && instructors ? (
                <View className="rounded-xl border border-surface-border bg-surface">
                  {instructors.map((inst) => (
                    <Pressable
                      key={inst.id}
                      onPress={() => {
                        setInstructorId(inst.id);
                        setShowInstructorPicker(false);
                      }}
                      className="flex-row items-center justify-between border-b border-surface-border px-4 py-3"
                    >
                      <Text className="font-poppins text-sm text-primary">{inst.name}</Text>
                      {inst.id === instructorId ? <Check size={16} color="#A078E8" /> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <View className="h-[52px] flex-row items-center gap-2.5 rounded-xl border border-surface-border bg-surface px-4">
              <Text className="flex-1 font-poppins text-[15px] text-primary">
                {currentInstructorName ?? "—"}
              </Text>
              <Lock size={16} color="#525252" />
            </View>
          )}
        </View>

        {/* Day of week */}
        <View style={{ gap: 6 }}>
          <Text className="font-poppins-medium text-[13px] text-muted">Dia da semana</Text>
          <Pressable
            onPress={() => setShowDayPicker(!showDayPicker)}
            className="h-[52px] flex-row items-center justify-between rounded-xl border border-surface-border bg-surface px-4"
          >
            <Text className="font-poppins text-[15px] text-primary">
              {DAY_LABELS[dayOfWeek]}
            </Text>
          </Pressable>
          {showDayPicker ? (
            <View className="rounded-xl border border-surface-border bg-surface">
              {DAY_LABELS.map((label, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    setDayOfWeek(i);
                    setShowDayPicker(false);
                  }}
                  className="flex-row items-center justify-between border-b border-surface-border px-4 py-3"
                >
                  <Text className="font-poppins text-sm text-primary">{label}</Text>
                  {i === dayOfWeek ? <Check size={16} color="#A078E8" /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* Time row */}
        <View className="flex-row" style={{ gap: 12 }}>
          <View className="flex-1">
            <FormInput
              label="Início"
              value={startTime}
              onChangeText={setStartTime}
              placeholder="19:00"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View className="flex-1">
            <FormInput
              label="Término"
              value={endTime}
              onChangeText={setEndTime}
              placeholder="20:30"
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        {/* Capacity */}
        <View style={{ gap: 6 }}>
          <View className="flex-row items-center justify-between">
            <Text className="font-poppins-medium text-[13px] text-muted">Capacidade máxima</Text>
            <View className="flex-row items-center gap-2">
              <Text className="font-poppins text-xs text-muted">Ilimitado</Text>
              <Switch
                value={unlimited}
                onValueChange={(v) => {
                  setUnlimited(v);
                  if (v) setCapacityText("");
                }}
                trackColor={{ false: "#3A3A3A", true: "#A078E8" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
          {!unlimited ? (
            <FormInput
              label=""
              value={capacityText}
              onChangeText={setCapacityText}
              placeholder="20"
              keyboardType="number-pad"
            />
          ) : null}
        </View>

        {/* Multi-day checkboxes (create only) */}
        {mode === "create" ? (
          <View
            className="rounded-xl border border-surface-border bg-surface"
            style={{ padding: 16, gap: 12 }}
          >
            <View style={{ gap: 2 }}>
              <Text className="font-poppins-semibold text-sm text-primary">
                Criar para múltiplos dias
              </Text>
              <Text className="font-poppins text-xs text-muted">
                Repita esta aula em outros dias da semana
              </Text>
            </View>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {DAY_SHORT.map((label, i) => {
                if (i === dayOfWeek) return null;
                const selected = selectedExtraDays.includes(i);
                return (
                  <Pressable
                    key={i}
                    onPress={() => toggleExtraDay(i)}
                    className={`items-center justify-center rounded-lg border px-3 py-2 ${
                      selected
                        ? "border-accent bg-accent-translucent"
                        : "border-surface-border bg-surface"
                    }`}
                  >
                    <Text
                      className={`font-poppins-medium text-xs ${
                        selected ? "text-accent" : "text-muted"
                      }`}
                      style={selected ? { color: "#A078E8" } : undefined}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Save button */}
      <View className="px-6 pb-6">
        <Pressable onPress={handleSubmit} disabled={isSubmitting || !name.trim()}>
          <View className="overflow-hidden rounded-xl">
            <LinearGradient
              colors={isSubmitting || !name.trim() ? ["#3A3A3A", "#3A3A3A"] : ["#A078E8", "#7C5CBF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="h-14 flex-row items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Check size={20} color="#FFFFFF" />
                  <Text className="font-poppins-semibold text-base text-white">
                    Salvar aula
                  </Text>
                </>
              )}
            </LinearGradient>
          </View>
        </Pressable>
      </View>
    </>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/components/ClassForm.tsx
git commit -m "feat(mobile): add ClassForm shared component"
```

---

## Task 9: Manager schedule screen (M-MGR-07)

**Status:** Done — commit `feat(mobile): implement manager class schedule screen (M-MGR-07)` (date label `text-muted` / design.pen `zREdY` `agPdx`).

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/(classes)/index.tsx`

- [x] **Step 1: Replace placeholder with schedule screen**

Replace contents of `apps/mobile/app/(app)/(manager)/(classes)/index.tsx`:

```typescript
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { BackButton } from "@/components/BackButton";
import { ClassCard } from "@/components/ClassCard";
import { WeekDayStrip } from "@/components/WeekDayStrip";
import { useClasses } from "@/lib/hooks/use-classes";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";

const DAY_NAMES = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

function formatTime(t: string) {
  const parts = t.split(":");
  const h = parts[0] ?? "0";
  const m = parts[1] ?? "00";
  return `${h.padStart(2, "0")}:${m}`;
}

function getDateLabel(dayOfWeek: number): string {
  const today = new Date();
  const diff = dayOfWeek - today.getDay();
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  const dayName = DAY_NAMES[dayOfWeek];
  const d = target.getDate();
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const monthName = months[target.getMonth()];
  return `${dayName}, ${d} de ${monthName}`;
}

export default function ManagerClassSchedule() {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const { data: classes, isLoading } = useClasses(selectedDay);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center justify-between px-6 pb-2 pt-2">
        <BackButton />
        <Text className="font-poppins-bold text-lg text-primary">Agenda</Text>
        <Pressable
          onPress={() => router.push("/(app)/(manager)/(classes)/create")}
          className="h-10 w-10 items-center justify-center rounded-xl bg-accent"
        >
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <WeekDayStrip selectedDay={selectedDay} onDaySelect={setSelectedDay} />

        <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
          {getDateLabel(selectedDay)}
        </Text>

        <View style={{ gap: 10 }}>
          {isLoading ? (
            <View className="items-center py-8">
              <Text className="font-poppins text-sm text-muted">Carregando...</Text>
            </View>
          ) : !classes || classes.length === 0 ? (
            <View className="items-center rounded-[14px] border border-surface-border bg-surface py-8">
              <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                Nenhuma aula neste dia
              </Text>
            </View>
          ) : (
            classes.map((cls) => (
              <ClassCard
                key={cls.id}
                name={cls.name}
                startTime={formatTime(cls.startTime)}
                endTime={formatTime(cls.endTime)}
                instructorName={cls.instructorName}
                capacity={cls.capacity}
                onPress={() => router.push(`/(app)/(manager)/(classes)/${cls.id}`)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(classes)/index.tsx
git commit -m "feat(mobile): implement manager class schedule screen (M-MGR-07)"
```

---

## Task 10: Manager class detail screen (M-MGR-08)

**Status:** Done — commit `feat(mobile): implement manager class detail screen (M-MGR-08)` (UI from `ClassDetailView`, matches design.pen `jon0a`; route param normalized; error / missing id states).

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(classes)/[classId].tsx`

- [x] **Step 1: Create class detail screen**

```typescript
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ClassDetailView } from "@/components/ClassDetailView";
import { useClass, useDeleteClass } from "@/lib/hooks/use-classes";
import { useClassCheckins } from "@/lib/hooks/use-checkin";
import { ActivityIndicator, View } from "react-native";

const DAY_NAMES = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

function formatTime(t: string) {
  const parts = t.split(":");
  const h = parts[0] ?? "0";
  const m = parts[1] ?? "00";
  return `${h.padStart(2, "0")}:${m}`;
}

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ManagerClassDetail() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const router = useRouter();
  const { data: cls, isLoading } = useClass(classId);
  const today = todayDateString();
  const { data: checkins } = useClassCheckins(classId, today);
  const deleteClass = useDeleteClass();

  if (isLoading || !cls) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ClassDetailView
        classData={{
          id: cls.id,
          name: cls.name,
          description: cls.description,
          instructorName: cls.instructorName,
          dayOfWeekLabel: DAY_NAMES[cls.dayOfWeek] ?? "",
          startTime: formatTime(cls.startTime),
          endTime: formatTime(cls.endTime),
          capacity: cls.capacity,
          checkinCount: checkins?.length ?? 0,
        }}
        checkins={checkins?.map((c) => ({
          ...c,
          userName: c.userName ?? "Aluno",
          userProfileImageUrl: c.userProfileImageUrl,
        }))}
        canEdit
        canDelete
        showCheckins
        onEdit={() => router.push(`/(app)/(manager)/(classes)/edit/${classId}`)}
        onDelete={() => {
          deleteClass.mutate(classId, {
            onSuccess: () => router.back(),
          });
        }}
      />
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(classes)/[classId].tsx
git commit -m "feat(mobile): implement manager class detail screen (M-MGR-08)"
```

---

## Task 11: Manager create & edit class screens (M-MGR-09)

**Status:** Done — commit `feat(mobile): implement manager create/edit class screens (M-MGR-09)` (UI from `ClassForm` / design.pen `e3e4u`; create dedupes days + `ApiError` alert; edit normalizes `classId`).

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(classes)/create.tsx`
- Create: `apps/mobile/app/(app)/(manager)/(classes)/edit/[classId].tsx`

- [x] **Step 1: Create create.tsx**

```typescript
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ClassForm, type ClassFormData } from "@/components/ClassForm";
import { useCreateClass } from "@/lib/hooks/use-classes";
import { useAcademyContext } from "@/lib/academy-context";
import { useMembers } from "@/lib/hooks/use-membership";

export default function ManagerCreateClass() {
  const router = useRouter();
  const { academyId } = useAcademyContext();
  const createClass = useCreateClass();
  const { data: members } = useMembers(academyId, { role: "instructor", status: "active" });

  const instructors = (members ?? []).map((m) => ({
    id: m.userId,
    name: m.userName,
  }));

  const handleSubmit = async (data: ClassFormData) => {
    const daysToCreate = [data.dayOfWeek, ...(data.extraDays ?? [])];

    for (const day of daysToCreate) {
      await createClass.mutateAsync({
        instructorId: data.instructorId,
        name: data.name,
        description: data.description || null,
        dayOfWeek: day,
        startTime: data.startTime,
        endTime: data.endTime,
        capacity: data.capacity,
      });
    }

    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ClassForm
        mode="create"
        canSelectInstructor
        instructors={instructors}
        onSubmit={handleSubmit}
        isSubmitting={createClass.isPending}
      />
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Create edit directory and edit/[classId].tsx**

Run: `mkdir -p apps/mobile/app/\(app\)/\(manager\)/\(classes\)/edit`

Then create `apps/mobile/app/(app)/(manager)/(classes)/edit/[classId].tsx`:

```typescript
import { ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ClassForm, type ClassFormData } from "@/components/ClassForm";
import { useClass, useUpdateClass } from "@/lib/hooks/use-classes";
import { useAcademyContext } from "@/lib/academy-context";
import { useMembers } from "@/lib/hooks/use-membership";

function formatTime(t: string) {
  const parts = t.split(":");
  const h = parts[0] ?? "0";
  const m = parts[1] ?? "00";
  return `${h.padStart(2, "0")}:${m}`;
}

export default function ManagerEditClass() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const router = useRouter();
  const { academyId } = useAcademyContext();
  const { data: cls, isLoading } = useClass(classId);
  const updateClass = useUpdateClass(classId);
  const { data: members } = useMembers(academyId, { role: "instructor", status: "active" });

  if (isLoading || !cls) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const instructors = (members ?? []).map((m) => ({
    id: m.userId,
    name: m.userName,
  }));

  const handleSubmit = (data: ClassFormData) => {
    updateClass.mutate(
      {
        name: data.name,
        description: data.description || null,
        instructorId: data.instructorId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        capacity: data.capacity,
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ClassForm
        mode="edit"
        canSelectInstructor
        instructors={instructors}
        initialData={{
          name: cls.name,
          description: cls.description ?? "",
          instructorId: cls.instructorId,
          dayOfWeek: cls.dayOfWeek,
          startTime: formatTime(cls.startTime),
          endTime: formatTime(cls.endTime),
          capacity: cls.capacity,
        }}
        onSubmit={handleSubmit}
        isSubmitting={updateClass.isPending}
      />
    </SafeAreaView>
  );
}
```

- [x] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(classes)/create.tsx apps/mobile/app/(app)/(manager)/(classes)/edit/
git commit -m "feat(mobile): implement manager create/edit class screens (M-MGR-09)"
```

---

## Task 12: Update app layout for instructor/student routing

**Files:**
- Modify: `apps/mobile/app/(app)/_layout.tsx`

- [x] **Step 1: Update routing logic and provide AcademyProvider for all active roles**

Replace the `useEffect` routing logic in `apps/mobile/app/(app)/_layout.tsx` to handle instructor and student routing:

The current code at line 38-39 routes active instructors/students back to pending-approval as a temporary placeholder. Replace:

```typescript
} else if (user.activeMembership.status === "active") {
  // Temporary route until instructor/student home exists.
  router.replace("/(app)/(joining)/pending-approval");
}
```

with:

```typescript
} else if (user.activeMembership.status === "active") {
  if (user.activeRole === "instructor") {
    router.replace("/(app)/(instructor)/(home)");
  } else {
    router.replace("/(app)/(student)/(home)");
  }
}
```

Also update the `academyContext` logic at lines 76-83 to provide academy info from `activeMembership` for instructors/students:

Replace:
```typescript
const academyContext =
  user.activeRole === "manager" && user.activeAcademy
    ? {
        academyId: user.activeAcademy.id,
        academyName: user.activeAcademy.name,
        academyLogoUrl: user.activeAcademy.logoUrl,
      }
    : null;
```

with:

```typescript
const academyContext =
  user.activeRole === "manager" && user.activeAcademy
    ? {
        academyId: user.activeAcademy.id,
        academyName: user.activeAcademy.name,
        academyLogoUrl: user.activeAcademy.logoUrl,
      }
    : user.activeMembership && user.activeMembership.status === "active"
      ? {
          academyId: user.activeMembership.academyId,
          academyName: user.activeMembership.academyName,
          academyLogoUrl: user.activeMembership.academyLogoUrl,
        }
      : null;
```

This ensures the `AcademyProvider` wraps instructor and student screens too.

- [x] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/_layout.tsx
git commit -m "feat(mobile): route active instructors/students to their home screens"
```

---

## Task 13: Instructor layout and home screen

**Files:**
- Create: `apps/mobile/app/(app)/(instructor)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(instructor)/(home)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(instructor)/(home)/index.tsx`
- Create: `apps/mobile/app/(app)/(instructor)/(classes)/_layout.tsx`

- [x] **Step 1: Create instructor tab layout**

Create `apps/mobile/app/(app)/(instructor)/_layout.tsx`:

```typescript
import { Tabs } from "expo-router";
import { Award, Calendar, Home, School } from "lucide-react-native";
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
        name="(graduation)"
        options={{
          title: "Graduação",
          tabBarIcon: ({ color, size }) => <Award size={size} color={color} />,
          href: null, // Placeholder — hidden for now
        }}
      />
      <Tabs.Screen
        name="(academy)"
        options={{
          title: "Academia",
          tabBarIcon: ({ color, size }) => <School size={size} color={color} />,
          href: null, // Placeholder — hidden for now
        }}
      />
    </Tabs>
  );
}
```

- [x] **Step 2: Create home and classes stack layouts**

Create `apps/mobile/app/(app)/(instructor)/(home)/_layout.tsx`:

```typescript
import { Stack } from "expo-router";

export default function InstructorHomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0C0C0C" },
      }}
    />
  );
}
```

Create `apps/mobile/app/(app)/(instructor)/(classes)/_layout.tsx` (identical):

```typescript
import { Stack } from "expo-router";

export default function InstructorClassesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0C0C0C" },
      }}
    />
  );
}
```

- [x] **Step 3: Create instructor home screen**

Create `apps/mobile/app/(app)/(instructor)/(home)/index.tsx`:

```typescript
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { ClassCard } from "@/components/ClassCard";
import { useAcademyContext } from "@/lib/academy-context";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useClasses } from "@/lib/hooks/use-classes";
import { useApi } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";

function greetingPrefix(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia,";
  if (h < 18) return "Boa tarde,";
  return "Boa noite,";
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function formatTime(t: string) {
  const parts = t.split(":");
  const h = parts[0] ?? "0";
  const m = parts[1] ?? "00";
  return `${h.padStart(2, "0")}:${m}`;
}

export default function InstructorHome() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { academyId, academyName, academyLogoUrl } = useAcademyContext();
  const { data: me } = useCurrentUser();
  const dayOfWeek = new Date().getDay();
  const { data: classes } = useClasses(dayOfWeek);
  const [refreshing, setRefreshing] = useState(false);

  const api = useApi();
  const { data: statsData } = useQuery({
    queryKey: ["instructor-stats", academyId],
    queryFn: () =>
      api.get<{ classesThisWeek: number; checkinsToday: number; classesToday: number }>(
        `/academies/${academyId}/stats`,
      ),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["classes", dayOfWeek] }),
      queryClient.invalidateQueries({ queryKey: ["instructor-stats", academyId] }),
    ]);
    setRefreshing(false);
  };

  const instructorFirst = firstName(me?.name ?? "");
  const avatarLetter = (instructorFirst || "?").charAt(0).toUpperCase();
  const todayClasses = classes?.slice(0, 3) ?? [];

  return (
    <SafeAreaView className="flex-1 pt-6 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A078E8" />
        }
      >
        <View className="pb-8" style={{ paddingTop: 4, paddingHorizontal: 24, gap: 24 }}>
          {/* Greeting */}
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
                {greetingPrefix()}
              </Text>
              <Text
                className="font-poppins-bold text-primary"
                style={{ fontSize: 22, letterSpacing: -0.5 }}
              >
                {instructorFirst || "Instrutor"}
              </Text>
            </View>
            <Avatar variant="user" imageUrl={me?.profileImageUrl} fallbackLetter={avatarLetter} />
          </View>

          {/* Academy card */}
          <View
            className="rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 20, gap: 16 }}
          >
            <View className="flex-row items-center gap-3">
              <Avatar variant="brand" imageUrl={academyLogoUrl} />
              <View className="min-w-0 flex-1" style={{ gap: 2 }}>
                <Text className="font-poppins-semibold text-base text-primary">
                  {academyName}
                </Text>
              </View>
            </View>
            <View className="h-px w-full bg-surface-border" />
            <View className="flex-row">
              <View className="flex-1 items-center" style={{ gap: 4 }}>
                <Text className="font-poppins-bold text-primary" style={{ fontSize: 22 }}>
                  {statsData?.classesThisWeek ?? 0}
                </Text>
                <Text className="font-poppins text-center text-[11px]" style={{ color: TEXT_SECONDARY }}>
                  Aulas{"\n"}esta semana
                </Text>
              </View>
              <View className="flex-1 items-center" style={{ gap: 4 }}>
                <Text className="font-poppins-bold text-primary" style={{ fontSize: 22 }}>
                  {statsData?.checkinsToday ?? 0}
                </Text>
                <Text className="font-poppins text-center text-[11px]" style={{ color: TEXT_SECONDARY }}>
                  Check-ins{"\n"}hoje
                </Text>
              </View>
              <View className="flex-1 items-center" style={{ gap: 4 }}>
                <Text className="font-poppins-bold text-primary" style={{ fontSize: 22 }}>
                  {statsData?.classesToday ?? 0}
                </Text>
                <Text className="font-poppins text-center text-[11px]" style={{ color: TEXT_SECONDARY }}>
                  Aulas{"\n"}hoje
                </Text>
              </View>
            </View>
          </View>

          {/* Today's classes */}
          <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
            Aulas de hoje
          </Text>
          <View style={{ gap: 10 }}>
            {todayClasses.length === 0 ? (
              <View className="items-center rounded-[14px] border border-surface-border bg-surface py-8">
                <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                  Nenhuma aula agendada para hoje
                </Text>
              </View>
            ) : (
              todayClasses.map((cls) => (
                <ClassCard
                  key={cls.id}
                  name={cls.name}
                  startTime={formatTime(cls.startTime)}
                  endTime={formatTime(cls.endTime)}
                  instructorName={cls.instructorName}
                  onPress={() => router.push(`/(app)/(instructor)/(classes)/${cls.id}`)}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/(instructor)/
git commit -m "feat(mobile): add instructor layout, home screen, and class stack layouts"
```

---

## Task 14: Instructor class screens (M-INS-05/06/07)

**Files:**
- Create: `apps/mobile/app/(app)/(instructor)/(classes)/index.tsx`
- Create: `apps/mobile/app/(app)/(instructor)/(classes)/[classId].tsx`
- Create: `apps/mobile/app/(app)/(instructor)/(classes)/create.tsx`
- Create: `apps/mobile/app/(app)/(instructor)/(classes)/edit/[classId].tsx`

These are thin wrappers identical to the manager versions with different permissions.

- [ ] **Step 1: Create instructor schedule screen**

Create `apps/mobile/app/(app)/(instructor)/(classes)/index.tsx`. Same as manager schedule (Task 9) but:
- Title: "Minhas aulas"
- Route prefix: `/(app)/(instructor)/(classes)/`
- Keep the `+` button routing to `/(app)/(instructor)/(classes)/create`

Copy the manager schedule screen contents and change:
- Title from "Agenda" to "Minhas aulas"
- All route prefixes from `/(app)/(manager)/(classes)/` to `/(app)/(instructor)/(classes)/`

- [ ] **Step 2: Create instructor class detail**

Create `apps/mobile/app/(app)/(instructor)/(classes)/[classId].tsx`. Same as manager detail (Task 10) but:
- `canEdit` = true, `canDelete` = false
- `showCheckins` = true
- Edit route: `/(app)/(instructor)/(classes)/edit/${classId}`

Copy the manager detail screen contents and change:
- Remove `canDelete` prop
- Remove `onDelete` handler and `useDeleteClass` hook
- Change edit route prefix

- [ ] **Step 3: Create instructor create/edit screens**

Create `apps/mobile/app/(app)/(instructor)/(classes)/create.tsx`:

```typescript
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ClassForm, type ClassFormData } from "@/components/ClassForm";
import { useCreateClass } from "@/lib/hooks/use-classes";
import { useCurrentUser } from "@/lib/hooks/use-user";

export default function InstructorCreateClass() {
  const router = useRouter();
  const createClass = useCreateClass();
  const { data: me } = useCurrentUser();

  const handleSubmit = async (data: ClassFormData) => {
    const daysToCreate = [data.dayOfWeek, ...(data.extraDays ?? [])];
    for (const day of daysToCreate) {
      await createClass.mutateAsync({
        instructorId: me!.id,
        name: data.name,
        description: data.description || null,
        dayOfWeek: day,
        startTime: data.startTime,
        endTime: data.endTime,
        capacity: data.capacity,
      });
    }
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ClassForm
        mode="create"
        canSelectInstructor={false}
        currentInstructorName={me?.name}
        onSubmit={handleSubmit}
        isSubmitting={createClass.isPending}
      />
    </SafeAreaView>
  );
}
```

Create `apps/mobile/app/(app)/(instructor)/(classes)/edit/[classId].tsx`:

Same as manager edit (Task 11 step 2) but:
- `canSelectInstructor={false}`
- `currentInstructorName={me?.name}` instead of instructor list
- Remove `useMembers` and `useAcademyContext`
- Add `useCurrentUser` to get instructor name
- Set `instructorId: me!.id` in the submit

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/(instructor)/(classes)/
git commit -m "feat(mobile): implement instructor class screens (M-INS-05/06/07)"
```

---

## Task 15: Student layout and register belt screen

**Files:**
- Create: `apps/mobile/app/(app)/(student)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(student)/(home)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(student)/(classes)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(student)/register-belt.tsx`

- [ ] **Step 1: Create student stack layout (no tabs)**

Create `apps/mobile/app/(app)/(student)/_layout.tsx`:

```typescript
import { Stack } from "expo-router";

export default function StudentLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0C0C0C" },
      }}
    />
  );
}
```

Create `apps/mobile/app/(app)/(student)/(home)/_layout.tsx`:

```typescript
import { Stack } from "expo-router";

export default function StudentHomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0C0C0C" },
      }}
    />
  );
}
```

Create `apps/mobile/app/(app)/(student)/(classes)/_layout.tsx`:

```typescript
import { Stack } from "expo-router";

export default function StudentClassesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0C0C0C" },
      }}
    />
  );
}
```

- [ ] **Step 2: Create register belt screen (M-STU-04)**

Create `apps/mobile/app/(app)/(student)/register-belt.tsx`:

```typescript
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Award, Check } from "lucide-react-native";
import { GradientButton } from "@/components/GradientButton";
import { BackButton } from "@/components/BackButton";
import { useRegisterBelt } from "@/lib/hooks/use-graduation";
import type { Belt } from "@tatame/types";

const BELTS: { value: Belt; label: string; color: string }[] = [
  { value: "white", label: "Branca", color: "#E0E0E0" },
  { value: "blue", label: "Azul", color: "#2196F3" },
  { value: "purple", label: "Roxa", color: "#9C27B0" },
  { value: "brown", label: "Marrom", color: "#795548" },
  { value: "black", label: "Preta", color: "#212121" },
];

const STRIPES = [0, 1, 2, 3, 4];

export default function RegisterBelt() {
  const router = useRouter();
  const registerBelt = useRegisterBelt();
  const [selectedBelt, setSelectedBelt] = useState<Belt | null>(null);
  const [selectedStripes, setSelectedStripes] = useState(0);

  const handleConfirm = () => {
    if (!selectedBelt) return;
    registerBelt.mutate(
      { belt: selectedBelt, stripes: selectedStripes },
      { onSuccess: () => router.replace("/(app)/(student)/(home)") },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center justify-between px-6 pb-2 pt-2">
        <BackButton />
        <Text className="font-poppins-bold text-lg text-primary">Registrar faixa</Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="items-center" style={{ gap: 8 }}>
          <View className="h-20 w-20 items-center justify-center rounded-full bg-accent-translucent">
            <Award size={36} color="#A078E8" />
          </View>
          <Text className="font-poppins-bold text-xl text-primary text-center">
            Qual é sua faixa atual?
          </Text>
          <Text className="font-poppins text-sm text-muted text-center" style={{ lineHeight: 21 }}>
            Selecione sua faixa e graus atuais. Após o registro, apenas seu instrutor ou gestor poderá alterar.
          </Text>
        </View>

        {/* Belt selection */}
        <View className="rounded-2xl border border-surface-border bg-surface overflow-hidden">
          <View className="px-4 pb-2 pt-4">
            <Text className="font-poppins-semibold text-[13px] text-muted">Faixa</Text>
          </View>
          {BELTS.map((belt, index) => {
            const isSelected = selectedBelt === belt.value;
            return (
              <View key={belt.value}>
                {index > 0 ? <View className="mx-4 h-px bg-surface-border" /> : null}
                <Pressable
                  onPress={() => setSelectedBelt(belt.value)}
                  className={`flex-row items-center gap-3 px-4 py-3.5 ${isSelected ? "bg-accent-translucent" : ""}`}
                >
                  <View
                    className="h-6 w-6 rounded-full border-2"
                    style={{
                      backgroundColor: belt.color,
                      borderColor: isSelected ? "#A078E8" : "#3A3A3A",
                    }}
                  />
                  <Text className="flex-1 font-poppins-medium text-sm text-primary">
                    {belt.label}
                  </Text>
                  {isSelected ? <Check size={18} color="#A078E8" /> : null}
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Stripe selection */}
        <View
          className="rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 16, gap: 12 }}
        >
          <Text className="font-poppins-semibold text-[13px] text-muted">Graus</Text>
          <View className="flex-row items-center justify-center" style={{ gap: 8 }}>
            {STRIPES.map((s) => {
              const isSelected = selectedStripes === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSelectedStripes(s)}
                  className={`h-11 w-11 items-center justify-center rounded-lg border ${
                    isSelected
                      ? "border-accent bg-accent"
                      : "border-surface-border bg-surface"
                  }`}
                >
                  <Text
                    className={`font-poppins-bold text-base ${
                      isSelected ? "text-white" : "text-primary"
                    }`}
                  >
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View className="px-6 pb-6">
        <GradientButton
          label="Confirmar faixa"
          onPress={handleConfirm}
          disabled={!selectedBelt}
          loading={registerBelt.isPending}
        />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/(student)/
git commit -m "feat(mobile): add student layout and register belt screen (M-STU-04)"
```

---

## Task 16: Student home screen (M-STU-05)

**Files:**
- Create: `apps/mobile/app/(app)/(student)/(home)/index.tsx`

- [ ] **Step 1: Create student home screen**

Create `apps/mobile/app/(app)/(student)/(home)/index.tsx`:

```typescript
import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell, ChevronRight, CreditCard, TriangleAlert } from "lucide-react-native";
import { ClassCard } from "@/components/ClassCard";
import { useAcademyContext } from "@/lib/academy-context";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useClasses } from "@/lib/hooks/use-classes";
import { useMySubscription } from "@/lib/hooks/use-subscription";
import { useMyGraduation } from "@/lib/hooks/use-graduation";
import { useCheckin } from "@/lib/hooks/use-checkin";
import { useQueryClient } from "@tanstack/react-query";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";

const BELT_COLORS: Record<string, string> = {
  white: "#E0E0E0",
  blue: "#2196F3",
  purple: "#9C27B0",
  brown: "#795548",
  black: "#212121",
};

const BELT_LABELS: Record<string, string> = {
  white: "Branca",
  blue: "Azul",
  purple: "Roxa",
  brown: "Marrom",
  black: "Preta",
};

function formatTime(t: string) {
  const parts = t.split(":");
  const h = parts[0] ?? "0";
  const m = parts[1] ?? "00";
  return `${h.padStart(2, "0")}:${m}`;
}

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function StudentHome() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { academyName, academyLogoUrl } = useAcademyContext();
  const { data: me } = useCurrentUser();
  const dayOfWeek = new Date().getDay();
  const { data: classes } = useClasses(dayOfWeek);
  const { data: subscription } = useMySubscription();
  const { data: graduation } = useMyGraduation();
  const checkin = useCheckin();
  const [refreshing, setRefreshing] = useState(false);

  const hasSubscription = subscription != null && subscription.status === "active";
  const today = todayDateString();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["classes", dayOfWeek] }),
      queryClient.invalidateQueries({ queryKey: ["subscription", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["graduation", "me"] }),
    ]);
    setRefreshing(false);
  };

  const handleCheckin = (classId: string) => {
    if (!hasSubscription) {
      Alert.alert(
        "Plano necessário",
        "Assine um plano para fazer check-in nas aulas.",
      );
      return;
    }
    checkin.mutate({ classId, date: today });
  };

  const address = me?.activeMembership
    ? `${me.activeMembership.academyName}`
    : "";

  return (
    <SafeAreaView className="flex-1 pt-6 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A078E8" />
        }
      >
        <View className="pb-8" style={{ paddingTop: 4, paddingHorizontal: 24, gap: 16 }}>
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View style={{ gap: 2 }}>
              <Text className="font-poppins-bold text-primary" style={{ fontSize: 20, letterSpacing: -0.5 }}>
                {academyName}
              </Text>
            </View>
            <Pressable className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface">
              <Bell size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Warning banner */}
          {!hasSubscription ? (
            <View className="flex-row items-center gap-2.5 rounded-xl px-4 py-3" style={{ backgroundColor: "#FF9F0A20" }}>
              <TriangleAlert size={18} color="#FF9F0A" />
              <Text className="flex-1 font-poppins text-[13px] text-primary">
                Você precisa assinar um plano para treinar.
              </Text>
            </View>
          ) : null}

          {/* Stats row */}
          <View className="flex-row" style={{ gap: 12 }}>
            <View
              className="flex-1 rounded-2xl border border-surface-border bg-surface"
              style={{ padding: 16, gap: 12 }}
            >
              <Text className="font-poppins-semibold text-xs text-muted">Faixa atual</Text>
              {graduation ? (
                <View className="flex-row items-center gap-2">
                  <View
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: BELT_COLORS[graduation.belt] ?? "#666" }}
                  />
                  <Text className="font-poppins-semibold text-sm text-primary">
                    {BELT_LABELS[graduation.belt] ?? graduation.belt}
                  </Text>
                  <Text className="font-poppins text-xs text-muted">
                    {graduation.stripes} graus
                  </Text>
                </View>
              ) : (
                <Text className="font-poppins text-sm text-muted">Não registrada</Text>
              )}
            </View>
            <View
              className="flex-1 rounded-2xl border border-surface-border bg-surface"
              style={{ padding: 16, gap: 4 }}
            >
              <Text className="font-poppins-semibold text-xs text-muted">Check-ins</Text>
              <Text className="font-poppins-bold text-primary" style={{ fontSize: 28 }}>
                {/* TODO: get actual weekly count from API when available */}
                0
              </Text>
              <Text className="font-poppins text-xs text-muted">esta semana</Text>
            </View>
          </View>

          {/* Subscription card */}
          <Pressable className="flex-row items-center gap-3 rounded-2xl border border-surface-border bg-surface p-4">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-translucent">
              <CreditCard size={18} color="#A078E8" />
            </View>
            <View className="min-w-0 flex-1" style={{ gap: 4 }}>
              {subscription ? (
                <>
                  <Text className="font-poppins-semibold text-sm text-primary">
                    {subscription.plan.name}
                  </Text>
                  <Text className="font-poppins text-xs text-muted">
                    Válido até {subscription.expiresAt.slice(0, 10).split("-").reverse().join("/")}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="font-poppins-semibold text-sm text-primary">
                    Nenhum plano ativo
                  </Text>
                  <Text className="font-poppins text-xs text-muted">
                    Assine um plano para treinar
                  </Text>
                </>
              )}
            </View>
            <ChevronRight size={18} color={TEXT_MUTED} />
          </Pressable>

          {/* Today's classes */}
          <View className="flex-row items-center justify-between">
            <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
              Aulas de hoje
            </Text>
            <Pressable onPress={() => router.push("/(app)/(student)/(classes)")}>
              <Text className="font-poppins-medium text-xs" style={{ color: "#A078E8" }}>
                Ver todas
              </Text>
            </Pressable>
          </View>

          <View style={{ gap: 10 }}>
            {!classes || classes.length === 0 ? (
              <View className="items-center rounded-[14px] border border-surface-border bg-surface py-8">
                <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                  Nenhuma aula agendada para hoje
                </Text>
              </View>
            ) : (
              classes.map((cls) => (
                <ClassCard
                  key={cls.id}
                  name={cls.name}
                  startTime={formatTime(cls.startTime)}
                  endTime={formatTime(cls.endTime)}
                  instructorName={cls.instructorName}
                  capacity={cls.capacity}
                  showCheckinButton
                  onCheckin={() => handleCheckin(cls.id)}
                  checkinDisabled={!hasSubscription}
                  checkinLabel={hasSubscription ? "Check-in" : "Check-in"}
                  onPress={() => router.push(`/(app)/(student)/(classes)/${cls.id}`)}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(student)/(home)/index.tsx
git commit -m "feat(mobile): implement student home screen (M-STU-05)"
```

---

## Task 17: Student class schedule and detail screens (M-STU-06/07)

**Files:**
- Create: `apps/mobile/app/(app)/(student)/(classes)/index.tsx`
- Create: `apps/mobile/app/(app)/(student)/(classes)/[classId].tsx`

- [ ] **Step 1: Create student weekly schedule**

Create `apps/mobile/app/(app)/(student)/(classes)/index.tsx`. Same as manager schedule (Task 9) but:
- Title: "Agenda semanal"
- No "+" button (replace with `<View className="h-10 w-10" />` spacer)
- Route prefix: `/(app)/(student)/(classes)/`

- [ ] **Step 2: Create student class detail**

Create `apps/mobile/app/(app)/(student)/(classes)/[classId].tsx`:

```typescript
import { Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { ClassDetailView } from "@/components/ClassDetailView";
import { useClass } from "@/lib/hooks/use-classes";
import { useCheckin } from "@/lib/hooks/use-checkin";
import { useMySubscription } from "@/lib/hooks/use-subscription";

const DAY_NAMES = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

function formatTime(t: string) {
  const parts = t.split(":");
  const h = parts[0] ?? "0";
  const m = parts[1] ?? "00";
  return `${h.padStart(2, "0")}:${m}`;
}

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function StudentClassDetail() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { data: cls, isLoading } = useClass(classId);
  const { data: subscription } = useMySubscription();
  const checkinMutation = useCheckin();

  const hasSubscription = subscription != null && subscription.status === "active";
  const today = todayDateString();

  if (isLoading || !cls) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const handleCheckin = () => {
    if (!hasSubscription) {
      Alert.alert("Plano necessário", "Assine um plano para fazer check-in nas aulas.");
      return;
    }
    checkinMutation.mutate({ classId, date: today });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ClassDetailView
        classData={{
          id: cls.id,
          name: cls.name,
          description: cls.description,
          instructorName: cls.instructorName,
          dayOfWeekLabel: DAY_NAMES[cls.dayOfWeek] ?? "",
          startTime: formatTime(cls.startTime),
          endTime: formatTime(cls.endTime),
          capacity: cls.capacity,
          checkinCount: 0,
        }}
        canCheckin
        checkinDone={checkinMutation.isSuccess}
        checkinDisabled={!hasSubscription}
        checkinDisabledReason="Assine um plano para fazer check-in nas aulas."
        showCheckins={false}
        onCheckin={handleCheckin}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/(student)/(classes)/
git commit -m "feat(mobile): implement student schedule and class detail screens (M-STU-06/07)"
```

---

## Task 18: Smoke test all screens

- [ ] **Step 1: Verify TypeScript compiles**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 2: Verify API compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Fix any type issues found**

Address any TypeScript errors from the above runs. Common issues:
- Missing type exports from `@tatame/validators` — check `packages/validators/src/index.ts` exports
- `Belt` type import from `@tatame/types` — verify it's exported
- `MemberListItem` shape — verify it has `userId` and `userName` fields

- [ ] **Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix(mobile): resolve TypeScript errors in schedule screens"
```
