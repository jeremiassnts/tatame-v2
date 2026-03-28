# Academy Info Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only academy info screens for student and instructor roles with a "leave academy" flow.

**Architecture:** A shared `AcademyInfo` component renders the full screen content (logo, read-only fields, member card, leave button). Thin screen files in each role group pass `onLeave`, `isLeaving`, and `memberSince` props. Backend adds `joinedAt` to the existing `activeMembership` payload.

**Tech Stack:** React Native (Expo Router), NativeWind, TanStack Query, Zod validators, Drizzle ORM

**Design reference:** The UI must match the designs in `design.pen`. Use the Pencil MCP tools (`batch_get` with `readDepth: 4` and `resolveVariables: true`, `get_screenshot`) to read the design nodes and verify visual fidelity. Primary design: **Node ID `WXT1J`** (M-INS-10: Academy Info — instructor base layout). Secondary reference: **Node ID `HKRmV`** (M-STU-13: Academy Info Student View — source for the "Membro ativo" card at section 4 `mEOPs`).

---

### Task 1: Add `joinedAt` to `ActiveOrPendingMembershipRow` type ✅ **DONE** (Linear: TAT-30)

**Files:**
- Modify: `apps/api/src/modules/membership/membership.repository.ts:49-56`

- [x] **Step 1: Add `joinedAt` to the type**

```ts
export type ActiveOrPendingMembershipRow = {
  id: string;
  academyId: string;
  academyName: string;
  academyLogoUrl: string | null;
  role: string;
  status: string;
  joinedAt: Date | null;
};
```

- [x] **Step 2: Verify types compile**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -30`

Expected: Type errors in the two repository implementations (postgres and in-memory) because they don't return `joinedAt` yet. This confirms the type is wired correctly.

---

### Task 2: Add `joinedAt` to Postgres repository query ✅ **DONE** (Linear: TAT-31)

**Files:**
- Modify: `apps/api/src/modules/membership/membership.repository.postgres.ts:317-325`

- [x] **Step 1: Add `joinedAt` to the select**

In `findActiveOrPendingByUser`, update the `.select()` call:

```ts
    const [row] = await this.db
      .select({
        id: academyMemberships.id,
        academyId: academyMemberships.academyId,
        academyName: academies.name,
        academyLogoUrl: academies.logoUrl,
        role: academyMemberships.role,
        status: academyMemberships.status,
        joinedAt: academyMemberships.joinedAt,
      })
```

---

### Task 3: Add `joinedAt` to in-memory repository ✅ **DONE** (Linear: TAT-32)

**Files:**
- Modify: `apps/api/src/modules/membership/membership.repository.in-memory.ts:196-213`

- [x] **Step 1: Return `joinedAt` from in-memory implementation**

Update `findActiveOrPendingByUser`:

```ts
  async findActiveOrPendingByUser(
    userId: string,
  ): Promise<ActiveOrPendingMembershipRow | null> {
    const row = this.rows.find(
      (r) =>
        r.userId === userId &&
        (r.status === "pending" || r.status === "active"),
    );
    if (!row) return null;
    return {
      id: row.id,
      academyId: row.academyId,
      academyName: "",
      academyLogoUrl: null,
      role: row.role,
      status: row.status,
      joinedAt: row.joinedAt,
    };
  }
```

- [x] **Step 2: Verify types compile cleanly**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -10`

Expected: No type errors in `apps/api`.

