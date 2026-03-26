# Membership Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable instructors/students to search an academy and request to join, and enable managers to list members, view details, and approve/reject pending requests — connecting both sides into a functional enrollment flow.

**Architecture:** Backend membership endpoints already exist (request, approve, reject, block, list pending). We need two new backend endpoints (list all members, member detail) plus extending `/me` for non-manager membership context. Mobile side needs new screens for manager member management (M-MGR-04/05/06) and instructor/student onboarding flow (search → detail → request → waiting). Instructor and student screens are identical except for copy text, so they share a single route group.

**Tech Stack:** Expo Router, NativeWind, TanStack Query, Express, Drizzle ORM, Zod

---

## File Structure

### Backend — New/Modified Files

| File | Action | Responsibility |
| --- | --- | --- |
| `packages/validators/src/membership.schema.ts` | Modify | Add `listMembersQuerySchema`, `memberListItemSchema`, `memberDetailResponseSchema` |
| `packages/validators/src/user.schema.ts` | Modify | Add `activeMembershipSchema` to `/me` response |
| `packages/validators/src/index.ts` | Modify | Export new schemas |
| `apps/api/src/modules/membership/membership.repository.ts` | Modify | Add `findByAcademy`, `findDetailById` |
| `apps/api/src/modules/membership/membership.repository.postgres.ts` | Modify | Implement new methods |
| `apps/api/src/modules/membership/membership.service.ts` | Modify | Add `listMembers`, `getMemberDetail` |
| `apps/api/src/modules/membership/membership.routes.ts` | Modify | Add `GET /` and `GET /:membershipId` |
| `apps/api/src/modules/user/user.service.ts` | Modify | Fetch active membership for non-managers |
| `apps/api/src/modules/user/user.routes.ts` | Modify | Include `activeMembership` in `/me` |

### Mobile — New/Modified Files

| File | Action | Responsibility |
| --- | --- | --- |
| `apps/mobile/lib/hooks/use-membership.ts` | Create | All membership query/mutation hooks |
| `apps/mobile/components/Badge.tsx` | Create | Role and status badge component |
| `apps/mobile/components/FilterTabs.tsx` | Create | Horizontal scrollable filter tabs |
| `apps/mobile/components/MemberCard.tsx` | Create | Member list item row |
| `apps/mobile/components/PendingRequestCard.tsx` | Create | Pending request card with approve/reject |
| `apps/mobile/components/AcademySearchCard.tsx` | Create | Academy search result row |
| `apps/mobile/app/(app)/(manager)/(members)/index.tsx` | Modify | M-MGR-04: Member list screen |
| `apps/mobile/app/(app)/(manager)/(members)/[membershipId].tsx` | Create | M-MGR-05: Member detail screen |
| `apps/mobile/app/(app)/(manager)/(members)/pending.tsx` | Create | M-MGR-06: Pending requests screen |
| `apps/mobile/app/(app)/(joining)/_layout.tsx` | Create | Stack layout for join flow |
| `apps/mobile/app/(app)/(joining)/search-academy.tsx` | Create | Search academy screen |
| `apps/mobile/app/(app)/(joining)/academy/[academyId].tsx` | Create | Academy detail screen |
| `apps/mobile/app/(app)/(joining)/pending-approval.tsx` | Create | Waiting for approval screen |
| `apps/mobile/app/(app)/_layout.tsx` | Modify | Add instructor/student routing |

---

## Task 1: Backend — Add `listMembers` to membership repository ✅

**Files:**
- Modify: `packages/validators/src/membership.schema.ts`
- Modify: `packages/validators/src/index.ts`
- Modify: `apps/api/src/modules/membership/membership.repository.ts`
- Modify: `apps/api/src/modules/membership/membership.repository.postgres.ts`

- [x] **Step 1: Add list members schemas to validators**

In `packages/validators/src/membership.schema.ts`, add at the end:

```typescript
export const listMembersQuerySchema = z.object({
  role: z.enum(["instructor", "student"]).optional(),
  status: z.enum(["pending", "active", "blocked"]).optional(),
  q: z.string().optional(),
});

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;

export const memberListItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["manager", "instructor", "student"]),
  status: z.enum(["pending", "active", "rejected", "blocked"]),
  joinedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  userName: z.string(),
  userEmail: z.string().email(),
  userProfileImageUrl: z.string().nullable(),
});

export type MemberListItem = z.infer<typeof memberListItemSchema>;

export const memberDetailResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["manager", "instructor", "student"]),
  status: z.enum(["pending", "active", "rejected", "blocked"]),
  joinedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  userName: z.string(),
  userEmail: z.string().email(),
  userPhone: z.string().nullable(),
  userInstagram: z.string().nullable(),
  userBirthDate: z.string().nullable(),
  userProfileImageUrl: z.string().nullable(),
  history: z.array(
    z.object({
      id: z.string().uuid(),
      role: z.enum(["manager", "instructor", "student"]),
      status: z.enum(["pending", "active", "rejected", "blocked"]),
      joinedAt: z.coerce.date().nullable(),
      leftAt: z.coerce.date().nullable(),
      createdAt: z.coerce.date(),
    })
  ),
});

export type MemberDetailResponse = z.infer<typeof memberDetailResponseSchema>;
```

- [x] **Step 2: Export new schemas from validators index**

In `packages/validators/src/index.ts`, add to the membership exports:

```typescript
export {
  requestMembershipBodySchema,
  membershipIdParamSchema,
  pendingQuerySchema,
  membershipResponseSchema,
  pendingMembershipItemSchema,
  listMembersQuerySchema,
  memberListItemSchema,
  memberDetailResponseSchema,
  type RequestMembershipBody,
  type MembershipResponse,
  type PendingMembershipItem,
  type ListMembersQuery,
  type MemberListItem,
  type MemberDetailResponse,
} from "./membership.schema.js";
```

