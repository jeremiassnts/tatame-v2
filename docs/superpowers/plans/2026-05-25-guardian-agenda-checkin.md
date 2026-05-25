# Guardian Agenda & Dependent Check-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a weekly class schedule (Agenda) tab to the guardian role and enable check-in for dependents from the class detail screen.

**Architecture:** Reuse existing `useClasses`, `useCheckin`, `ClassCard`, `ClassDetailView`, `DependentSelectionModal`, and `WeekDayStrip` components. Create guardian-specific route screens that mirror the student `(classes)` group but always show the dependent selection modal on check-in. The API already supports `POST /checkins` with `dependentId` for `Role.Guardian`.

**Tech Stack:** React Native, Expo Router (file-based tabs), TanStack Query, existing API (no backend changes needed).

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `apps/mobile/app/(app)/(guardian)/(classes)/_layout.tsx` | Stack navigator for classes group |
| Create | `apps/mobile/app/(app)/(guardian)/(classes)/index.tsx` | Weekly agenda screen (day strip + class list) |
| Create | `apps/mobile/app/(app)/(guardian)/(classes)/[classId].tsx` | Class detail + dependent check-in |
| Modify | `apps/mobile/app/(app)/(guardian)/_layout.tsx` | Add `(classes)` tab with Calendar icon |
| Modify | `apps/mobile/app/(app)/(guardian)/(home)/index.tsx` | Restore "Ver todas" link pointing to guardian classes |

---

### Task 1: Create guardian classes layout

**Files:**
- Create: `apps/mobile/app/(app)/(guardian)/(classes)/_layout.tsx`

- [ ] **Step 1: Create the layout file**

```tsx
import { Stack } from "expo-router";

export default function GuardianClassesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[classId]" />
    </Stack>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `pnpm --filter @tatame/mobile exec tsc --noEmit` (or rely on metro bundler — should not crash)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/\(guardian\)/\(classes\)/_layout.tsx
git commit -m "feat(guardian): add classes route group layout"
```

---

### Task 2: Create guardian weekly agenda screen

**Files:**
- Create: `apps/mobile/app/(app)/(guardian)/(classes)/index.tsx`

This is a copy of the student agenda adapted for the guardian context. The only difference is the navigation route for class detail points to `/(app)/(guardian)/(classes)/[classId]`.

- [ ] **Step 1: Create the agenda screen**

```tsx
import { BackButton } from "@/components/BackButton";
import { ClassCard } from "@/components/ClassCard";
import { WeekDayStrip } from "@/components/WeekDayStrip";
import { localDateStringForAgendaWeekday } from "@/lib/class-session-date";
import { useClasses } from "@/lib/hooks/use-classes";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_MUTED = "#525252";

const DAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
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

export default function GuardianClassSchedule() {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const { data: classes, isLoading } = useClasses(selectedDay);

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-row items-center justify-between px-6 pb-2 pt-2">
        <BackButton />
        <Text className="font-poppins-bold text-lg text-primary">Agenda semanal</Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <WeekDayStrip selectedDay={selectedDay} onDaySelect={setSelectedDay} />

        <Text className="font-poppins-semibold text-sm text-muted">
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
                instructorName={cls.instructorName ?? undefined}
                capacity={cls.capacity}
                onPress={() =>
                  router.push(
                    `/(app)/(guardian)/(classes)/${cls.id}?sessionDate=${localDateStringForAgendaWeekday(selectedDay)}`,
                  )
                }
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/\(guardian\)/\(classes\)/index.tsx
git commit -m "feat(guardian): add weekly agenda screen"
```

---

### Task 3: Create guardian class detail screen with dependent check-in

**Files:**
- Create: `apps/mobile/app/(app)/(guardian)/(classes)/[classId].tsx`

This screen is similar to `apps/mobile/app/(app)/(student)/(classes)/[classId].tsx` but:
- Always opens `DependentSelectionModal` (no self check-in option)
- Does not check `hasSubscription` for the guardian themselves (subscription is per-dependent, validated server-side)
- Uses `useDependents()` to list dependents in the modal

- [ ] **Step 1: Create the class detail screen**

