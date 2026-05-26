# Check-in Dependents UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a compact list of "my check-ins" (self + dependents) on the class detail screen and keep the check-in button active until all have checked in.

**Architecture:** The API endpoint `GET /classes/:classId/checkins` is extended to return `dependentId` and `dependentName`. The frontend calculates `myCheckins` and `allCheckedIn` by crossing the checkin list with the user's dependents. `ClassDetailView` renders a new "meus check-ins" section and uses `allCheckedIn` for button state. `TodayClassCard` also uses the same `allCheckedIn` logic.

**Tech Stack:** React Native, Expo Router, TanStack Query, Drizzle ORM, Express

---

### Task 1: Add dependentId and dependentName to class checkins API response

**Files:**
- Modify: `apps/api/src/modules/class/class.routes.ts:218-248`

- [ ] **Step 1: Update the SQL select to include dependentId and dependentName**

In `apps/api/src/modules/class/class.routes.ts`, update the checkins endpoint query. Add a left join to the `dependents` table and include `dependentId` and `dependentName` in the select:

```typescript
import { dependents } from "@tatame/db";
// ... existing imports

// Inside the GET /:classId/checkins handler, replace the query:
const rows = await db
  .select({
    id: checkins.id,
    classId: checkins.classId,
    userId: checkins.userId,
    checkedInAt: checkins.checkedInAt,
    date: checkins.date,
    dependentId: checkins.dependentId,
    dependentName: dependents.name,
    userName: users.name,
    userProfileImageUrl: users.profileImageUrl,
  })
  .from(checkins)
  .innerJoin(users, eq(checkins.userId, users.id))
  .leftJoin(dependents, eq(checkins.dependentId, dependents.id))
  .where(
    and(
      eq(checkins.classId, params.data.classId),
      eq(checkins.date, date),
    ),
  )
  .orderBy(checkins.checkedInAt);

res.json({
  items: rows.map((r) => ({
    id: r.id,
    classId: r.classId,
    userId: r.userId,
    checkedInAt: r.checkedInAt.toISOString(),
    date: typeof r.date === "string" ? r.date.slice(0, 10) : r.date,
    dependentId: r.dependentId ?? null,
    dependentName: r.dependentName ?? null,
    userName: r.userName,
    userProfileImageUrl: r.userProfileImageUrl,
  })),
});
```

- [ ] **Step 2: Verify the API still works**

Run: `pnpm --filter @tatame/api typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/class/class.routes.ts
git commit -m "feat(api): add dependentId and dependentName to class checkins response"
```

---

### Task 2: Update CheckinItem type in the frontend

**Files:**
- Modify: `apps/mobile/lib/hooks/use-checkin.ts:10-18`

- [ ] **Step 1: Add dependentId and dependentName to CheckinItem type**

In `apps/mobile/lib/hooks/use-checkin.ts`, update the `CheckinItem` type:

```typescript
type CheckinItem = {
  id: string;
  classId: string;
  userId: string;
  checkedInAt: string;
  date: string;
  dependentId: string | null;
  dependentName: string | null;
  userName?: string;
  userProfileImageUrl?: string | null;
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/lib/hooks/use-checkin.ts
git commit -m "feat(mobile): add dependentId/dependentName to CheckinItem type"
```

---

### Task 3: Add myCheckins prop and render list in ClassDetailView

**Files:**
- Modify: `apps/mobile/components/ClassDetailView.tsx`

- [ ] **Step 1: Add new props to ClassDetailViewProps**

Add `myCheckins` and update how `checkinDone` is used. Add after line 54 (`showCheckins`):

```typescript
type MyCheckinEntry = {
  name: string;
  checkedInAt: string;
};

type ClassDetailViewProps = {
  classData: ClassData;
  checkins?: (CheckinItem & {
    userName: string;
    userProfileImageUrl?: string | null;
  })[];
  myCheckins?: MyCheckinEntry[];
  canEdit?: boolean;
  canDelete?: boolean;
  canCheckin?: boolean;
  checkinDone?: boolean;
  checkinDisabled?: boolean;
  checkinPending?: boolean;
  checkinDisabledReason?: string;
  showCheckins?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onCheckin?: () => void;
};
```