- [x] **Step 3: Add repository interface methods**

In `apps/api/src/modules/membership/membership.repository.ts`, add to the interface:

```typescript
findByAcademy(
  academyId: string,
  filters: { role?: string; status?: string; q?: string }
): Promise<MemberListItem[]>;

findDetailById(membershipId: string): Promise<MemberDetailResponse | null>;
```

Import the new types at the top:

```typescript
import type { MemberListItem, MemberDetailResponse } from "@tatame/validators";
```

- [x] **Step 4: Implement repository methods in postgres**

In `apps/api/src/modules/membership/membership.repository.postgres.ts`, add:

```typescript
async findByAcademy(
  academyId: string,
  filters: { role?: string; status?: string; q?: string }
): Promise<MemberListItem[]> {
  const conditions = [eq(academyMemberships.academyId, academyId)];

  if (filters.role) {
    conditions.push(eq(academyMemberships.role, filters.role as any));
  }
  if (filters.status) {
    conditions.push(eq(academyMemberships.status, filters.status as any));
  }

  const rows = await this.db
    .select({
      id: academyMemberships.id,
      userId: academyMemberships.userId,
      role: academyMemberships.role,
      status: academyMemberships.status,
      joinedAt: academyMemberships.joinedAt,
      createdAt: academyMemberships.createdAt,
      userName: users.name,
      userEmail: users.email,
      userProfileImageUrl: users.profileImageUrl,
    })
    .from(academyMemberships)
    .innerJoin(users, eq(academyMemberships.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(academyMemberships.createdAt));

  let results = rows;
  if (filters.q) {
    const lower = filters.q.toLowerCase();
    results = rows.filter(
      (r) =>
        r.userName.toLowerCase().includes(lower) ||
        r.userEmail.toLowerCase().includes(lower)
    );
  }

  return results;
}

async findDetailById(membershipId: string): Promise<MemberDetailResponse | null> {
  const row = await this.db
    .select({
      id: academyMemberships.id,
      userId: academyMemberships.userId,
      academyId: academyMemberships.academyId,
      role: academyMemberships.role,
      status: academyMemberships.status,
      joinedAt: academyMemberships.joinedAt,
      createdAt: academyMemberships.createdAt,
      userName: users.name,
      userEmail: users.email,
      userPhone: users.phone,
      userInstagram: users.instagram,
      userBirthDate: users.birthDate,
      userProfileImageUrl: users.profileImageUrl,
    })
    .from(academyMemberships)
    .innerJoin(users, eq(academyMemberships.userId, users.id))
    .where(eq(academyMemberships.id, membershipId))
    .then((rows) => rows[0] ?? null);

  if (!row) return null;

  const history = await this.db
    .select({
      id: academyMemberships.id,
      role: academyMemberships.role,
      status: academyMemberships.status,
      joinedAt: academyMemberships.joinedAt,
      leftAt: academyMemberships.leftAt,
      createdAt: academyMemberships.createdAt,
    })
    .from(academyMemberships)
    .where(
      and(
        eq(academyMemberships.userId, row.userId),
        eq(academyMemberships.academyId, row.academyId)
      )
    )
    .orderBy(desc(academyMemberships.createdAt));

  return {
    id: row.id,
    userId: row.userId,
    role: row.role,
    status: row.status,
    joinedAt: row.joinedAt,
    createdAt: row.createdAt,
    userName: row.userName,
    userEmail: row.userEmail,
    userPhone: row.phone ?? null,
    userInstagram: row.instagram ?? null,
    userBirthDate: row.birthDate ? row.birthDate.toISOString().split("T")[0] : null,
    userProfileImageUrl: row.userProfileImageUrl,
    history,
  };
}
```

Import `and`, `desc`, `users` at the top if not already imported.

- [x] **Step 5: Commit**

```bash
git add packages/validators/src/membership.schema.ts packages/validators/src/index.ts apps/api/src/modules/membership/membership.repository.ts apps/api/src/modules/membership/membership.repository.postgres.ts
git commit -m "feat(api): add list members and member detail repository methods"
```

---

## Task 2: Backend — Add membership service and routes for listing/detail ✅

**Files:**
- Modify: `apps/api/src/modules/membership/membership.service.ts`
- Modify: `apps/api/src/modules/membership/membership.routes.ts`

- [x] **Step 1: Add service methods**

In `apps/api/src/modules/membership/membership.service.ts`, add:

```typescript
async listMembers(
  academyId: string,
  managerUserId: string,
  filters: { role?: string; status?: string; q?: string }
) {
  await this.assertManagerOwnsAcademy(academyId, managerUserId);
  return this.membershipRepo.findByAcademy(academyId, filters);
}

async getMemberDetail(membershipId: string, managerUserId: string) {
  const detail = await this.membershipRepo.findDetailById(membershipId);
  if (!detail) {
    throw new AppError(404, "Membership not found");
  }
  // Look up the academyId from the membership to verify ownership
  const membership = await this.membershipRepo.findById(membershipId);
  if (!membership) {
    throw new AppError(404, "Membership not found");
  }
  await this.assertManagerOwnsAcademy(membership.academyId, managerUserId);
  return detail;
}
```

- [x] **Step 2: Add routes**

In `apps/api/src/modules/membership/membership.routes.ts`, add BEFORE the existing `POST /requests` route:

```typescript
// GET /memberships?academyId=...&role=...&status=...&q=...
membershipRouter.get(
  "/",
  authorize("manager"),
  async (req, res, next) => {
    try {
      const { academyId, role, status, q } = listMembersQuerySchema
        .extend({ academyId: z.string().uuid() })
        .parse(req.query);
      const members = await membershipService.listMembers(
        academyId,
        req.session!.userId,
        { role, status, q }
      );
      res.json(members);
    } catch (err) {
      next(err);
    }
  }
);

// GET /memberships/:membershipId
membershipRouter.get(
  "/:membershipId",
  authorize("manager"),
  async (req, res, next) => {
    try {
      const { membershipId } = membershipIdParamSchema.parse(req.params);
      const detail = await membershipService.getMemberDetail(
        membershipId,
        req.session!.userId
      );
      res.json(detail);
    } catch (err) {
      next(err);
    }
  }
);
```