- [x] **Step 3: Run existing membership tests**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx vitest run apps/api/src/modules/membership/membership.service.test.ts`

Expected: All existing tests pass.

- [x] **Step 4: Commit backend changes**

```bash
git add apps/api/src/modules/membership/membership.repository.ts apps/api/src/modules/membership/membership.repository.postgres.ts apps/api/src/modules/membership/membership.repository.in-memory.ts
git commit -m "feat(api): add joinedAt to activeMembership query"
```

---

### Task 4: Add `joinedAt` to `activeMembershipSchema` validator ✅ **DONE** (Linear: TAT-33)

**Files:**
- Modify: `packages/validators/src/user.schema.ts:33-40`

- [x] **Step 1: Add `joinedAt` to the schema**

```ts
export const activeMembershipSchema = z.object({
  id: z.string().uuid(),
  academyId: z.string().uuid(),
  academyName: z.string(),
  academyLogoUrl: z.string().nullable(),
  role: roleEnumSchema,
  status: z.enum(["pending", "active", "blocked"]),
  joinedAt: z.coerce.date().nullable(),
});
```

- [x] **Step 2: Verify validators compile**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx tsc --noEmit -p packages/validators/tsconfig.json 2>&1 | head -10`

Expected: No errors.

- [x] **Step 3: Commit**

```bash
git add packages/validators/src/user.schema.ts
git commit -m "feat(validators): add joinedAt to activeMembershipSchema"
```

---

### Task 5: Build the `AcademyInfo` shared component ✅ **DONE** (Linear: TAT-34)

**Files:**
- Create: `apps/mobile/components/AcademyInfo.tsx`

**Design reference:** Use Pencil MCP `batch_get` to read **Node ID `WXT1J`** (instructor design, `readDepth: 4`, `resolveVariables: true`) for the overall layout — nav row, logo section, form fields, warning card, leave button. Then read **Node ID `HKRmV`** child `mEOPs` (the "Member Card" in the student design) for the member-since card. Use `get_screenshot` on both nodes to verify visual match.

- [x] **Step 1: Read the design nodes via Pencil MCP**

Use `batch_get` on `design.pen` with `nodeIds: ["WXT1J", "HKRmV"]`, `readDepth: 4`, `resolveVariables: true` to get the full structure. Take `get_screenshot` of both nodes for visual reference.

- [x] **Step 2: Create the component**