```tsx
import { ClassDetailView } from "@/components/ClassDetailView";
import { DependentSelectionModal } from "@/components/DependentSelectionModal";
import { useCheckin, useClassCheckins } from "@/lib/hooks/use-checkin";
import { useClass } from "@/lib/hooks/use-classes";
import { useDependents } from "@/lib/hooks/use-dependents";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { isWithinCheckinWindow } from "@/lib/checkin-window";
import {
  parseSessionDateParam,
  resolveClassSessionDate,
} from "@/lib/class-session-date";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

function paramToId(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].length > 0)
    return value[0];
  return undefined;
}

export default function GuardianClassDetail() {
  const { classId: rawClassId, sessionDate: rawSessionDate } =
    useLocalSearchParams<{ classId: string; sessionDate?: string }>();
  const classId = paramToId(rawClassId);
  const sessionDateFromParam = parseSessionDateParam(rawSessionDate);
  const { data: me } = useCurrentUser();
  const { data: cls, isLoading, isError } = useClass(classId ?? "");

  const { data: dependentsResponse } = useDependents();
  const dependents = dependentsResponse?.items ?? [];

  const [dependentModalVisible, setDependentModalVisible] = useState(false);

  const sessionDate =
    cls != null
      ? resolveClassSessionDate(sessionDateFromParam, cls.dayOfWeek)
      : sessionDateFromParam ?? "";

  const { data: checkins } = useClassCheckins(classId ?? "", sessionDate, {
    enabled:
      Boolean(classId) &&
      Boolean(sessionDate) &&
      (sessionDateFromParam != null || cls != null),
  });
  const checkinMutation = useCheckin();

  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
    }, []),
  );
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const withinCheckinWindow =
    cls != null && Boolean(sessionDate)
      ? isWithinCheckinWindow(now, sessionDate, cls.startTime, cls.endTime)
      : false;

  const checkinCount = checkins?.length ?? 0;

  if (!classId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="font-poppins text-sm text-muted">Aula não encontrada</Text>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  if (isError || !cls) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="font-poppins text-sm text-muted">
          Não foi possível carregar esta aula
        </Text>
      </SafeAreaView>
    );
  }

  const performCheckin = (dependentId?: string) => {
    if (!dependentId) return; // Guardian must always select a dependent
    checkinMutation.mutate(
      { classId, date: sessionDate, dependentId },
      {
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Erro ao fazer check-in";
          Alert.alert("Check-in não realizado", msg);
        },
      },
    );
  };

  const handleCheckin = () => {
    if (
      !cls ||
      !isWithinCheckinWindow(new Date(), sessionDate, cls.startTime, cls.endTime)
    ) {
      return;
    }
    setDependentModalVisible(true);
  };

  const checkinDisabledReason = !withinCheckinWindow
    ? "O check-in abre 12 horas antes do início da aula e encerra ao fim da aula."
    : undefined;

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
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
        canCheckin
        checkinDone={false}
        checkinDisabled={!withinCheckinWindow}
        checkinPending={checkinMutation.isPending}
        checkinDisabledReason={checkinDisabledReason}
        showCheckins={false}
        onCheckin={handleCheckin}
      />

      <DependentSelectionModal
        visible={dependentModalVisible}
        onClose={() => setDependentModalVisible(false)}
        onSelect={performCheckin}
        dependents={dependents}
        showSelfOption={false}
        userName={me?.name}
        userBelt={null}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/\(guardian\)/\(classes\)/\[classId\].tsx
git commit -m "feat(guardian): add class detail screen with dependent check-in"
```

---

### Task 4: Add Agenda tab to guardian bottom navigation

**Files:**
- Modify: `apps/mobile/app/(app)/(guardian)/_layout.tsx`

Current tabs: `(home)`, `(dependents)`, `(more)`. Add `(classes)` between `(dependents)` and `(more)`.

- [ ] **Step 1: Update the guardian layout**

Add import for `Calendar` icon and add the `(classes)` tab screen:

```tsx
import { Tabs } from "expo-router";
import { Calendar, Home, Menu, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function GuardianLayout() {
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
        name="(dependents)"
        options={{
          title: "Dependentes",
          href: "/(app)/(guardian)/(dependents)",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(classes)"
        options={{
          title: "Agenda",
          href: "/(app)/(guardian)/(classes)",
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(more)"
        options={{
          title: "Mais",
          href: "/(app)/(guardian)/(more)",
          tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="(announcements)" options={{ href: null }} />
      <Tabs.Screen name="(onboarding)" options={{ href: null }} />
      <Tabs.Screen name="(subscription)" options={{ href: null }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/\(guardian\)/_layout.tsx
git commit -m "feat(guardian): add Agenda tab to bottom navigation"
```

---

### Task 5: Restore "Ver todas" link on guardian home

**Files:**
- Modify: `apps/mobile/app/(app)/(guardian)/(home)/index.tsx`

Currently the "Aulas de hoje" section has no "Ver todas" link. Restore it pointing to the new guardian classes route.

- [ ] **Step 1: Update the classes section header**

Find:
```tsx
          {/* Today's classes section */}
          <View className="flex-row items-center justify-between">
            <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
              Aulas de hoje
            </Text>
          </View>
```

Replace with:
```tsx
          {/* Today's classes section */}
          <View className="flex-row items-center justify-between">
            <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
              Aulas de hoje
            </Text>
            <Pressable onPress={() => router.push("/(app)/(guardian)/(classes)")}>
              <Text className="font-poppins-medium text-xs" style={{ color: ACCENT }}>
                Ver todas
              </Text>
            </Pressable>
          </View>
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/\(guardian\)/\(home\)/index.tsx
git commit -m "feat(guardian): restore 'Ver todas' link to agenda on home screen"
```

---

### Task 6: Verify full flow end-to-end

- [ ] **Step 1: Run typecheck**

```bash
pnpm turbo typecheck
```

Expected: all packages pass.

- [ ] **Step 2: Run unit tests**

```bash
pnpm turbo test:unit
```

Expected: 251 tests pass (no API changes needed).

- [ ] **Step 3: Manual QA checklist**

1. Open app as guardian
2. Verify bottom tab shows: Início, Dependentes, Agenda, Mais
3. Tap "Agenda" tab → weekly schedule appears with day strip
4. Select a day → classes for that day show
5. Tap a class card → class detail opens
6. Tap "Check-in" button → dependent selection modal opens (no "Eu" option)
7. Select a dependent → check-in is performed
8. Verify check-in appears in dependent's history
9. On home screen, "Ver todas" link navigates to agenda
10. Switch to student role → verify student classes/check-in still works as before (including dependent modal if student has dependents)

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git commit -m "fix(guardian): address QA issues from agenda/checkin flow"
```