Add imports at the top:

```typescript
import { listMembersQuerySchema } from "@tatame/validators";
```

- [x] **Step 3: Verify API compiles**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
pnpm --filter @tatame/api build
```

Expected: No errors.

- [x] **Step 4: Commit**

```bash
git add apps/api/src/modules/membership/
git commit -m "feat(api): add GET /memberships and GET /memberships/:id endpoints"
```

---

## Task 3: Backend — Extend `/me` with `activeMembership` for non-managers ✅

**Files:**
- Modify: `packages/validators/src/user.schema.ts`
- Modify: `packages/validators/src/index.ts`
- Modify: `apps/api/src/modules/user/user.service.ts`
- Modify: `apps/api/src/modules/user/user.routes.ts`

- [x] **Step 1: Add `activeMembershipSchema` to user validators**

In `packages/validators/src/user.schema.ts`, add:

```typescript
export const activeMembershipSchema = z.object({
  id: z.string().uuid(),
  academyId: z.string().uuid(),
  academyName: z.string(),
  academyLogoUrl: z.string().nullable(),
  role: roleEnumSchema,
  status: z.enum(["pending", "active", "blocked"]),
});

export type ActiveMembership = z.infer<typeof activeMembershipSchema>;
```

Add `activeMembership` to `userMeResponseSchema`:

```typescript
export const userMeResponseSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string(),
  email: z.string().email(),
  name: z.string(),
  profileImageUrl: z.string().nullable(),
  activeRole: roleEnumSchema.nullable(),
  activeAcademy: activeAcademySchema.nullable(),
  activeMembership: activeMembershipSchema.nullable(),
});
```

- [x] **Step 2: Export new type from validators index**

In `packages/validators/src/index.ts`, add `ActiveMembership` and `activeMembershipSchema` to the user exports.

- [x] **Step 3: Add service method to fetch active membership with academy info**

In `apps/api/src/modules/user/user.service.ts`, add a method:

```typescript
async getActiveMembershipWithAcademy(userId: string) {
  // Get from membership repo — the active or pending membership for this user
  const membership = await this.membershipRepo.findActiveByUser(userId);
  if (!membership) {
    // Also check for pending
    return this.membershipRepo.findPendingForUser(userId);
  }
  return membership;
}
```

Alternatively, if the membership repo doesn't have `findPendingForUser`, add a new repo method. The simplest approach: query `academyMemberships` joined with `academies` where `userId` matches and `status IN ('pending', 'active')` ordered by `createdAt DESC` limit 1.

Add to the membership repository interface:

```typescript
findActiveOrPendingByUser(userId: string): Promise<{
  id: string;
  academyId: string;
  academyName: string;
  academyLogoUrl: string | null;
  role: string;
  status: string;
} | null>;
```

And implement in postgres:

```typescript
async findActiveOrPendingByUser(userId: string) {
  const row = await this.db
    .select({
      id: academyMemberships.id,
      academyId: academyMemberships.academyId,
      academyName: academies.name,
      academyLogoUrl: academies.logoUrl,
      role: academyMemberships.role,
      status: academyMemberships.status,
    })
    .from(academyMemberships)
    .innerJoin(academies, eq(academyMemberships.academyId, academies.id))
    .where(
      and(
        eq(academyMemberships.userId, userId),
        inArray(academyMemberships.status, ["pending", "active"])
      )
    )
    .orderBy(desc(academyMemberships.createdAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  return row;
}
```

- [x] **Step 4: Update `/me` route to include `activeMembership`**

In `apps/api/src/modules/user/user.routes.ts`, update the `/me` handler. After the existing `activeAcademy` logic, add:

```typescript
let activeMembership = null;
if (activeRole && activeRole !== "manager") {
  const membership = await membershipRepo.findActiveOrPendingByUser(row.id);
  if (membership) {
    activeMembership = {
      id: membership.id,
      academyId: membership.academyId,
      academyName: membership.academyName,
      academyLogoUrl: membership.academyLogoUrl,
      role: membership.role,
      status: membership.status,
    };
  }
}
```

Include `activeMembership` in the response object.

- [x] **Step 5: Verify API compiles**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
pnpm --filter @tatame/api build
```

- [x] **Step 6: Commit**

```bash
git add packages/validators/src/ apps/api/src/modules/user/ apps/api/src/modules/membership/
git commit -m "feat(api): extend /me with activeMembership for instructor/student"
```

---

## Task 4: Mobile — Membership hooks ✅

**Files:**
- Create: `apps/mobile/lib/hooks/use-membership.ts`

- [x] **Step 1: Create the membership hooks file**

```typescript
import { useApi } from "@/lib/api";
import type {
  MemberListItem,
  MemberDetailResponse,
  PendingMembershipItem,
  MembershipResponse,
} from "@tatame/validators";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export function useMembers(
  academyId: string,
  filters?: { role?: string; status?: string; q?: string }
) {
  const api = useApi();
  const params = new URLSearchParams({ academyId });
  if (filters?.role) params.set("role", filters.role);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.q) params.set("q", filters.q);

  return useQuery({
    queryKey: ["members", academyId, filters],
    queryFn: () =>
      api.get<MemberListItem[]>(`/memberships?${params.toString()}`),
  });
}

export function useMemberDetail(membershipId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: ["member-detail", membershipId],
    queryFn: () =>
      api.get<MemberDetailResponse>(`/memberships/${membershipId}`),
    enabled: !!membershipId,
  });
}

export function usePendingRequests(academyId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["pending-requests", academyId],
    queryFn: () =>
      api.get<PendingMembershipItem[]>(
        `/memberships/pending?academyId=${academyId}`
      ),
  });
}

export function useRequestMembership() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (academyId: string) =>
      api.post<MembershipResponse>("/memberships/requests", { academyId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useApproveMembership() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) =>
      api.patch<void>(`/memberships/${membershipId}/approve`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      void queryClient.invalidateQueries({ queryKey: ["academy-stats"] });
    },
  });
}

export function useRejectMembership() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) =>
      api.patch<void>(`/memberships/${membershipId}/reject`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      void queryClient.invalidateQueries({ queryKey: ["academy-stats"] });
    },
  });
}

export function useBlockMembership() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) =>
      api.patch<void>(`/memberships/${membershipId}/block`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      void queryClient.invalidateQueries({ queryKey: ["member-detail"] });
    },
  });
}

export function useCancelMembership() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/memberships/leave"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useSearchAcademies(query: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["academies-search", query],
    queryFn: () =>
      api.get<
        { id: string; name: string; logoUrl: string | null; address: string | null }[]
      >(`/academies?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/lib/hooks/use-membership.ts
git commit -m "feat(mobile): add membership query and mutation hooks"
```

---

## Task 5: Mobile — Shared UI components (Badge, FilterTabs, MemberCard, PendingRequestCard, AcademySearchCard) ✅

**Files:**
- Create: `apps/mobile/components/Badge.tsx`
- Create: `apps/mobile/components/FilterTabs.tsx`
- Create: `apps/mobile/components/MemberCard.tsx`
- Create: `apps/mobile/components/PendingRequestCard.tsx`
- Create: `apps/mobile/components/AcademySearchCard.tsx`

- [x] **Step 1: Create Badge component**

Based on the design, badges are small rounded pills with colored text/background for roles (Instrutor, Aluno) and statuses (Ativo, Pendente, Bloqueado).

```typescript
// apps/mobile/components/Badge.tsx
import { Text, View } from "react-native";

type BadgeVariant = "role" | "status";

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  instructor: { bg: "#2A2A2A", text: "#A078E8" },
  student: { bg: "#2A2A2A", text: "#8A8A8A" },
  manager: { bg: "#2A2A2A", text: "#A078E8" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "#1A3A1A", text: "#4ADE80" },
  pending: { bg: "#3A3A1A", text: "#FFD60A" },
  blocked: { bg: "#3A1A1A", text: "#F87171" },
  rejected: { bg: "#3A1A1A", text: "#F87171" },
};

const ROLE_LABELS: Record<string, string> = {
  instructor: "Instrutor",
  student: "Aluno",
  manager: "Gestor",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  pending: "Pendente",
  blocked: "Bloqueado",
  rejected: "Rejeitado",
};

type BadgeProps = {
  variant: BadgeVariant;
  value: string;
};

export function Badge({ variant, value }: BadgeProps) {
  const colors =
    variant === "role"
      ? ROLE_COLORS[value] ?? ROLE_COLORS.student!
      : STATUS_COLORS[value] ?? STATUS_COLORS.active!;
  const label =
    variant === "role"
      ? ROLE_LABELS[value] ?? value
      : STATUS_LABELS[value] ?? value;

  return (
    <View
      className="rounded-full px-2.5 py-0.5"
      style={{ backgroundColor: colors.bg }}
    >
      <Text
        className="font-poppins-medium text-[10px]"
        style={{ color: colors.text }}
      >
        {label}
      </Text>
    </View>
  );
}
```

- [x] **Step 2: Create FilterTabs component**

```typescript
// apps/mobile/components/FilterTabs.tsx
import { Pressable, ScrollView, Text } from "react-native";

type FilterTab = {
  key: string;
  label: string;
};

type FilterTabsProps = {
  tabs: FilterTab[];
  activeKey: string;
  onSelect: (key: string) => void;
};

export function FilterTabs({ tabs, activeKey, onSelect }: FilterTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            className="rounded-full border px-4 py-1.5"
            style={{
              backgroundColor: isActive ? "#A078E8" : "transparent",
              borderColor: isActive ? "#A078E8" : "#3A3A3A",
            }}
          >
            <Text
              className="font-poppins-medium text-xs"
              style={{ color: isActive ? "#FFFFFF" : "#8A8A8A" }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
```

- [x] **Step 3: Create MemberCard component**

```typescript
// apps/mobile/components/MemberCard.tsx
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Pressable, Text, View } from "react-native";

type MemberCardProps = {
  name: string;
  role: string;
  status: string;
  profileImageUrl: string | null;
  onPress: () => void;
};

export function MemberCard({
  name,
  role,
  status,
  profileImageUrl,
  onPress,
}: MemberCardProps) {
  const letter = (name || "?").charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-surface-border bg-surface px-4 py-3"
    >
      <Avatar variant="user" imageUrl={profileImageUrl} fallbackLetter={letter} />
      <View className="min-w-0 flex-1" style={{ gap: 4 }}>
        <Text className="font-poppins-semibold text-sm text-primary">
          {name}
        </Text>
        <View className="flex-row gap-1.5">
          <Badge variant="role" value={role} />
          <Badge variant="status" value={status} />
        </View>
      </View>
    </Pressable>
  );
}
```

- [x] **Step 4: Create PendingRequestCard component**

```typescript
// apps/mobile/components/PendingRequestCard.tsx
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Pressable, Text, View } from "react-native";
import { X, Check } from "lucide-react-native";