```tsx
import { BackButton } from "@/components/BackButton";
import { Avatar } from "@/components/Avatar";
import { useAcademyContext } from "@/lib/academy-context";
import { useAcademy } from "@/lib/hooks/use-academy";
import { Calendar, Mail, MapPin, Phone, ShieldCheck } from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AcademyInfoProps = {
  onLeave: () => void;
  isLeaving: boolean;
  memberSince: Date | null;
};

const TEXT_MUTED = "#ABABAB";
const TEXT_DIMMED = "#525252";

function ReadOnlyField({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string | null;
  Icon?: React.ComponentType<{ size: number; color: string }>;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text className="font-poppins-medium text-[13px] text-muted">{label}</Text>
      <View className="h-[52px] flex-row items-center rounded-xl border border-surface-border bg-surface px-4 gap-2.5">
        {Icon ? <Icon size={18} color={TEXT_DIMMED} /> : null}
        <Text className="flex-1 font-poppins text-[14px] text-primary">
          {value || "Não informado"}
        </Text>
      </View>
    </View>
  );
}

function formatMemberDate(date: Date | null): string {
  if (!date) return "Data não informada";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFoundedDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

export function AcademyInfo({ onLeave, isLeaving, memberSince }: AcademyInfoProps) {
  const { academyId } = useAcademyContext();
  const { data: academy, isLoading } = useAcademy(academyId);

  const handleLeavePress = () => {
    Alert.alert(
      "Sair da academia",
      "Ao sair, você perderá acesso às aulas e recursos desta academia. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: onLeave },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 px-6 pt-2" style={{ gap: 8 }}>
        {/* Nav Row */}
        <View className="flex-row items-center justify-between">
          <BackButton />
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 18, letterSpacing: -0.3 }}
          >
            Academia
          </Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24, gap: 24 }}
        >
          {/* Logo Section */}
          <View className="items-center" style={{ gap: 12 }}>
            <Avatar
              variant="brand"
              imageUrl={academy?.logoUrl}
              size={88}
            />
            <Text className="font-poppins text-[13px] text-muted">
              Somente visualização
            </Text>
          </View>

          {/* Form Fields */}
          <View style={{ gap: 16 }}>
            <ReadOnlyField label="Nome" value={academy?.name ?? null} />
            <ReadOnlyField label="Endereço" value={academy?.address ?? null} Icon={MapPin} />
            <ReadOnlyField label="E-mail" value={academy?.contactEmail ?? null} Icon={Mail} />
            <ReadOnlyField label="Telefone" value={academy?.contactPhone ?? null} Icon={Phone} />
            <ReadOnlyField
              label="Fundada em"
              value={formatFoundedDate(academy?.foundedAt ?? null)}
              Icon={Calendar}
            />
          </View>

          {/* Member Card */}
          <View
            className="flex-row items-center rounded-2xl border border-surface-border bg-surface"
            style={{ gap: 12, padding: 14, paddingHorizontal: 16 }}
          >
            <View
              className="h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: "rgba(160,120,232,0.125)" }}
            >
              <ShieldCheck size={20} color="#A078E8" />
            </View>
            <View style={{ gap: 4 }}>
              <Text className="font-poppins-semibold text-[14px] text-primary">
                Membro ativo
              </Text>
              <Text className="font-poppins text-[13px] text-muted">
                Desde {formatMemberDate(memberSince)}
              </Text>
            </View>
          </View>

          {/* Leave Warning */}
          <View
            className="rounded-[10px]"
            style={{ backgroundColor: "#242424", gap: 4, padding: 10, paddingHorizontal: 12 }}
          >
            <Text className="font-poppins-semibold text-[12px] text-primary">
              Atenção
            </Text>
            <Text className="font-poppins text-[12px] text-muted">
              Ao sair, você perderá acesso às aulas e recursos desta academia.
            </Text>
          </View>

          {/* Leave Button */}
          <Pressable
            onPress={handleLeavePress}
            disabled={isLeaving}
            className="h-14 items-center justify-center rounded-xl"
            style={{ backgroundColor: "#D64B4B" }}
          >
            {isLeaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-poppins-semibold text-base text-white">
                Sair da academia
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
```

- [x] **Step 3: Take a screenshot of design Node `WXT1J` and `HKRmV` to visually compare**

Use Pencil MCP `get_screenshot` on `design.pen` for nodes `WXT1J` and `HKRmV`. Verify the component layout matches: nav row positioning, logo size/radius, field spacing, member card layout, warning card colors, button size/color.

- [x] **Step 4: Commit**

```bash
git add apps/mobile/components/AcademyInfo.tsx
git commit -m "feat(mobile): add shared AcademyInfo component"
```

---

### Task 6: Wire up instructor academy screen

**Files:**
- Modify: `apps/mobile/app/(app)/(instructor)/(academy)/index.tsx`

- [ ] **Step 1: Replace the placeholder with AcademyInfo**

```tsx
import { AcademyInfo } from "@/components/AcademyInfo";
import { useCancelMembership } from "@/lib/hooks/use-membership";
import { useCurrentUser } from "@/lib/hooks/use-user";

export default function InstructorAcademyScreen() {
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

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(instructor)/(academy)/index.tsx
git commit -m "feat(mobile): implement instructor academy info screen"
```

---

### Task 7: Enable instructor "Academia" tab

**Files:**
- Modify: `apps/mobile/app/(app)/(instructor)/_layout.tsx:50-57`

- [ ] **Step 1: Remove `href: null` from the academy tab**

Change the `(academy)` Tabs.Screen from:

```tsx
      <Tabs.Screen
        name="(academy)"
        options={{
          title: "Academia",
          tabBarIcon: ({ color, size }) => <School size={size} color={color} />,
          href: null,
        }}
      />
```

To:

