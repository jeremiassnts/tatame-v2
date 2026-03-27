# Profile Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user profile screen accessible from all roles, with editable fields, logout, and soft-delete account functionality.

**Architecture:** Backend-first approach — add the DB column and API endpoints first, then build the mobile screen on top. The profile screen lives at `(app)/profile.tsx` outside role groups so all roles share it. The save button calls `PATCH /users/me`, logout uses Clerk's `signOut()`, and delete calls `DELETE /users/me` which soft-deletes in DB + hard-deletes in Clerk.

**Tech Stack:** Drizzle ORM, Express, Zod, Clerk Backend SDK, React Native, Expo Router, React Hook Form, TanStack Query

---

### Task 1: Add `deletedAt` column to users table

**Files:**
- Modify: `packages/db/src/schema/index.ts:49-65`

- [x] **Step 1: Add the `deletedAt` column to the schema**

In `packages/db/src/schema/index.ts`, add `deletedAt` to the `users` table definition, after `updatedAt`:

```typescript
deletedAt: timestamp("deleted_at", { withTimezone: true }),
```

- [x] **Step 2: Generate the Drizzle migration**

Run:
```bash
cd packages/db && npx drizzle-kit generate
```

Expected: A new migration file is created in `packages/db/drizzle/` with an `ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone` statement.

- [x] **Step 3: Commit**

```bash
git add packages/db/src/schema/index.ts packages/db/drizzle/
git commit -m "feat(db): add deletedAt column to users table"
```

---

### Task 2: Add update profile Zod schema and expand `userMeResponseSchema`

**Files:**
- Modify: `packages/validators/src/user.schema.ts`

- [x] **Step 1: Add the `updateProfileBodySchema` and expand response**

Add to `packages/validators/src/user.schema.ts`:

```typescript
export const updateProfileBodySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).nullable().optional(),
  instagram: z
    .string()
    .max(30)
    .transform((v) => v.replace(/^@/, ""))
    .nullable()
    .optional(),
  birthDate: z.string().date().nullable().optional(),
});

export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
```

And add the three new fields to `userMeResponseSchema`:

```typescript
export const userMeResponseSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string(),
  email: z.string().email(),
  name: z.string(),
  profileImageUrl: z.string().nullable(),
  phone: z.string().nullable(),
  instagram: z.string().nullable(),
  birthDate: z.string().nullable(),
  /** Null until a role is assigned via POST /users/me/sync. */
  activeRole: roleEnumSchema.nullable(),
  /** Non-null for managers who own an academy. */
  activeAcademy: activeAcademySchema.nullable(),
  /** Non-null for instructors/students with a pending or active membership. */
  activeMembership: activeMembershipSchema.nullable(),
});
```

- [x] **Step 2: Commit**

```bash
git add packages/validators/src/user.schema.ts
git commit -m "feat(validators): add updateProfileBodySchema and expand userMeResponse"
```

---

### Task 3: Add `update` and `softDelete` to user repository

**Files:**
- Modify: `apps/api/src/modules/user/user.repository.ts`
- Modify: `apps/api/src/modules/user/user.repository.postgres.ts`
- Modify: `apps/api/src/modules/user/user.repository.in-memory.ts`

- [ ] **Step 1: Add methods to the interface**

In `apps/api/src/modules/user/user.repository.ts`, add to `IUserRepository`:

```typescript
update(
  id: string,
  data: {
    name?: string;
    phone?: string | null;
    instagram?: string | null;
    birthDate?: string | null;
  },
): Promise<UserRow | undefined>;

softDelete(id: string): Promise<void>;
```

- [ ] **Step 2: Implement in Postgres repository**

In `apps/api/src/modules/user/user.repository.postgres.ts`, add:

```typescript
async update(
  id: string,
  data: {
    name?: string;
    phone?: string | null;
    instagram?: string | null;
    birthDate?: string | null;
  },
): Promise<UserRow | undefined> {
  const [row] = await this.db
    .update(users)
    .set(data)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .returning();
  return row;
}

async softDelete(id: string): Promise<void> {
  await this.db
    .update(users)
    .set({ deletedAt: new Date() })
    .where(eq(users.id, id));
}
```

Add `isNull` to the drizzle-orm import at the top of the file:

```typescript
import { and, eq, isNull } from "drizzle-orm";
```

Also update `findByClerkId` to filter out soft-deleted users:

```typescript
async findByClerkId(clerkUserId: string): Promise<UserRow | undefined> {
  const [row] = await this.db
    .select()
    .from(users)
    .where(and(eq(users.clerkUserId, clerkUserId), isNull(users.deletedAt)))
    .limit(1);
  return row;
}
```

- [ ] **Step 3: Implement in InMemory repository**

In `apps/api/src/modules/user/user.repository.in-memory.ts`, add the `deletedAt` field to the `upsert` push call (it's already there as part of `UserRow` type) and add:

```typescript
async update(
  id: string,
  data: {
    name?: string;
    phone?: string | null;
    instagram?: string | null;
    birthDate?: string | null;
  },
): Promise<UserRow | undefined> {
  const user = this.users.find((u) => u.id === id && !u.deletedAt);
  if (!user) return undefined;
  if (data.name !== undefined) user.name = data.name;
  if (data.phone !== undefined) user.phone = data.phone;
  if (data.instagram !== undefined) user.instagram = data.instagram;
  if (data.birthDate !== undefined) user.birthDate = data.birthDate;
  user.updatedAt = new Date();
  return { ...user };
}

async softDelete(id: string): Promise<void> {
  const user = this.users.find((u) => u.id === id);
  if (user) user.deletedAt = new Date();
}
```

Also update `findByClerkId` in the in-memory repo to filter soft-deleted:

```typescript
async findByClerkId(clerkUserId: string): Promise<UserRow | undefined> {
  return this.users.find((u) => u.clerkUserId === clerkUserId && !u.deletedAt);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/user/user.repository.ts apps/api/src/modules/user/user.repository.postgres.ts apps/api/src/modules/user/user.repository.in-memory.ts
git commit -m "feat(api): add update and softDelete to user repository"
```

---

### Task 4: Add `updateProfile` and `deleteAccount` to UserService with tests

**Files:**
- Modify: `apps/api/src/modules/user/user.service.ts`
- Modify: `apps/api/src/modules/user/user.service.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/src/modules/user/user.service.test.ts`:

```typescript
it("updateProfile updates user fields", async () => {
  const repo = new InMemoryUserRepository();
  const svc = new UserService(repo);
  await svc.upsertFromClerk({
    clerkUserId: "clerk_profile",
    email: "p@example.com",
    name: "Original",
    profileImageUrl: null,
  });
  const user = (await svc.getByClerkId("clerk_profile"))!;

  const updated = await svc.updateProfile(user.id, {
    name: "New Name",
    phone: "+5511999999999",
    instagram: "newhandle",
    birthDate: "1995-03-15",
  });

  expect(updated).not.toBeNull();
  expect(updated!.name).toBe("New Name");
  expect(updated!.phone).toBe("+5511999999999");
  expect(updated!.instagram).toBe("newhandle");
  expect(updated!.birthDate).toBe("1995-03-15");
});

it("updateProfile returns null for non-existent user", async () => {
  const repo = new InMemoryUserRepository();
  const svc = new UserService(repo);
  const result = await svc.updateProfile("00000000-0000-0000-0000-000000000000", { name: "X" });
  expect(result).toBeNull();
});

it("softDelete sets deletedAt and user is no longer findable", async () => {
  const repo = new InMemoryUserRepository();
  const svc = new UserService(repo);
  await svc.upsertFromClerk({
    clerkUserId: "clerk_del",
    email: "del@example.com",
    name: "Delete Me",
    profileImageUrl: null,
  });
  const user = (await svc.getByClerkId("clerk_del"))!;

  await svc.softDelete(user.id);

  const found = await svc.getByClerkId("clerk_del");
  expect(found).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run src/modules/user/user.service.test.ts`

Expected: FAIL — `updateProfile` and `softDelete` are not defined on `UserService`.

- [ ] **Step 3: Implement the methods in UserService**

Add to `apps/api/src/modules/user/user.service.ts`:

```typescript
async updateProfile(
  userId: string,
  data: {
    name?: string;
    phone?: string | null;
    instagram?: string | null;
    birthDate?: string | null;
  },
) {
  return (await this.userRepo.update(userId, data)) ?? null;
}

async softDelete(userId: string): Promise<void> {
  await this.userRepo.softDelete(userId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/modules/user/user.service.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/user/user.service.ts apps/api/src/modules/user/user.service.test.ts
git commit -m "feat(api): add updateProfile and softDelete to UserService with tests"
```

---

### Task 5: Add `PATCH /users/me` and `DELETE /users/me` routes

**Files:**
- Modify: `apps/api/src/modules/user/user.routes.ts`

- [ ] **Step 1: Update `buildMeResponse` to include new fields**

In `user.routes.ts`, update the `buildMeResponse` function to include `phone`, `instagram`, and `birthDate`:

```typescript
function buildMeResponse(
  row: NonNullable<Awaited<ReturnType<typeof userService.getByClerkId>>>,
  activeRole: string | null,
  activeAcademy: Awaited<
    ReturnType<typeof userService.getActiveAcademyForManager>
  >,
  activeMembership: Awaited<
    ReturnType<typeof membershipRepo.findActiveOrPendingByUser>
  >,
) {
  return userMeResponseSchema.parse({
    id: row.id,
    clerkUserId: row.clerkUserId,
    email: row.email,
    name: row.name,
    profileImageUrl: row.profileImageUrl,
    phone: row.phone ?? null,
    instagram: row.instagram ?? null,
    birthDate: row.birthDate ?? null,
    activeRole,
    activeAcademy,
    activeMembership,
  });
}
```

Add `updateProfileBodySchema` to the imports from `@tatame/validators`:

```typescript
import {
  syncUserBodySchema,
  updateProfileBodySchema,
  userMeResponseSchema,
} from "@tatame/validators";
import type { SyncUserBody, UpdateProfileBody } from "@tatame/validators";
```

- [ ] **Step 2: Add the PATCH endpoint**

Add after the existing POST `/me/sync` route:

```typescript
userRouter.patch(
  "/me",
  requireSession,
  validateBody(updateProfileBodySchema),
  async (req, res, next) => {
    try {
      const { userId: clerkUserId } = getAuth(req);
      if (!clerkUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const row = await userService.getByClerkId(clerkUserId);
      if (!row) {
        res.status(404).json({ error: "Usuário não encontrado" });
        return;
      }

      const body = req.validatedBody as UpdateProfileBody;
      const updated = await userService.updateProfile(row.id, body);
      if (!updated) {
        res.status(404).json({ error: "Usuário não encontrado" });
        return;
      }

      const activeRole = await userService.getActiveRole(updated.id);

      let activeAcademy = null;
      if (activeRole === "manager") {
        activeAcademy = await userService.getActiveAcademyForManager(updated.id);
      }

      let activeMembership = null;
      if (activeRole && activeRole !== "manager") {
        activeMembership =
          await membershipRepo.findActiveOrPendingByUser(updated.id);
      }

      res.json(
        buildMeResponse(updated, activeRole, activeAcademy, activeMembership),
      );
    } catch (e) {
      next(e);
    }
  },
);
```

- [ ] **Step 3: Add the DELETE endpoint**

Add after the PATCH route:

```typescript
userRouter.delete("/me", requireSession, async (req, res, next) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const row = await userService.getByClerkId(clerkUserId);
    if (!row) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }

    await userService.softDelete(row.id);

    try {
      const clerkClient = getClerkClient();
      await clerkClient.users.deleteUser(clerkUserId);
    } catch (clerkErr) {
      console.error("Failed to delete Clerk user:", clerkErr);
    }

    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
```

- [ ] **Step 4: Verify the API compiles**

Run: `cd apps/api && npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/user/user.routes.ts
git commit -m "feat(api): add PATCH and DELETE /users/me endpoints"
```

---

### Task 6: Add mobile hooks `useUpdateProfile` and `useDeleteAccount`

**Files:**
- Modify: `apps/mobile/lib/hooks/use-user.ts`

- [ ] **Step 1: Add the hooks**

Replace the contents of `apps/mobile/lib/hooks/use-user.ts` with:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useAuth } from "@clerk/clerk-expo";
import type { UserMeResponse, UpdateProfileBody } from "@tatame/validators";

