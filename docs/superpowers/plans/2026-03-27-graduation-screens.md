# Graduation Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a belt promotion screen accessible from member detail, create instructor members screens, and update the API to support promoting both students and instructors.

**Architecture:** Backend-first — rename API fields and update authorization logic first, then add the promoter name join, then build mobile hooks and screens. The promotion screen lives at `(app)/promote-graduation.tsx` shared across roles. Instructor gets new `(members)` tab reusing existing `MembersListContent`.

**Tech Stack:** Drizzle ORM, Express, Zod, React Native, Expo Router, React Hook Form, TanStack Query, ModalSelect

### Linear tracking

Issues are in team **Tatame**, state **Backlog**. Each plan task maps 1:1 to a Linear issue and a stable **plan ID** for commits.

| Plan | Linear | Plan ID |
|------|--------|---------|
| Task 1 | [TAT-5](https://linear.app/tatame/issue/TAT-5/grad-task-1-rename-promote-body-field-to-userid-validators) | `PLAN-TASK-1` |
| Task 2 | [TAT-6](https://linear.app/tatame/issue/TAT-6/grad-task-2-graduation-repo-promotedbyname-join-users) | `PLAN-TASK-2` |
| Task 3 | [TAT-7](https://linear.app/tatame/issue/TAT-7/grad-task-3-service-promote-instructors-rename-methods) | `PLAN-TASK-3` |
| Task 4 | [TAT-8](https://linear.app/tatame/issue/TAT-8/grad-task-4-update-graduation-routes-api) | `PLAN-TASK-4` |
| Task 5 | [TAT-9](https://linear.app/tatame/issue/TAT-9/grad-task-5-mobile-hooks-for-graduation) | `PLAN-TASK-5` |
| Task 6 | [TAT-10](https://linear.app/tatame/issue/TAT-10/grad-task-6-promotion-screen-promote-graduation) | `PLAN-TASK-6` |
| Task 7 | [TAT-11](https://linear.app/tatame/issue/TAT-11/grad-task-7-promote-button-manager-member-detail) | `PLAN-TASK-7` |
| Task 8 | [TAT-12](https://linear.app/tatame/issue/TAT-12/grad-task-8-instructor-members-screens-tab) | `PLAN-TASK-8` |
| Task 9 | [TAT-13](https://linear.app/tatame/issue/TAT-13/grad-task-9-final-verification-graduation-plan) | `PLAN-TASK-9` |

**How to close Linear issues when you implement**

1. **Commit / PR:** Include the issue id (e.g. `TAT-5`) in the commit message. Examples: `feat(validators): rename promote body (#TAT-5)` or a body line `Fixes TAT-5` / `Closes TAT-5`. If [Linear’s Git integration](https://linear.app/docs/github) is enabled for your repo, merging the PR can auto-complete the issue.
2. **Manual:** When a task’s steps are done, set the Linear issue to **Done** (or move out of Backlog as your workflow prefers).
3. **Plan checkboxes:** Mark the corresponding `- [ ]` steps as `- [x]` in this file in the same change that closes the work.

---

### Task 1: Rename `studentUserId` → `userId` in validators

> **Linear:** [TAT-5](https://linear.app/tatame/issue/TAT-5/grad-task-1-rename-promote-body-field-to-userid-validators) · `PLAN-TASK-1`

**Files:**
- Modify: `packages/validators/src/graduation.schema.ts`

- [x] **Step 1: Rename schema and field**

In `packages/validators/src/graduation.schema.ts`, replace the `promoteStudentBeltBodySchema` block (lines 41-52):

```typescript
export const promoteBeltBodySchema = z
  .object({
    userId: z.string().uuid(),
    belt: beltSchema,
    stripes: z.number().int(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .superRefine(refineBeltStripes);

export type PromoteBeltBody = z.infer<typeof promoteBeltBodySchema>;
```

- [x] **Step 2: Add `promotedByName` to response schema**

In the same file, update `beltPromotionResponseSchema` to add `promotedByName`:

```typescript
export const beltPromotionResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  academyId: z.string().uuid(),
  promotedBy: z.string().uuid(),
  promotedByName: z.string(),
  belt: beltSchema,
  stripes: z.number().int(),
  isCurrent: z.boolean(),
  promotedAt: z.string(),
  notes: z.string().nullable(),
});
```

- [x] **Step 3: Commit**

```bash
git add packages/validators/src/graduation.schema.ts
git commit -m "feat(validators): rename promoteBeltBody userId, add promotedByName to response"
```

---

### Task 2: Update graduation repository to include promoter name

> **Linear:** [TAT-6](https://linear.app/tatame/issue/TAT-6/grad-task-2-graduation-repo-promotedbyname-join-users) · `PLAN-TASK-2`

**Files:**
- Modify: `apps/api/src/modules/graduation/graduation.repository.ts`
- Modify: `apps/api/src/modules/graduation/graduation.repository.postgres.ts`
- Modify: `apps/api/src/modules/graduation/graduation.repository.in-memory.ts`

- [x] **Step 1: Add `BeltPromotionWithPromoterName` type to interface**

In `apps/api/src/modules/graduation/graduation.repository.ts`, add the new type and update `listByUserInAcademy` return type:

```typescript
import type { InferSelectModel } from "drizzle-orm";
import type { beltPromotions } from "@tatame/db";

export type BeltPromotionRow = InferSelectModel<typeof beltPromotions>;

export type BeltPromotionWithPromoterName = BeltPromotionRow & {
  promotedByName: string;
};

export interface IGraduationRepository {
  findCurrentByUserId(userId: string): Promise<BeltPromotionRow | undefined>;

  listByUserInAcademy(
    userId: string,
    academyId: string,
  ): Promise<BeltPromotionWithPromoterName[]>;

  insertInitialCurrent(data: {
    userId: string;
    academyId: string;
    promotedBy: string;
    belt: string;
    stripes: number;
    notes: string | null;
  }): Promise<BeltPromotionRow>;

  /** Clears `is_current` for the user and inserts the new current row (spec §6.10). */
  replaceCurrentPromotion(data: {
    userId: string;
    academyId: string;
    promotedBy: string;
    belt: string;
    stripes: number;
    notes: string | null;
  }): Promise<BeltPromotionRow>;
}
```

- [x] **Step 2: Update Postgres repository to JOIN users**

In `apps/api/src/modules/graduation/graduation.repository.postgres.ts`, update the imports and `listByUserInAcademy`:

```typescript
import { and, desc, eq } from "drizzle-orm";
import { beltPromotions, users, type Database } from "@tatame/db";
import type {
  BeltPromotionRow,
  BeltPromotionWithPromoterName,
  IGraduationRepository,
} from "./graduation.repository.js";
```

Replace `listByUserInAcademy`:

```typescript
async listByUserInAcademy(
  userId: string,
  academyId: string,
): Promise<BeltPromotionWithPromoterName[]> {
  const rows = await this.db
    .select({
      id: beltPromotions.id,
      userId: beltPromotions.userId,
      academyId: beltPromotions.academyId,
      promotedBy: beltPromotions.promotedBy,
      promotedByName: users.name,
      belt: beltPromotions.belt,
      stripes: beltPromotions.stripes,
      isCurrent: beltPromotions.isCurrent,
      promotedAt: beltPromotions.promotedAt,
      notes: beltPromotions.notes,
    })
    .from(beltPromotions)
    .innerJoin(users, eq(users.id, beltPromotions.promotedBy))
    .where(
      and(
        eq(beltPromotions.userId, userId),
        eq(beltPromotions.academyId, academyId),
      ),
    )
    .orderBy(desc(beltPromotions.promotedAt));
  return rows;
}
```

- [x] **Step 3: Update InMemory repository**

In `apps/api/src/modules/graduation/graduation.repository.in-memory.ts`, update the import and `listByUserInAcademy`:

```typescript
import type {
  BeltPromotionRow,
  BeltPromotionWithPromoterName,
  IGraduationRepository,
} from "./graduation.repository.js";
```

Replace `listByUserInAcademy`:

```typescript
async listByUserInAcademy(
  userId: string,
  academyId: string,
): Promise<BeltPromotionWithPromoterName[]> {
  return this.rows
    .filter((r) => r.userId === userId && r.academyId === academyId)
    .sort(
      (a, b) =>
        new Date(b.promotedAt).getTime() - new Date(a.promotedAt).getTime(),
    )
    .map((r) => ({ ...r, promotedByName: "Test User" }));
}
```

- [x] **Step 4: Commit**

```bash
git add apps/api/src/modules/graduation/graduation.repository.ts apps/api/src/modules/graduation/graduation.repository.postgres.ts apps/api/src/modules/graduation/graduation.repository.in-memory.ts
git commit -m "feat(api): add promotedByName to graduation list via JOIN"
```

---

### Task 3: Rename service methods and allow instructor promotion

> **Linear:** [TAT-7](https://linear.app/tatame/issue/TAT-7/grad-task-3-service-promote-instructors-rename-methods) · `PLAN-TASK-3`

**Files:**
- Modify: `apps/api/src/modules/graduation/graduation.service.ts`
- Modify: `apps/api/src/modules/graduation/graduation.service.test.ts`

- [ ] **Step 1: Write failing tests for instructor promotion by manager**

Add to `apps/api/src/modules/graduation/graduation.service.test.ts`:

```typescript
it("promoteMember allows manager to promote an instructor", async () => {
  const managerId = randomUUID();
  const instructorId = randomUUID();
  const academy = makeAcademy({ ownerId: managerId });
  const memInstructor = makeMembership({
    userId: instructorId,
    academyId: academy.id,
    role: "instructor",
    status: "active",
    isActive: true,
  });
  const promos = [
    makeBeltPromotion({
      userId: instructorId,
      academyId: academy.id,
      isCurrent: true,
      belt: "blue",
      stripes: 2,
      promotedBy: instructorId,
    }),
  ];
  const svc = makeGraduationSvc(promos, [memInstructor], academy);

  const row = await svc.promoteMember({
    actorUserId: managerId,
    actorRole: "manager",
    academyId: academy.id,
    targetUserId: instructorId,
    belt: Belt.Purple,
    stripes: 0,
    notes: null,
  });
  expect(row.belt).toBe("purple");
});

it("promoteMember rejects instructor promoting another instructor", async () => {
  const instructorA = randomUUID();
  const instructorB = randomUUID();
  const academy = makeAcademy();
  const memA = makeMembership({
    userId: instructorA,
    academyId: academy.id,
    role: "instructor",
    status: "active",
    isActive: true,
  });
  const memB = makeMembership({
    userId: instructorB,
    academyId: academy.id,
    role: "instructor",
    status: "active",
    isActive: true,
  });
  const promos = [
    makeBeltPromotion({
      userId: instructorB,
      academyId: academy.id,
      isCurrent: true,
      belt: "white",
      stripes: 0,
      promotedBy: instructorB,
    }),
  ];
  const svc = makeGraduationSvc(promos, [memA, memB], academy);

  await expect(
    svc.promoteMember({
      actorUserId: instructorA,
      actorRole: "instructor",
      academyId: academy.id,
      targetUserId: instructorB,
      belt: Belt.Blue,
      stripes: 0,
      notes: null,
    }),
  ).rejects.toMatchObject({ statusCode: 404 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run src/modules/graduation/graduation.service.test.ts`

Expected: FAIL — `promoteMember` is not defined on `GraduationService`.

- [ ] **Step 3: Rename methods and update logic in service**

In `apps/api/src/modules/graduation/graduation.service.ts`:

Rename `assertStaffCanListStudent` to `assertStaffCanListMember` and update the validation:

```typescript
async assertStaffCanListMember(
  actorUserId: string,
  actorRole: Role,
  academyId: string,
  targetUserId: string,
): Promise<void> {
  await this.assertActorCanPromoteInAcademy(
    actorUserId,
    actorRole,
    academyId,
  );
  const m = await this.membershipRepo.findActiveByUserAndAcademy(
    targetUserId,
    academyId,
  );
  if (!m || m.status !== "active") {
    throw new HttpError(404, "Member not found in this academy");
  }
  // Instructors can only view student graduations
  if (actorRole === "instructor" && m.role !== "student") {
    throw new HttpError(404, "Member not found in this academy");
  }
  // Managers can view student and instructor graduations
  if (actorRole === "manager" && m.role !== "student" && m.role !== "instructor") {
    throw new HttpError(404, "Member not found in this academy");
  }
}
```

Rename `promoteStudent` to `promoteMember` and update the param name and validation:

```typescript
async promoteMember(opts: {
  actorUserId: string;
  actorRole: Role;
  academyId: string;
  targetUserId: string;
  belt: Belt;
  stripes: number;
  notes: string | null;
}): Promise<BeltPromotionRow> {
  await this.assertActorCanPromoteInAcademy(
    opts.actorUserId,
    opts.actorRole,
    opts.academyId,
  );

  if (opts.targetUserId === opts.actorUserId) {
    throw new HttpError(400, "Use the initial belt endpoint for your own belt");
  }

  const m = await this.membershipRepo.findActiveByUserAndAcademy(
    opts.targetUserId,
    opts.academyId,
  );
  if (!m || m.status !== "active") {
    throw new HttpError(404, "Member not found in this academy");
  }

  // Instructors can only promote students
  if (opts.actorRole === "instructor" && m.role !== "student") {
    throw new HttpError(404, "Member not found in this academy");
  }
  // Managers can promote students and instructors
  if (opts.actorRole === "manager" && m.role !== "student" && m.role !== "instructor") {
    throw new HttpError(404, "Member not found in this academy");
  }

  const current = await this.graduationRepo.findCurrentByUserId(
    opts.targetUserId,
  );
  if (!current) {
    throw new HttpError(
      409,
      "Member has no current belt; they must register their initial belt first",
    );
  }

  assertValidPromotion(
    { belt: current.belt as Belt, stripes: current.stripes },
    { belt: opts.belt, stripes: opts.stripes },
  );

  return this.graduationRepo.replaceCurrentPromotion({
    userId: opts.targetUserId,
    academyId: opts.academyId,
    promotedBy: opts.actorUserId,
    belt: opts.belt,
    stripes: opts.stripes,
    notes: opts.notes,
  });
}
```

- [ ] **Step 4: Update existing test that uses old method name**

In `graduation.service.test.ts`, update the `promoteStudent replaces current belt` test (line 191-227) to use the new method name:

Replace `svc.promoteStudent({` with `svc.promoteMember({` and replace `studentUserId: studentId` with `targetUserId: studentId`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/modules/graduation/graduation.service.test.ts`

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/graduation/graduation.service.ts apps/api/src/modules/graduation/graduation.service.test.ts
git commit -m "feat(api): rename promoteMember, allow manager to promote instructors"
```

---

### Task 4: Update graduation routes

> **Linear:** [TAT-8](https://linear.app/tatame/issue/TAT-8/grad-task-4-update-graduation-routes-api) · `PLAN-TASK-4`

**Files:**
- Modify: `apps/api/src/modules/graduation/graduation.routes.ts`

- [ ] **Step 1: Update imports and route handlers**

In `apps/api/src/modules/graduation/graduation.routes.ts`, update imports:

```typescript
import type {
  PromoteBeltBody,
  RegisterInitialBeltBody,
} from "@tatame/validators";
import {
  listGraduationsQuerySchema,
  promoteBeltBodySchema,
  registerInitialBeltBodySchema,
} from "@tatame/validators";
```

Update `formatPromotion` to include `promotedByName`. Change the function to accept the expanded type:

```typescript
function formatPromotion(row: {
  id: string;
  userId: string;
  academyId: string;
  promotedBy: string;
  promotedByName?: string;
  belt: string;
  stripes: number;
  isCurrent: boolean;
  promotedAt: Date;
  notes: string | null;
}) {
  return {
    id: row.id,
    userId: row.userId,
    academyId: row.academyId,
    promotedBy: row.promotedBy,
    promotedByName: row.promotedByName ?? "",
    belt: row.belt,
    stripes: row.stripes,
    isCurrent: row.isCurrent,
    promotedAt: row.promotedAt.toISOString(),
    notes: row.notes ?? null,
  };
}
```

Update the `GET /` handler to use `assertStaffCanListMember`:

```typescript
await graduationService.assertStaffCanListMember(
  actorId,
  actorRole,
  academyId,
  query.data.userId,
);
```

Update the `POST /` handler:

```typescript
graduationRouter.post(
  "/",
  authorize(Role.Manager, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(promoteBeltBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as PromoteBeltBody;
      const row = await graduationService.promoteMember({
        actorUserId: req.appAuth!.userId,
        actorRole: req.appAuth!.role,
        academyId: req.appAuth!.activeAcademyId!,
        targetUserId: body.userId,
        belt: body.belt,
        stripes: body.stripes,
        notes: body.notes ?? null,
      });
      res.status(201).json(formatPromotion(row));
    } catch (e) {
      next(e);
    }
  },
);
```

- [ ] **Step 2: Verify API compiles**

Run: `cd apps/api && npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/graduation/graduation.routes.ts
git commit -m "feat(api): update graduation routes for renamed fields and promotedByName"
```

---

### Task 5: Add mobile hooks for graduation

> **Linear:** [TAT-9](https://linear.app/tatame/issue/TAT-9/grad-task-5-mobile-hooks-for-graduation) · `PLAN-TASK-5`

**Files:**
- Modify: `apps/mobile/lib/hooks/use-graduation.ts`

- [ ] **Step 1: Add `useGraduationHistory` and `usePromoteGraduation` hooks**

Replace `apps/mobile/lib/hooks/use-graduation.ts` with:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import type {
  BeltPromotionResponse,
  RegisterInitialBeltBody,
} from "@tatame/validators";

type GraduationsResponse = { items: BeltPromotionResponse[] };

export function useMyGraduation() {
  const api = useApi();

  return useQuery({
    queryKey: ["graduation", "me"],
    queryFn: () => api.get<GraduationsResponse>("/graduations/me"),
    retry: false,
    select: (data) => data.items.find((g) => g.isCurrent) ?? null,
  });
}

export function useGraduationHistory(userId: string | undefined) {
  const api = useApi();

  return useQuery({
    queryKey: ["graduation", userId],
    queryFn: () =>
      api.get<GraduationsResponse>(`/graduations?userId=${userId}`),
    enabled: !!userId,
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

export function usePromoteGraduation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      userId: string;
      belt: string;
      stripes: number;
      notes?: string | null;
    }) => api.post<BeltPromotionResponse>("/graduations", body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["graduation", variables.userId],
      });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/lib/hooks/use-graduation.ts
git commit -m "feat(mobile): add useGraduationHistory and usePromoteGraduation hooks"
```

---

### Task 6: Create the promotion screen

> **Linear:** [TAT-10](https://linear.app/tatame/issue/TAT-10/grad-task-6-promotion-screen-promote-graduation) · `PLAN-TASK-6`

**Files:**
- Create: `apps/mobile/app/(app)/promote-graduation.tsx`

- [ ] **Step 1: Create the promotion screen**

Create `apps/mobile/app/(app)/promote-graduation.tsx`:

```tsx
import { useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, ChevronLeft } from "lucide-react-native";
import { BELT_ORDER, MAX_STRIPES_BY_BELT } from "@tatame/config";
import type { Belt } from "@tatame/types";

import { Avatar } from "@/components/Avatar";
import { ModalSelect } from "@/components/ModalSelect";
import {
  useGraduationHistory,
  usePromoteGraduation,
} from "@/lib/hooks/use-graduation";
import { useMemberDetail } from "@/lib/hooks/use-membership";

const BELT_LABELS: Record<string, string> = {
  white: "Faixa branca",
  blue: "Faixa azul",
  purple: "Faixa roxa",
  brown: "Faixa marrom",
  black: "Faixa preta",
};

const BELT_LABELS_SHORT: Record<string, string> = {
  white: "Branca",
  blue: "Azul",
  purple: "Roxa",
  brown: "Marrom",
  black: "Preta",
};

const ROLE_TITLE: Record<string, string> = {
  student: "Promover aluno",
  instructor: "Promover instrutor",
};

const promotionFormSchema = z.object({
  belt: z.string().min(1),
  stripes: z.number().int().min(0),
  notes: z.string().max(2000).nullable(),
});

type PromotionForm = z.infer<typeof promotionFormSchema>;

export default function PromoteGraduationScreen() {
  const { userId, membershipId } = useLocalSearchParams<{
    userId: string;
    membershipId: string;
  }>();
  const router = useRouter();

  const { data: member, isPending: memberPending } =
    useMemberDetail(membershipId);
  const { data: graduationData, isPending: gradPending } =
    useGraduationHistory(userId);
  const promoteMutation = usePromoteGraduation();

  const history = graduationData?.items ?? [];
  const currentBelt = history.find((g) => g.isCurrent);

  // Determine next logical belt
  const nextBelt = useMemo(() => {
    if (!currentBelt) return "";
    const idx = BELT_ORDER.indexOf(currentBelt.belt as Belt);
    if (idx < BELT_ORDER.length - 1) return BELT_ORDER[idx + 1]!;
    return currentBelt.belt;
  }, [currentBelt]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { isValid },
  } = useForm<PromotionForm>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: { belt: "", stripes: 0, notes: null },
  });

  // Set default belt once data loads
  useEffect(() => {
    if (nextBelt) {
      setValue("belt", nextBelt);
    }
  }, [nextBelt, setValue]);

  const selectedBelt = watch("belt");

  // Reset stripes when belt changes
  useEffect(() => {
    setValue("stripes", 0);
  }, [selectedBelt, setValue]);

  const maxStripes = selectedBelt
    ? MAX_STRIPES_BY_BELT[selectedBelt as Belt] ?? 4
    : 4;

  const beltOptions = BELT_ORDER.map((b) => ({
    value: b,
    label: BELT_LABELS[b] ?? b,
  }));

  const stripesOptions = Array.from({ length: maxStripes + 1 }, (_, i) => ({
    value: String(i),
    label: String(i),
  }));

  const onSubmit = handleSubmit((data) => {
    if (!userId) return;
    promoteMutation.mutate(
      {
        userId,
        belt: data.belt,
        stripes: data.stripes,
        notes: data.notes || null,
      },
      { onSuccess: () => router.back() },
    );
  });

  const formatHistoryTitle = useCallback(
    (item: (typeof history)[number], index: number) => {
      const date = new Date(item.promotedAt).toLocaleDateString("pt-BR");
      const prev = history[index + 1];
      if (!prev) {
        return `${date} · ${BELT_LABELS_SHORT[item.belt] ?? item.belt} ${item.stripes}`;
      }
      return `${date} · ${BELT_LABELS_SHORT[prev.belt] ?? prev.belt} ${prev.stripes} → ${BELT_LABELS_SHORT[item.belt] ?? item.belt} ${item.stripes}`;
    },
    [history],
  );

  if (memberPending || gradPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  if (!member) return null;

  const title = ROLE_TITLE[member.role] ?? "Promover membro";
  const avatarLetter = (member.userName?.charAt(0) || "?").toUpperCase();
  const currentBeltLabel = currentBelt
    ? `Faixa ${BELT_LABELS_SHORT[currentBelt.belt]?.toLowerCase() ?? currentBelt.belt} · ${currentBelt.stripes} graus atuais`
    : "Nenhuma graduação registrada";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View style={{ paddingHorizontal: 24, paddingTop: 8, gap: 20 }}>
            {/* Nav Row */}
            <View className="flex-row items-center justify-between">
              <Pressable
                onPress={() => router.back()}
                className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
              >
                <ChevronLeft size={20} color="#FFFFFF" />
              </Pressable>
              <Text className="font-poppins-bold text-lg text-primary">
                {title}
              </Text>
              <View className="h-10 w-10" />
            </View>

            {/* Member Card */}
            <View
              className="rounded-2xl border border-surface-border bg-surface"
              style={{ padding: 16, gap: 14 }}
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <Avatar
                  variant="user"
                  imageUrl={member.userProfileImageUrl}
                  fallbackLetter={avatarLetter}
                  size={42}
                />
                <View className="min-w-0 flex-1" style={{ gap: 2 }}>
                  <Text className="font-poppins-semibold text-base text-primary">
                    {member.userName}
                  </Text>
                  <Text className="font-poppins-medium text-xs text-muted">
                    {currentBeltLabel}
                  </Text>
                </View>
              </View>

              <View
                className="flex-row items-center rounded-[10px]"
                style={{
                  backgroundColor: "#A078E815",
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  gap: 8,
                }}
              >
                <View
                  className="rounded-full"
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: currentBelt ? "#7E57C2" : "#525252",
                  }}
                />
                <Text className="font-poppins-medium text-xs text-muted">
                  {currentBelt
                    ? "Graduação atual registrada e pronta para promoção"
                    : "Nenhuma graduação registrada"}
                </Text>
              </View>
            </View>

            {/* Promotion Form */}
            {currentBelt ? (
              <View
                className="rounded-2xl border border-surface-border bg-surface"
                style={{ padding: 16, gap: 12 }}
              >
                <Text className="font-poppins-semibold text-sm text-muted">
                  Nova promoção
                </Text>

                <View style={{ gap: 6 }}>
                  <Text className="font-poppins-semibold text-[13px] text-primary">
                    Nova faixa
                  </Text>
                  <Controller
                    control={control}
                    name="belt"
                    render={({ field: { value, onChange } }) => (
                      <ModalSelect
                        value={value}
                        onChange={onChange}
                        options={beltOptions}
                        placeholder="Selecionar faixa"
                      />
                    )}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text className="font-poppins-semibold text-[13px] text-primary">
                    Novos graus
                  </Text>
                  <Controller
                    control={control}
                    name="stripes"
                    render={({ field: { value, onChange } }) => (
                      <ModalSelect
                        value={String(value)}
                        onChange={(v) => onChange(Number(v))}
                        options={stripesOptions}
                        placeholder="0"
                      />
                    )}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text className="font-poppins-semibold text-[13px] text-primary">
                    Notas (opcional)
                  </Text>
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { value, onChange } }) => (
                      <TextInput
                        className="rounded-[10px] border border-surface-border font-poppins text-[13px] text-primary"
                        style={{
                          backgroundColor: "#121212",
                          height: 88,
                          padding: 12,
                          textAlignVertical: "top",
                        }}
                        placeholder="Ex.: evolução consistente nas últimas semanas."
                        placeholderTextColor="#525252"
                        multiline
                        value={value ?? ""}
                        onChangeText={(t) => onChange(t || null)}
                      />
                    )}
                  />
                </View>

                <Pressable
                  onPress={onSubmit}
                  disabled={!isValid || promoteMutation.isPending}
                  className="flex-row items-center justify-center rounded-xl"
                  style={{
                    backgroundColor:
                      !isValid || promoteMutation.isPending
                        ? "#3A3A3A"
                        : "#A078E8",
                    height: 56,
                    gap: 8,
                  }}
                >
                  {promoteMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <ArrowUpRight size={20} color="#FFFFFF" />
                      <Text className="font-poppins-semibold text-base text-white">
                        Promover com confirmação
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}

            {/* History */}
            <Text className="font-poppins-semibold text-sm text-muted">
              Histórico de promoções
            </Text>

            <View style={{ gap: 10 }}>
              {history.length === 0 ? (
                <View className="items-center rounded-[14px] border border-surface-border bg-surface py-8">
                  <Text className="font-poppins text-sm" style={{ color: "#525252" }}>
                    Nenhuma promoção registrada
                  </Text>
                </View>
              ) : (
                history.map((item, index) => (
                  <View
                    key={item.id}
                    className="rounded-xl border border-surface-border bg-surface"
                    style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 3 }}
                  >
                    <Text className="font-poppins-semibold text-[13px] text-primary">
                      {formatHistoryTitle(item, index)}
                    </Text>
                    <Text className="font-poppins-medium text-[11px] text-muted">
                      Promovido por {item.promotedByName}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/promote-graduation.tsx
git commit -m "feat(mobile): add promote graduation screen"
```

---

### Task 7: Add promote button to manager member detail

> **Linear:** [TAT-11](https://linear.app/tatame/issue/TAT-11/grad-task-7-promote-button-manager-member-detail) · `PLAN-TASK-7`

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/(members)/[membershipId].tsx`

- [ ] **Step 1: Add the promote button**

In `apps/mobile/app/(app)/(manager)/(members)/[membershipId].tsx`, add `ArrowUpRight` to the lucide import:

```typescript
import {
  ArrowLeft,
  ArrowUpRight,
  AtSign,
  Ban,
  Calendar,
  Mail,
  Phone,
} from "lucide-react-native";
```

Add the promote button above the block button. Replace the bottom section (lines 187-199) with:

```tsx
{member.status === "active" && member.role !== "manager" ? (
  <View className="mb-6" style={{ gap: 10 }}>
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/(app)/promote-graduation",
          params: { userId: member.userId, membershipId },
        })
      }
      className="flex-row items-center justify-center gap-2 rounded-xl py-3.5"
      style={{ backgroundColor: "#A078E8", height: 48 }}
    >
      <ArrowUpRight size={16} color="#FFFFFF" />
      <Text className="font-poppins-semibold text-sm text-white">
        Promover graduação
      </Text>
    </Pressable>
    <Pressable
      onPress={handleBlock}
      disabled={blockMutation.isPending}
      className="flex-row items-center justify-center gap-2 rounded-xl border py-3.5"
      style={{ backgroundColor: "#1A0A0A", borderColor: "#FF453A40" }}
    >
      <Ban size={16} color="#FF453A" />
      <Text className="font-poppins-semibold text-sm" style={{ color: "#FF453A" }}>
        Bloquear membro
      </Text>
    </Pressable>
  </View>
) : null}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/\(manager\)/\(members\)/\[membershipId\].tsx
git commit -m "feat(mobile): add promote graduation button to manager member detail"
```

---

### Task 8: Create instructor members screens

> **Linear:** [TAT-12](https://linear.app/tatame/issue/TAT-12/grad-task-8-instructor-members-screens-tab) · `PLAN-TASK-8`

**Files:**
- Create: `apps/mobile/app/(app)/(instructor)/(members)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(instructor)/(members)/index.tsx`
- Create: `apps/mobile/app/(app)/(instructor)/(members)/[membershipId].tsx`
- Modify: `apps/mobile/app/(app)/(instructor)/_layout.tsx`
- Delete: `apps/mobile/app/(app)/(instructor)/(graduation)/_layout.tsx`
- Delete: `apps/mobile/app/(app)/(instructor)/(graduation)/index.tsx`

- [ ] **Step 1: Create instructor members layout**

Create `apps/mobile/app/(app)/(instructor)/(members)/_layout.tsx`:

```tsx
import { Stack } from "expo-router";

export default function InstructorMembersLayout() {
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

- [ ] **Step 2: Create instructor members list**

Create `apps/mobile/app/(app)/(instructor)/(members)/index.tsx`:

```tsx
import { MembersListContent } from "@/components/MembersListContent";

export default function InstructorMembersListScreen() {
  return (
    <MembersListContent
      allowMemberDetails
      getMemberDetailHref={(membershipId) =>
        `/(app)/(instructor)/(members)/${membershipId}`
      }
    />
  );
}
```

- [ ] **Step 3: Create instructor member detail**

Create `apps/mobile/app/(app)/(instructor)/(members)/[membershipId].tsx`:

```tsx
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { useMemberDetail } from "@/lib/hooks/use-membership";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowUpRight,
  AtSign,
  Calendar,
  Mail,
  Phone,
} from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";
const SEPARATOR = "#2A2A2A";

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateLong(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

export default function InstructorMemberDetailScreen() {
  const { membershipId } = useLocalSearchParams<{ membershipId: string }>();
  const router = useRouter();

  const { data: member, isPending } = useMemberDetail(membershipId);

  if (isPending || !member) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const letter = (member.userName || "?").charAt(0).toUpperCase();

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 16 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">Detalhes</Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 18, paddingBottom: 24 }}
        >
          <View className="items-center" style={{ gap: 12 }}>
            <Avatar
              variant="user"
              imageUrl={member.userProfileImageUrl}
              fallbackLetter={letter}
              size={80}
            />
            <Text className="font-poppins-bold text-[30px] text-primary">
              {member.userName}
            </Text>
            <View className="flex-row items-center gap-2">
              <Badge variant="role" value={member.role} />
              <Badge variant="status" value={member.status} />
            </View>
          </View>

          <View className="overflow-hidden rounded-2xl border border-surface-border bg-surface">
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <Mail size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">{member.userEmail}</Text>
            </View>
            <View className="h-px" style={{ backgroundColor: SEPARATOR }} />
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <Phone size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {member.userPhone ?? "—"}
              </Text>
            </View>
            <View className="h-px" style={{ backgroundColor: SEPARATOR }} />
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <AtSign size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {member.userInstagram ?? "—"}
              </Text>
            </View>
            <View className="h-px" style={{ backgroundColor: SEPARATOR }} />
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <Calendar size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {member.userBirthDate ?? "—"}
              </Text>
            </View>
          </View>

          <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
            Histórico de associação
          </Text>

          <View className="overflow-hidden rounded-2xl border border-surface-border bg-surface">
            {member.history.map((entry, index) => {
              const isCurrent = index === 0 && entry.status === "active";
              const joinedLabel = formatDateLong(entry.joinedAt ?? entry.createdAt);
              const periodLabel = `${formatDateShort(entry.joinedAt ?? entry.createdAt)} — ${formatDateShort(entry.leftAt)}`;

              return (
                <View key={entry.id}>
                  <View className="flex-row items-center justify-between px-4 py-3.5">
                    <View className="min-w-0 flex-1" style={{ gap: 2 }}>
                      <Text
                        className="font-poppins text-xs"
                        style={{ color: isCurrent ? TEXT_SECONDARY : TEXT_MUTED }}
                      >
                        {isCurrent ? "Membro desde" : "Associação anterior"}
                      </Text>
                      <Text className="font-poppins-semibold text-sm text-primary">
                        {isCurrent ? joinedLabel : periodLabel}
                      </Text>
                    </View>
                    <Badge variant="status" value={entry.status} />
                  </View>
                  {index < member.history.length - 1 ? (
                    <View className="h-px" style={{ backgroundColor: SEPARATOR }} />
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>

        {member.status === "active" && member.role === "student" ? (
          <View className="mb-6">
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(app)/promote-graduation",
                  params: { userId: member.userId, membershipId },
                })
              }
              className="flex-row items-center justify-center gap-2 rounded-xl py-3.5"
              style={{ backgroundColor: "#A078E8", height: 48 }}
            >
              <ArrowUpRight size={16} color="#FFFFFF" />
              <Text className="font-poppins-semibold text-sm text-white">
                Promover graduação
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Update instructor layout — replace graduation tab with members**

In `apps/mobile/app/(app)/(instructor)/_layout.tsx`, replace entire file:

```tsx
import { Tabs } from "expo-router";
import { Calendar, Home, School, Users } from "lucide-react-native";
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
      <Tabs.Screen
        name="(academy)"
        options={{
          title: "Academia",
          tabBarIcon: ({ color, size }) => <School size={size} color={color} />,
          href: null,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 5: Delete old graduation placeholder files**

```bash
rm apps/mobile/app/\(app\)/\(instructor\)/\(graduation\)/_layout.tsx
rm apps/mobile/app/\(app\)/\(instructor\)/\(graduation\)/index.tsx
rmdir apps/mobile/app/\(app\)/\(instructor\)/\(graduation\)
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/\(app\)/\(instructor\)/
git commit -m "feat(mobile): add instructor members screens, replace graduation placeholder"
```

---

### Task 9: Final verification

> **Linear:** [TAT-13](https://linear.app/tatame/issue/TAT-13/grad-task-9-final-verification-graduation-plan) · `PLAN-TASK-9`

- [ ] **Step 1: Run all API unit tests**

Run: `cd apps/api && npx vitest run`

Expected: All tests pass.

- [ ] **Step 2: Run type checks**

Run:
```bash
cd apps/api && npx tsc --noEmit && cd ../../apps/mobile && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit if any fixes were needed**

Only if previous steps required fixes:
```bash
git add -A
git commit -m "fix: resolve type errors from graduation screens implementation"
```