```tsx
      <Tabs.Screen
        name="(academy)"
        options={{
          title: "Academia",
          tabBarIcon: ({ color, size }) => <School size={size} color={color} />,
        }}
      />
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(instructor)/_layout.tsx
git commit -m "feat(mobile): enable instructor Academia tab"
```

---

### Task 8: Create student academy route files

**Files:**
- Create: `apps/mobile/app/(app)/(student)/(academy)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(student)/(academy)/index.tsx`

- [ ] **Step 1: Create the Stack layout**

```tsx
// apps/mobile/app/(app)/(student)/(academy)/_layout.tsx
import { Stack } from "expo-router";

export default function StudentAcademyLayout() {
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

- [ ] **Step 2: Create the screen**

```tsx
// apps/mobile/app/(app)/(student)/(academy)/index.tsx
import { AcademyInfo } from "@/components/AcademyInfo";
import { useCancelMembership } from "@/lib/hooks/use-membership";
import { useCurrentUser } from "@/lib/hooks/use-user";

export default function StudentAcademyScreen() {
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

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/(student)/(academy)/_layout.tsx apps/mobile/app/(app)/(student)/(academy)/index.tsx
git commit -m "feat(mobile): add student academy info screen"
```

---

### Task 9: Add student "Academia" tab

**Files:**
- Modify: `apps/mobile/app/(app)/(student)/_layout.tsx`

- [ ] **Step 1: Add School import and new Tabs.Screen**

Update imports to include `School`:

```tsx
import { Calendar, Home, School, Users } from "lucide-react-native";
```

Add the new tab after the `(classes)` screen and before `register-belt`:

```tsx
      <Tabs.Screen
        name="(academy)"
        options={{
          title: "Academia",
          tabBarIcon: ({ color, size }) => <School size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="register-belt" options={{ href: null }} />
```

The full file should be:

```tsx
import { Tabs } from "expo-router";
import { Calendar, Home, School, Users } from "lucide-react-native";
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
        name="(academy)"
        options={{
          title: "Academia",
          tabBarIcon: ({ color, size }) => <School size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="register-belt" options={{ href: null }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(student)/_layout.tsx
git commit -m "feat(mobile): add student Academia tab"
```

---

### Task 10: Verify types compile across the monorepo

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /Volumes/ExternalDisk1/repos/tatame-v2 && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | tail -5 && npx tsc --noEmit -p apps/mobile/tsconfig.json 2>&1 | tail -5`

Expected: No errors in either project.

- [ ] **Step 2: If errors exist, fix them and amend the relevant commit**

---

### Task 11: Visual verification against design

- [ ] **Step 1: Read both design nodes using Pencil MCP**

Use `batch_get` on `design.pen` with `nodeIds: ["WXT1J", "HKRmV"]`, `readDepth: 4`, `resolveVariables: true`.

Compare against the implemented `AcademyInfo.tsx` component:
- Nav row: BackButton left, "Academia" title center (Sora 18px bold), 40px spacer right
- Logo section: 88px Avatar with `variant="brand"`, "Somente visualização" text below
- Form fields: 5 fields with correct labels, icons (MapPin, Mail, Phone, Calendar), height 52, correct colors
- Member card: ShieldCheck icon in accent-translucent bg, "Membro ativo" + "Desde {date}"
- Warning card: bg `#242424`, "Atenção" bold + warning text
- Leave button: bg `#D64B4B`, height 56, "Sair da academia" text

- [ ] **Step 2: Take screenshots of design nodes**

Use Pencil MCP `get_screenshot` on `design.pen` for nodes `WXT1J` and `HKRmV`. Visually verify the component matches.

- [ ] **Step 3: Fix any visual discrepancies found**

If spacing, colors, typography, or layout don't match the design, update `AcademyInfo.tsx` accordingly.

- [ ] **Step 4: Commit any fixes**

```bash
git add apps/mobile/components/AcademyInfo.tsx
git commit -m "fix(mobile): adjust AcademyInfo layout to match design"
```