type PendingRequestCardProps = {
  name: string;
  role: string;
  createdAt: string;
  profileImageUrl?: string | null;
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "há poucos minutos";
  if (hours < 24) return `há ${hours} hora${hours > 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}

export function PendingRequestCard({
  name,
  role,
  createdAt,
  profileImageUrl,
  onApprove,
  onReject,
  isLoading,
}: PendingRequestCardProps) {
  const letter = (name || "?").charAt(0).toUpperCase();

  return (
    <View
      className="rounded-2xl border border-surface-border bg-surface"
      style={{ padding: 16, gap: 14 }}
    >
      <View className="flex-row items-center gap-3">
        <Avatar variant="user" imageUrl={profileImageUrl} fallbackLetter={letter} />
        <View className="min-w-0 flex-1" style={{ gap: 4 }}>
          <Text className="font-poppins-semibold text-base text-primary">
            {name}
          </Text>
          <View className="flex-row items-center gap-2">
            <Badge variant="role" value={role} />
            <Text className="font-poppins text-xs" style={{ color: "#525252" }}>
              {timeAgo(createdAt)}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row gap-3">
        <Pressable
          onPress={onReject}
          disabled={isLoading}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-red-500/30 py-2.5"
          style={{ backgroundColor: "#3A1A1A" }}
        >
          <X size={14} color="#F87171" />
          <Text className="font-poppins-semibold text-sm" style={{ color: "#F87171" }}>
            Rejeitar
          </Text>
        </Pressable>
        <Pressable
          onPress={onApprove}
          disabled={isLoading}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5"
        >
          <Check size={14} color="#FFFFFF" />
          <Text className="font-poppins-semibold text-sm text-white">
            Aprovar
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

- [x] **Step 5: Create AcademySearchCard component**

```typescript
// apps/mobile/components/AcademySearchCard.tsx
import { Avatar } from "@/components/Avatar";
import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

type AcademySearchCardProps = {
  name: string;
  address: string | null;
  logoUrl: string | null;
  onPress: () => void;
};

export function AcademySearchCard({
  name,
  address,
  logoUrl,
  onPress,
}: AcademySearchCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-surface-border bg-surface px-4 py-3"
    >
      <Avatar variant="brand" imageUrl={logoUrl} />
      <View className="min-w-0 flex-1" style={{ gap: 2 }}>
        <Text className="font-poppins-semibold text-sm text-primary">
          {name}
        </Text>
        {address && (
          <Text
            className="font-poppins text-xs"
            style={{ color: "#8A8A8A" }}
            numberOfLines={1}
          >
            {address}
          </Text>
        )}
      </View>
      <ChevronRight size={18} color="#525252" />
    </Pressable>
  );
}
```

- [x] **Step 6: Commit**

```bash
git add apps/mobile/components/Badge.tsx apps/mobile/components/FilterTabs.tsx apps/mobile/components/MemberCard.tsx apps/mobile/components/PendingRequestCard.tsx apps/mobile/components/AcademySearchCard.tsx
git commit -m "feat(mobile): add shared UI components for membership flow"
```

---

## Task 6: Mobile — M-MGR-04 Members List screen ✅

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/(members)/index.tsx`