export function useCurrentUser() {
  const api = useApi();

  return useQuery({
    queryKey: ["user", "me"],
    queryFn: () => api.get<UserMeResponse>("/users/me"),
  });
}

export function useUpdateProfile() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileBody) =>
      api.patch<UserMeResponse>("/users/me", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useDeleteAccount() {
  const api = useApi();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.delete<void>("/users/me"),
    onSuccess: async () => {
      queryClient.clear();
      await signOut();
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/lib/hooks/use-user.ts
git commit -m "feat(mobile): add useUpdateProfile and useDeleteAccount hooks"
```

---

### Task 7: Create the profile screen

**Files:**
- Create: `apps/mobile/app/(app)/profile.tsx`

- [ ] **Step 1: Create the profile screen**

Create `apps/mobile/app/(app)/profile.tsx`:

```tsx
import { useCallback } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  LogOut,
  Mail,
  Trash2,
  UserCheck,
} from "lucide-react-native";

import { Avatar } from "@/components/Avatar";
import { FormInput } from "@/components/FormInput";
import { DatePickerField } from "@/components/DatePickerField";
import { GradientButton } from "@/components/GradientButton";
import { useCurrentUser, useUpdateProfile, useDeleteAccount } from "@/lib/hooks/use-user";

const ROLE_LABELS: Record<string, string> = {
  manager: "Gestor",
  instructor: "Instrutor",
  student: "Aluno",
};

const profileFormSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").max(100),
  phone: z.string().max(20).nullable(),
  instagram: z.string().max(30).nullable(),
  birthDate: z.string().nullable(),
});