- [ ] **Step 2: Render the "meus check-ins" list**

Inside the component, add the `myCheckins` prop to destructuring. Then add the list rendering between the class info card and the `showCheckins` section (after line 216, after the `</View>` closing the info card):

```tsx
export function ClassDetailView({
  classData,
  checkins,
  myCheckins,
  canEdit,
  // ... rest
}: ClassDetailViewProps) {
```

Add the list inside the ScrollView, after the class info card `</View>` (after CapacityBar) and before the `{showCheckins ? (` block:

```tsx
        {myCheckins && myCheckins.length > 0 ? (
          <>
            <Text className="font-poppins-semibold text-sm text-muted">
              Meus check-ins
            </Text>
            <View style={{ gap: 10 }}>
              {myCheckins.map((entry, i) => (
                <CheckinListItem
                  key={`my-${i}`}
                  userName={entry.name}
                  checkedInAt={entry.checkedInAt}
                />
              ))}
            </View>
          </>
        ) : null}
```

Note: `CheckinListItem` already supports rendering without `userProfileImageUrl` (it's optional and falls back to initials via `Avatar`).

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @tatame/api typecheck`
Expected: no errors (mobile typecheck is skipped due to NativeWind)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/ClassDetailView.tsx
git commit -m "feat(mobile): add myCheckins list to ClassDetailView"
```

---

### Task 4: Update student class detail screen with allCheckedIn logic

**Files:**
- Modify: `apps/mobile/app/(app)/(student)/(classes)/[classId].tsx`

- [ ] **Step 1: Compute myCheckins and allCheckedIn**

After the existing `checkinDone` calculation (line 92-93), replace it with the new logic:

```typescript
  const myCheckins = useMemo(() => {
    if (!checkins || !me?.id) return [];
    const dependentIds = new Set(dependents.map((d) => d.id));
    return checkins
      .filter(
        (c) =>
          (c.userId === me.id && !c.dependentId) ||
          (c.dependentId != null && dependentIds.has(c.dependentId)),
      )
      .map((c) => ({
        name: c.dependentId ? (c.dependentName ?? "Dependente") : "Eu",
        checkedInAt: c.checkedInAt,
      }));
  }, [checkins, me?.id, dependents]);

  const allCheckedIn = useMemo(() => {
    if (!checkins || !me?.id) return false;
    const checkedDependentIds = new Set(
      checkins.filter((c) => c.dependentId).map((c) => c.dependentId),
    );
    const selfCheckedIn = checkins.some(
      (c) => c.userId === me.id && !c.dependentId,
    );
    if (isGuardian) {
      // Guardian: all dependents must be checked in
      return (
        dependents.length > 0 &&
        dependents.every((d) => checkedDependentIds.has(d.id))
      );
    }
    // Student with dependents: self + all dependents
    if (dependents.length > 0) {
      return (
        selfCheckedIn &&
        dependents.every((d) => checkedDependentIds.has(d.id))
      );
    }
    // Student without dependents: just self
    return selfCheckedIn;
  }, [checkins, me?.id, dependents, isGuardian]);
```

Add the `useMemo` import if not already present.

- [ ] **Step 2: Pass myCheckins and allCheckedIn to ClassDetailView**

Update the `ClassDetailView` usage:

```tsx
      <ClassDetailView
        classData={{
          id: cls.id,
          name: cls.name,
          description: cls.description,
          instructorName: cls.instructorName ?? undefined,
          dayOfWeekLabel: DAY_NAMES[cls.dayOfWeek] ?? "",
          startTime: formatTime(cls.startTime),
          endTime: formatTime(cls.endTime),
          capacity: cls.capacity,
          checkinCount,
        }}
        myCheckins={myCheckins}
        canCheckin
        checkinDone={allCheckedIn}
        checkinDisabled={checkinDisabled}
        checkinPending={checkinMutation.isPending}
        checkinDisabledReason={checkinDisabledReason}
        showCheckins={false}
        onCheckin={handleCheckin}
      />
```

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(app)/(student)/(classes)/[classId].tsx"
git commit -m "feat(mobile): student class detail uses allCheckedIn logic with myCheckins list"
```

---

### Task 5: Update guardian class detail screen with allCheckedIn logic

**Files:**
- Modify: `apps/mobile/app/(app)/(guardian)/(classes)/[classId].tsx`

- [ ] **Step 1: Compute myCheckins and allCheckedIn**

Add `useMemo` import. After line 78 (`const checkinCount = checkins?.length ?? 0;`), add:

```typescript
  const myCheckins = useMemo(() => {
    if (!checkins) return [];
    const dependentIds = new Set(dependents.map((d) => d.id));
    return checkins
      .filter((c) => c.dependentId != null && dependentIds.has(c.dependentId))
      .map((c) => ({
        name: c.dependentName ?? "Dependente",
        checkedInAt: c.checkedInAt,
      }));
  }, [checkins, dependents]);

  const allCheckedIn = useMemo(() => {
    if (!checkins || dependents.length === 0) return false;
    const checkedDependentIds = new Set(
      checkins.filter((c) => c.dependentId).map((c) => c.dependentId),
    );
    return dependents.every((d) => checkedDependentIds.has(d.id));
  }, [checkins, dependents]);
```

- [ ] **Step 2: Pass myCheckins and allCheckedIn to ClassDetailView**

Update the `ClassDetailView` usage — change `checkinDone={false}` to `checkinDone={allCheckedIn}` and add `myCheckins`:

```tsx
      <ClassDetailView
        classData={{
          id: cls.id,
          name: cls.name,
          description: cls.description,
          instructorName: cls.instructorName ?? undefined,
          dayOfWeekLabel: DAY_NAMES[cls.dayOfWeek] ?? "",
          startTime: formatTime(cls.startTime),
          endTime: formatTime(cls.endTime),
          capacity: cls.capacity,
          checkinCount,
        }}
        myCheckins={myCheckins}
        canCheckin
        checkinDone={allCheckedIn}
        checkinDisabled={!withinCheckinWindow}
        checkinPending={checkinMutation.isPending}
        checkinDisabledReason={checkinDisabledReason}
        showCheckins={false}
        onCheckin={handleCheckin}
      />
```

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(app)/(guardian)/(classes)/[classId].tsx"
git commit -m "feat(mobile): guardian class detail uses allCheckedIn logic with myCheckins list"
```

---

### Task 6: Update TodayClassCard with allCheckedIn logic

**Files:**
- Modify: `apps/mobile/components/TodayClassCard.tsx`
- Modify: `apps/mobile/app/(app)/(student)/(home)/index.tsx`

- [ ] **Step 1: Add dependentIds prop to TodayClassCard**

Update `TodayClassCardProps` and the `useMemo` to compute `allCheckedIn`:

```typescript
type TodayClassCardProps = {
  classId: string;
  name: string;
  startTime: string;
  endTime: string;
  instructorName?: string | null;
  capacity?: number | null;
  userId: string | undefined;
  dependentIds: string[];
  isGuardian: boolean;
  hasSubscription: boolean;
  checkinPending: boolean;
  sessionDate: string;
  now: Date;
  onCheckin: () => void;
  onPress: () => void;
};
```

Update the component to use the new props:

```typescript
export function TodayClassCard({
  classId,
  name,
  startTime,
  endTime,
  instructorName,
  capacity,
  userId,
  dependentIds,
  isGuardian,
  hasSubscription,
  checkinPending,
  sessionDate,
  now,
  onCheckin,
  onPress,
}: TodayClassCardProps) {
  const { data: checkins } = useClassCheckins(classId, sessionDate, {
    enabled: Boolean(classId) && Boolean(sessionDate),
  });

  const { allCheckedIn, checkinCount, withinWindow } = useMemo(() => {
    const list = checkins ?? [];
    const count = list.length;
    const within = isWithinCheckinWindow(now, sessionDate, startTime, endTime);

    if (!userId) return { allCheckedIn: false, checkinCount: count, withinWindow: within };

    const checkedDependentIds = new Set(
      list.filter((c) => c.dependentId).map((c) => c.dependentId),
    );
    const selfCheckedIn = list.some((c) => c.userId === userId && !c.dependentId);

    let allDone: boolean;
    if (isGuardian) {
      allDone = dependentIds.length > 0 && dependentIds.every((id) => checkedDependentIds.has(id));
    } else if (dependentIds.length > 0) {
      allDone = selfCheckedIn && dependentIds.every((id) => checkedDependentIds.has(id));
    } else {
      allDone = selfCheckedIn;
    }

    return { allCheckedIn: allDone, checkinCount: count, withinWindow: within };
  }, [checkins, userId, dependentIds, isGuardian, now, sessionDate, startTime, endTime]);

  const checkinDisabled =
    !hasSubscription || checkinPending || allCheckedIn || !withinWindow;

  return (
    <ClassCard
      name={name}
      startTime={startTime}
      endTime={endTime}
      instructorName={instructorName ?? undefined}
      capacity={capacity}
      checkinCount={capacity != null ? checkinCount : undefined}
      showCheckinButton
      onCheckin={onCheckin}
      checkinDisabled={checkinDisabled}
      checkinLabel={allCheckedIn ? "Check-in realizado" : "Check-in"}
      onPress={onPress}
    />
  );
}
```

- [ ] **Step 2: Update StudentHome to pass dependentIds and isGuardian**

In `apps/mobile/app/(app)/(student)/(home)/index.tsx`, the `useDependents` hook is already imported. Pass the new props to `TodayClassCard`:

```tsx
<TodayClassCard
  key={cls.id}
  classId={cls.id}
  name={cls.name}
  startTime={formatTime(cls.startTime)}
  endTime={formatTime(cls.endTime)}
  instructorName={cls.instructorName ?? undefined}
  capacity={cls.capacity}
  userId={me?.id}
  dependentIds={dependents.map((d) => d.id)}
  isGuardian={false}
  hasSubscription={hasSubscription}
  checkinPending={checkin.isPending}
  sessionDate={today}
  now={now}
  onCheckin={() => handleCheckin(cls.id)}
  onPress={() => router.push(`/(app)/(student)/(classes)/${cls.id}`)}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/TodayClassCard.tsx "apps/mobile/app/(app)/(student)/(home)/index.tsx"
git commit -m "feat(mobile): TodayClassCard uses allCheckedIn logic for dependent-aware button state"
```

---

### Task 7: Verify and test end-to-end

- [ ] **Step 1: Run typecheck**

Run: `cd apps/api && pnpm typecheck`
Expected: no errors

- [ ] **Step 2: Run unit tests**

Run: `cd apps/api && pnpm test:unit`
Expected: all 251 tests pass

- [ ] **Step 3: Manual testing checklist**

1. Student without dependents: check in → button disables, "Check-in realizado" shown, "Meus check-ins" list shows "Eu" entry
2. Student with dependents: check in self → list shows "Eu", button stays active → check in dependent → list shows both, button disables when all done
3. Guardian: check in dependent A → list shows name, button active → check in dependent B → list shows both, button disables
4. TodayClassCard on home: button state matches (disabled only when all checked in)

- [ ] **Step 4: Final commit (if any adjustments needed)**

```bash
git add -A
git commit -m "fix(mobile): adjustments from manual testing"
```