- [x] **Step 1: Replace placeholder with member list screen**

```typescript
// apps/mobile/app/(app)/(manager)/(members)/index.tsx
import { FilterTabs } from "@/components/FilterTabs";
import { MemberCard } from "@/components/MemberCard";
import { useAcademyContext } from "@/lib/academy-context";
import { useMembers } from "@/lib/hooks/use-membership";
import { useRouter } from "expo-router";
import { ArrowLeft, Search } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TABS = [
  { key: "all", label: "Todos" },
  { key: "instructor", label: "Instrutores" },
  { key: "student", label: "Alunos" },
  { key: "pending", label: "Pendentes" },
];

export default function MembersListScreen() {
  const router = useRouter();
  const { academyId } = useAcademyContext();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filters: { role?: string; status?: string; q?: string } = {};
  if (activeTab === "instructor") filters.role = "instructor";
  else if (activeTab === "student") filters.role = "student";
  else if (activeTab === "pending") filters.status = "pending";
  if (searchQuery.length >= 2) filters.q = searchQuery;

  const { data: members, isPending } = useMembers(academyId, filters);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View style={{ paddingHorizontal: 24, gap: 16, flex: 1 }}>
        {/* Nav Row */}
        <View className="flex-row items-center justify-between" style={{ paddingTop: 8 }}>
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </Pressable>
          <Text className="font-sora-bold text-lg text-primary">Membros</Text>
          <View className="h-10 w-10" />
        </View>

        {/* Search */}
        <View className="flex-row items-center gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2.5">
          <Search size={18} color="#525252" />
          <TextInput
            className="min-w-0 flex-1 font-poppins text-sm text-primary"
            placeholder="Buscar membro..."
            placeholderTextColor="#525252"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>

        {/* Filter Tabs */}
        <FilterTabs tabs={TABS} activeKey={activeTab} onSelect={setActiveTab} />

        {/* Member List */}
        {isPending ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#A078E8" />
          </View>
        ) : (
          <FlatList
            data={members ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <MemberCard
                name={item.userName}
                role={item.role}
                status={item.status}
                profileImageUrl={item.userProfileImageUrl}
                onPress={() =>
                  router.push(`/(app)/(manager)/(members)/${item.id}`)
                }
              />
            )}
            ListEmptyComponent={
              <View className="items-center py-12">
                <Text className="font-poppins text-sm" style={{ color: "#525252" }}>
                  Nenhum membro encontrado
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(members)/index.tsx
git commit -m "feat(mobile): implement M-MGR-04 members list screen"
```

---

## Task 7: Mobile — M-MGR-05 Member Detail screen ✅

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(members)/[membershipId].tsx`

- [x] **Step 1: Create the member detail screen**

```typescript
// apps/mobile/app/(app)/(manager)/(members)/[membershipId].tsx
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import {
  useBlockMembership,
  useMemberDetail,
} from "@/lib/hooks/use-membership";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  AtSign,
  Mail,
  Phone,
} from "lucide-react-native";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