type ProfileForm = z.infer<typeof profileFormSchema>;

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    values: {
      name: user?.name ?? "",
      phone: user?.phone ?? null,
      instagram: user?.instagram ?? null,
      birthDate: user?.birthDate ?? null,
    },
  });

  const onSave = handleSubmit((data) => {
    updateProfile.mutate(data);
  });

  const handleLogout = useCallback(async () => {
    queryClient.clear();
    await signOut();
  }, [queryClient, signOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Excluir conta",
      "Tem certeza? Esta ação é irreversível. Todos os seus dados serão removidos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => deleteAccount.mutate(),
        },
      ],
    );
  }, [deleteAccount]);

  if (!user) return null;

  const avatarLetter = (user.name?.charAt(0) || "?").toUpperCase();
  const roleLabel = ROLE_LABELS[user.activeRole ?? ""] ?? user.activeRole ?? "";

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
                Meu perfil
              </Text>
              <View className="h-10 w-10" />
            </View>

            {/* Avatar Section */}
            <View className="items-center" style={{ gap: 12 }}>
              <Avatar
                variant="user"
                imageUrl={user.profileImageUrl}
                fallbackLetter={avatarLetter}
                size={80}
              />
              <Text className="font-poppins-bold text-xl text-primary">
                {user.name}
              </Text>
              <View
                className="rounded-full"
                style={{
                  backgroundColor: "#A078E820",
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                }}
              >
                <Text
                  className="font-poppins-semibold text-[13px]"
                  style={{ color: "#A078E8" }}
                >
                  {roleLabel}
                </Text>
              </View>
            </View>

            {/* Section Title */}
            <Text className="font-poppins-bold text-base text-primary">
              Informações pessoais
            </Text>

            {/* Editable Card */}
            <View
              className="rounded-2xl border border-surface-border bg-surface"
              style={{ padding: 16, gap: 16 }}
            >
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, value } }) => (
                  <FormInput
                    label="Nome"
                    value={value}
                    onChangeText={onChange}
                    error={errors.name?.message}
                    placeholder="Seu nome"
                  />
                )}
              />
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, value } }) => (
                  <FormInput
                    label="Telefone"
                    value={value ?? ""}
                    onChangeText={(t) => onChange(t || null)}
                    error={errors.phone?.message}
                    placeholder="(11) 99999-9999"
                    keyboardType="phone-pad"
                  />
                )}
              />
              <Controller
                control={control}
                name="instagram"
                render={({ field: { onChange, value } }) => (
                  <FormInput
                    label="Instagram"
                    value={value ?? ""}
                    onChangeText={(t) => onChange(t || null)}
                    error={errors.instagram?.message}
                    placeholder="@seuusuario"
                    autoCapitalize="none"
                  />
                )}
              />
              <Controller
                control={control}
                name="birthDate"
                render={({ field: { onChange, value } }) => (
                  <DatePickerField
                    label="Data de nascimento"
                    value={value}
                    onChange={onChange}
                    error={errors.birthDate?.message}
                  />
                )}
              />
            </View>

            {/* Read-only Card */}
            <View className="overflow-hidden rounded-2xl border border-surface-border bg-surface">
              <View
                className="flex-row items-center"
                style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}
              >
                <Mail size={18} color="#525252" />
                <View className="min-w-0 flex-1" style={{ gap: 2 }}>
                  <Text className="font-poppins text-xs text-muted">
                    Email (somente leitura)
                  </Text>
                  <Text className="font-poppins text-sm text-primary">
                    {user.email}
                  </Text>
                </View>
                <Lock size={14} color="#525252" />
              </View>
              <View className="h-px w-full bg-surface-border" />
              <View
                className="flex-row items-center"
                style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}
              >
                <UserCheck size={18} color="#525252" />
                <View className="min-w-0 flex-1" style={{ gap: 2 }}>
                  <Text className="font-poppins text-xs text-muted">
                    Função (somente leitura)
                  </Text>
                  <Text className="font-poppins text-sm text-primary">
                    {roleLabel}
                  </Text>
                </View>
                <Lock size={14} color="#525252" />
              </View>
            </View>

            {/* Save Button */}
            <GradientButton
              label="Salvar alterações"
              onPress={onSave}
              disabled={!isDirty}
              loading={updateProfile.isPending}
            />

            {/* Account Card */}
            <View className="overflow-hidden rounded-2xl border border-surface-border bg-surface">
              <Pressable
                onPress={handleLogout}
                className="flex-row items-center"
                style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}
              >
                <LogOut size={18} color="#ABABAB" />
                <Text className="min-w-0 flex-1 font-poppins-medium text-sm text-muted">
                  Sair da conta
                </Text>
                <ChevronRight size={18} color="#525252" />
              </Pressable>
              <View className="h-px w-full bg-surface-border" />
              <Pressable
                onPress={handleDeleteAccount}
                className="flex-row items-center"
                style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}
              >
                <Trash2 size={18} color="#EF4444" />
                <Text
                  className="min-w-0 flex-1 font-poppins-medium text-sm"
                  style={{ color: "#EF4444" }}
                >
                  Excluir minha conta
                </Text>
                <ChevronRight size={18} color="#525252" />
              </Pressable>
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
git add apps/mobile/app/\(app\)/profile.tsx
git commit -m "feat(mobile): add profile screen"
```

---

### Task 8: Make avatar pressable on all 3 Home screens

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/(home)/index.tsx:122-128`
- Modify: `apps/mobile/app/(app)/(instructor)/(home)/index.tsx:145`
- Modify: `apps/mobile/app/(app)/(student)/(home)/index.tsx:96-109`

- [ ] **Step 1: Manager Home — wrap Avatar in Pressable**

In `apps/mobile/app/(app)/(manager)/(home)/index.tsx`, replace lines 122-128:

```tsx
<View className="flex-row items-center gap-2">
  <Avatar
    variant="user"
    imageUrl={me?.profileImageUrl}
    fallbackLetter={avatarLetter}
  />
</View>
```

with:

```tsx
<Pressable
  onPress={() => router.push("/(app)/profile")}
  className="flex-row items-center gap-2"
>
  <Avatar
    variant="user"
    imageUrl={me?.profileImageUrl}
    fallbackLetter={avatarLetter}
  />
</Pressable>
```

- [ ] **Step 2: Instructor Home — wrap Avatar in Pressable**

In `apps/mobile/app/(app)/(instructor)/(home)/index.tsx`, replace line 145:

```tsx
<Avatar variant="user" imageUrl={me?.profileImageUrl} fallbackLetter={avatarLetter} />
```

with:

```tsx
<Pressable onPress={() => router.push("/(app)/profile")}>
  <Avatar variant="user" imageUrl={me?.profileImageUrl} fallbackLetter={avatarLetter} />
</Pressable>
```

Add `Pressable` to the `react-native` import and `useRouter` from `expo-router` (useRouter is already imported).