export default function MemberDetailScreen() {
  const { membershipId } = useLocalSearchParams<{ membershipId: string }>();
  const router = useRouter();
  const { data: member, isPending } = useMemberDetail(membershipId);
  const blockMutation = useBlockMembership();

  const handleBlock = () => {
    if (!membershipId) return;
    Alert.alert(
      "Bloquear membro",
      `Deseja realmente bloquear ${member?.userName ?? "este membro"}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Bloquear",
          style: "destructive",
          onPress: () => {
            blockMutation.mutate(membershipId, {
              onSuccess: () => router.back(),
            });
          },
        },
      ]
    );
  };

  if (isPending || !member) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
          Carregando...
        </Text>
      </SafeAreaView>
    );
  }

  const letter = (member.userName || "?").charAt(0).toUpperCase();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Nav Row */}
        <View
          className="flex-row items-center justify-between"
          style={{ paddingTop: 8 }}
        >
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </Pressable>
          <Text className="font-sora-bold text-lg text-primary">Detalhes</Text>
          <View className="h-10 w-10" />
        </View>

        {/* Profile Header */}
        <View className="items-center" style={{ gap: 12 }}>
          <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-accent">
            <Avatar
              variant="user"
              imageUrl={member.userProfileImageUrl}
              fallbackLetter={letter}
            />
          </View>
          <Text className="font-sora-bold text-xl text-primary">
            {member.userName}
          </Text>
          <View className="flex-row gap-2">
            <Badge variant="role" value={member.role} />
            <Badge variant="status" value={member.status} />
          </View>
        </View>

        {/* Contact Info */}
        <View
          className="rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 16, gap: 14 }}
        >
          <View className="flex-row items-center gap-3">
            <Mail size={16} color={TEXT_MUTED} />
            <Text className="font-poppins text-sm text-primary">
              {member.userEmail}
            </Text>
          </View>
          {member.userPhone && (
            <View className="flex-row items-center gap-3">
              <Phone size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {member.userPhone}
              </Text>
            </View>
          )}
          {member.userInstagram && (
            <View className="flex-row items-center gap-3">
              <AtSign size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {member.userInstagram}
              </Text>
            </View>
          )}
          {member.userBirthDate && (
            <View className="flex-row items-center gap-3">
              <Calendar size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {member.userBirthDate}
              </Text>
            </View>
          )}
        </View>

        {/* Association History */}
        <View style={{ gap: 12 }}>
          <Text
            className="font-poppins-semibold text-sm"
            style={{ color: TEXT_SECONDARY }}
          >
            Histórico de associação
          </Text>
          <View style={{ gap: 10 }}>
            {member.history.map((entry, i) => {
              const isCurrent = i === 0 && entry.status === "active";
              return (
                <View
                  key={entry.id}
                  className="rounded-xl border bg-surface"
                  style={{
                    borderColor: isCurrent ? "#3A3A3A" : "#2A2A2A",
                    padding: 14,
                    gap: 4,
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="font-poppins text-xs"
                      style={{ color: TEXT_SECONDARY }}
                    >
                      {isCurrent ? "Membro desde" : "Associação anterior"}
                    </Text>
                    <Badge
                      variant="status"
                      value={isCurrent ? "active" : entry.status === "active" ? "active" : entry.status}
                    />
                  </View>
                  <Text className="font-poppins-semibold text-sm text-primary">
                    {isCurrent
                      ? formatDate(entry.joinedAt?.toString() ?? entry.createdAt.toString())
                      : `${formatDateShort(entry.joinedAt?.toString() ?? entry.createdAt.toString())} — ${formatDateShort(entry.leftAt?.toString())}`}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Block Button */}
        {member.status === "active" && member.role !== "manager" && (
          <Pressable
            onPress={handleBlock}
            disabled={blockMutation.isPending}
            className="flex-row items-center justify-center gap-2 rounded-xl border border-red-500/30 py-3.5"
            style={{ backgroundColor: "#1A0A0A" }}
          >
            <AlertTriangle size={16} color="#F87171" />
            <Text
              className="font-poppins-semibold text-sm"
              style={{ color: "#F87171" }}
            >
              Bloquear membro
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(members)/[membershipId].tsx
git commit -m "feat(mobile): implement M-MGR-05 member detail screen"
```

---

## Task 8: Mobile — M-MGR-06 Pending Requests screen

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(members)/pending.tsx`

- [ ] **Step 1: Create pending requests screen**

```typescript
// apps/mobile/app/(app)/(manager)/(members)/pending.tsx
import { PendingRequestCard } from "@/components/PendingRequestCard";
import { useAcademyContext } from "@/lib/academy-context";
import {
  useApproveMembership,
  usePendingRequests,
  useRejectMembership,
} from "@/lib/hooks/use-membership";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PendingRequestsScreen() {
  const router = useRouter();
  const { academyId } = useAcademyContext();
  const { data: pending, isPending } = usePendingRequests(academyId);
  const approveMutation = useApproveMembership();
  const rejectMutation = useRejectMembership();

  const count = pending?.length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View style={{ paddingHorizontal: 24, gap: 16, flex: 1 }}>
        {/* Nav Row */}
        <View
          className="flex-row items-center justify-between"
          style={{ paddingTop: 8 }}
        >
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </Pressable>
          <Text className="font-sora-bold text-lg text-primary">
            Solicitações pendentes
          </Text>
          <View className="h-10 w-10" />
        </View>

        <Text className="font-poppins text-sm" style={{ color: "#8A8A8A" }}>
          {count} solicitaç{count === 1 ? "ão" : "ões"} pendente{count !== 1 ? "s" : ""}
        </Text>

        {isPending ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#A078E8" />
          </View>
        ) : (
          <FlatList
            data={pending ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <PendingRequestCard
                name={item.userName}
                role={item.role}
                createdAt={item.createdAt.toString()}
                onApprove={() => approveMutation.mutate(item.id)}
                onReject={() => rejectMutation.mutate(item.id)}
                isLoading={
                  approveMutation.isPending || rejectMutation.isPending
                }
              />
            )}
            ListEmptyComponent={
              <View className="items-center py-12">
                <Text
                  className="font-poppins text-sm"
                  style={{ color: "#525252" }}
                >
                  Nenhuma solicitação pendente
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Update dashboard quick action to link to pending screen**

In `apps/mobile/app/(app)/(manager)/(home)/index.tsx`, the "Solicitações pendentes" quick action currently links to `/(app)/(manager)/(members)`. Update to:

```typescript
onPress={() => router.push("/(app)/(manager)/(members)/pending")}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(members)/pending.tsx apps/mobile/app/(app)/(manager)/(home)/index.tsx
git commit -m "feat(mobile): implement M-MGR-06 pending requests screen"
```

---

## Task 9: Mobile — Joining flow layout and Search Academy screen

**Files:**
- Create: `apps/mobile/app/(app)/(joining)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(joining)/search-academy.tsx`

- [ ] **Step 1: Create joining flow layout**

```typescript
// apps/mobile/app/(app)/(joining)/_layout.tsx
import { Stack } from "expo-router";

export default function JoiningLayout() {
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

- [ ] **Step 2: Create search academy screen**

```typescript
// apps/mobile/app/(app)/(joining)/search-academy.tsx
import { AcademySearchCard } from "@/components/AcademySearchCard";
import { useSearchAcademies } from "@/lib/hooks/use-membership";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ROLE_COPY: Record<string, { title: string; subtitle: string }> = {
  instructor: {
    title: "Buscar academia",
    subtitle: "Encontre uma academia para enviar sua solicitação de entrada",
  },
  student: {
    title: "Buscar academia",
    subtitle: "Encontre uma academia para solicitar sua entrada como aluno",
  },
};

export default function SearchAcademyScreen() {
  const { data: user } = useCurrentUser();
  const role = user?.activeRole ?? "student";
  const copy = ROLE_COPY[role] ?? ROLE_COPY.student!;

  const [query, setQuery] = useState("");
  const { data: results, isPending, isFetching } = useSearchAcademies(query);
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View style={{ paddingHorizontal: 24, gap: 20, flex: 1, paddingTop: 16 }}>
        <View style={{ gap: 8 }}>
          <Text className="font-sora-bold text-2xl text-primary">
            {copy.title}
          </Text>
          <Text className="font-poppins text-sm" style={{ color: "#8A8A8A" }}>
            {copy.subtitle}
          </Text>
        </View>

        {/* Search Input */}
        <View className="flex-row items-center gap-2 rounded-xl border border-surface-border bg-surface px-3 py-2.5">
          <Search size={18} color="#525252" />
          <TextInput
            className="min-w-0 flex-1 font-poppins text-sm text-primary"
            placeholder="Buscar por nome da academia..."
            placeholderTextColor="#525252"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
        </View>

        {query.length >= 2 && (
          <>
            <Text className="font-poppins-semibold text-sm" style={{ color: "#8A8A8A" }}>
              Resultados
            </Text>

            {isPending || isFetching ? (
              <View className="items-center py-8">
                <ActivityIndicator color="#A078E8" />
              </View>
            ) : (
              <FlatList
                data={results ?? []}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <AcademySearchCard
                    name={item.name}
                    address={item.address}
                    logoUrl={item.logoUrl}
                    onPress={() =>
                      router.push(`/(app)/(joining)/academy/${item.id}`)
                    }
                  />
                )}
                ListEmptyComponent={
                  <View className="items-center py-8">
                    <Text
                      className="font-poppins text-sm"
                      style={{ color: "#525252" }}
                    >
                      Nenhuma academia encontrada
                    </Text>
                  </View>
                }
              />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/(joining)/
git commit -m "feat(mobile): add joining flow layout and search academy screen"
```

---

## Task 10: Mobile — Academy Detail and Pending Approval screens

**Files:**
- Create: `apps/mobile/app/(app)/(joining)/academy/[academyId].tsx`
- Create: `apps/mobile/app/(app)/(joining)/pending-approval.tsx`

- [ ] **Step 1: Create academy detail screen**

```typescript
// apps/mobile/app/(app)/(joining)/academy/[academyId].tsx
import { Avatar } from "@/components/Avatar";
import { useAcademy } from "@/lib/hooks/use-academy";
import { useRequestMembership } from "@/lib/hooks/use-membership";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react-native";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";

export default function AcademyDetailScreen() {
  const { academyId } = useLocalSearchParams<{ academyId: string }>();
  const router = useRouter();
  const { data: academy, isPending } = useAcademy(academyId!);
  const requestMembership = useRequestMembership();

  const handleRequest = () => {
    if (!academyId) return;
    requestMembership.mutate(academyId, {
      onSuccess: () => {
        router.replace("/(app)/(joining)/pending-approval");
      },
      onError: (err) => {
        Alert.alert("Erro", err.message ?? "Não foi possível enviar a solicitação");
      },
    });
  };

  if (isPending || !academy) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, gap: 24 }}>
        {/* Nav Row */}
        <View
          className="flex-row items-center justify-between"
          style={{ paddingTop: 8 }}
        >
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </Pressable>
          <Text className="font-sora-bold text-lg text-primary">
            Detalhes da academia
          </Text>
          <View className="h-10 w-10" />
        </View>

        {/* Academy Header */}
        <View className="items-center" style={{ gap: 12 }}>
          <View className="h-20 w-20">
            <Avatar variant="brand" imageUrl={academy.logoUrl} />
          </View>
          <Text className="font-sora-bold text-xl text-primary">
            {academy.name}
          </Text>
          {academy.address && (
            <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
              {academy.address}
            </Text>
          )}
        </View>

        {/* Contact Info */}
        <View
          className="rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 16, gap: 14 }}
        >
          {academy.address && (
            <View className="flex-row items-center gap-3">
              <MapPin size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {academy.address}
              </Text>
            </View>
          )}
          {academy.contactEmail && (
            <View className="flex-row items-center gap-3">
              <Mail size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {academy.contactEmail}
              </Text>
            </View>
          )}
          {academy.contactPhone && (
            <View className="flex-row items-center gap-3">
              <Phone size={16} color={TEXT_MUTED} />
              <Text className="font-poppins text-sm text-primary">
                {academy.contactPhone}
              </Text>
            </View>
          )}
        </View>

        {/* Spacer */}
        <View className="flex-1" />

        {/* Request Button */}
        <Pressable
          onPress={handleRequest}
          disabled={requestMembership.isPending}
          className="items-center rounded-xl bg-accent py-4"
          style={{ marginBottom: 32 }}
        >
          {requestMembership.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="font-poppins-semibold text-base text-white">
              Solicitar entrada
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Create pending approval screen**

```typescript
// apps/mobile/app/(app)/(joining)/pending-approval.tsx
import { useCancelMembership } from "@/lib/hooks/use-membership";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useRouter } from "expo-router";
import { Clock } from "lucide-react-native";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PendingApprovalScreen() {
  const { data: user } = useCurrentUser();
  const router = useRouter();
  const cancelMutation = useCancelMembership();

  const academyName = user?.activeMembership?.academyName ?? "a academia";
  const isStudent = user?.activeRole === "student";

  const handleCancel = () => {
    Alert.alert(
      "Cancelar solicitação",
      "Deseja realmente cancelar sua solicitação de entrada?",
      [
        { text: "Não", style: "cancel" },
        {
          text: "Sim, cancelar",
          style: "destructive",
          onPress: () => {
            cancelMutation.mutate(undefined, {
              onSuccess: () => {
                router.replace("/(app)/(joining)/search-academy");
              },
            });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View
        className="flex-1 items-center justify-center"
        style={{ paddingHorizontal: 32, gap: 20 }}
      >
        <View className="h-16 w-16 items-center justify-center rounded-full bg-accent">
          <Clock size={28} color="#FFFFFF" />
        </View>

        <Text className="font-sora-bold text-center text-2xl text-primary">
          Aguardando aprovação
        </Text>

        <Text
          className="font-poppins text-center text-sm"
          style={{ color: "#8A8A8A", lineHeight: 22 }}
        >
          Sua solicitação para entrar na {academyName} foi enviada. O gestor da
          academia irá avaliar seu pedido
          {isStudent ? " para liberar seu acesso como aluno" : ""}.
        </Text>

        <View className="flex-row items-center gap-2 rounded-full px-4 py-1.5" style={{ backgroundColor: "#3A3A1A" }}>
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: "#FFD60A" }} />
          <Text className="font-poppins-medium text-xs" style={{ color: "#FFD60A" }}>
            Pendente
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <Pressable
          onPress={handleCancel}
          disabled={cancelMutation.isPending}
          className="items-center rounded-xl border border-red-500/30 py-3.5"
          style={{ backgroundColor: "#1A0A0A" }}
        >
          <Text
            className="font-poppins-semibold text-sm"
            style={{ color: "#F87171" }}
          >
            Cancelar solicitação
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/(joining)/
git commit -m "feat(mobile): add academy detail and pending approval screens"
```

---

## Task 11: Mobile — Update app layout for instructor/student routing

**Files:**
- Modify: `apps/mobile/app/(app)/_layout.tsx`

- [ ] **Step 1: Update the AppRouter component to handle instructor/student flows**

In `apps/mobile/app/(app)/_layout.tsx`, update the `useEffect` block in `AppRouter`:

```typescript
useEffect(() => {
  if (isPending || !user) return;

  if (user.activeRole === "manager" && !user.activeAcademy) {
    router.replace("/(app)/create-academy");
  } else if (user.activeRole === "manager" && user.activeAcademy) {
    router.replace("/(app)/(manager)/(home)");
  } else if (
    user.activeRole === "instructor" ||
    user.activeRole === "student"
  ) {
    if (!user.activeMembership) {
      // No membership yet — search for an academy
      router.replace("/(app)/(joining)/search-academy");
    } else if (user.activeMembership.status === "pending") {
      // Waiting for manager approval
      router.replace("/(app)/(joining)/pending-approval");
    } else if (user.activeMembership.status === "active") {
      // Active membership — for now, show search (future: role-specific home)
      // TODO: Replace with instructor/student home when implemented
      router.replace("/(app)/(joining)/pending-approval");
    }
  }
}, [isPending, user, router]);
```

**Note:** The last `else if` for `status === "active"` is a temporary placeholder. When instructor/student home screens are built, replace this with the proper redirect (e.g. `/(app)/(instructor)/(home)` or `/(app)/(student)/(home)`).

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/_layout.tsx
git commit -m "feat(mobile): add instructor/student routing in app layout"
```

---

## Task 12: Verify full flow end-to-end

- [ ] **Step 1: Verify API compiles**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
pnpm --filter @tatame/api build
```

Expected: No errors.

- [ ] **Step 2: Verify validators compile**

```bash
pnpm --filter @tatame/validators build
```

Expected: No errors.

- [ ] **Step 3: Verify mobile TypeScript**

```bash
pnpm --filter @tatame/mobile exec tsc --noEmit
```

Expected: No errors (or only pre-existing warnings).

- [ ] **Step 4: Test the flow manually**

1. **As instructor/student:** Open app → should redirect to search academy → search → tap academy → view details → tap "Solicitar entrada" → should show waiting screen
2. **As manager:** Open app → go to Members tab → should see member list → tap "Pendentes" filter → see pending requests → go to Pending screen → approve/reject → verify member list updates

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during e2e verification"
```