- [ ] **Step 3: Student Home — add avatar to header**

In `apps/mobile/app/(app)/(student)/(home)/index.tsx`, the student home doesn't currently show a user avatar. It has a bell icon button. We need to add the avatar next to it.

First, add the imports:

```tsx
import { Avatar } from "@/components/Avatar";
import { useCurrentUser } from "@/lib/hooks/use-user";
```

Inside the component, add after the existing hooks:

```tsx
const { data: me } = useCurrentUser();
```

Replace the bell button section (lines 106-108):

```tsx
<Pressable className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface">
  <Bell size={18} color="#FFFFFF" />
</Pressable>
```

with:

```tsx
<View className="flex-row items-center gap-2">
  <Pressable className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface">
    <Bell size={18} color="#FFFFFF" />
  </Pressable>
  <Pressable onPress={() => router.push("/(app)/profile")}>
    <Avatar
      variant="user"
      imageUrl={me?.profileImageUrl}
      fallbackLetter={(me?.name?.charAt(0) || "?").toUpperCase()}
    />
  </Pressable>
</View>
```

- [ ] **Step 4: Verify mobile compiles**

Run: `cd apps/mobile && npx expo export --platform ios --dump-sourcemap false 2>&1 | tail -5`

If this command is not available or too slow, alternatively run:
```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(app\)/\(manager\)/\(home\)/index.tsx apps/mobile/app/\(app\)/\(instructor\)/\(home\)/index.tsx apps/mobile/app/\(app\)/\(student\)/\(home\)/index.tsx
git commit -m "feat(mobile): make avatar pressable to navigate to profile"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run all API unit tests**

Run: `cd apps/api && npx vitest run`

Expected: All tests pass.

- [ ] **Step 2: Run type checks across the monorepo**

Run: `npx turbo typecheck`

Or if that's not set up:
```bash
cd apps/api && npx tsc --noEmit && cd ../../apps/mobile && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit if any fixes were needed**

Only if previous steps required fixes:
```bash
git add -A
git commit -m "fix: resolve type errors from profile screen implementation"
```
