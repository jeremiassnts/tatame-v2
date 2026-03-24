# Manager Core Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement M-MGR-01 (Create Academy), M-MGR-02 (Dashboard), M-MGR-03 (Academy Settings) screens plus supporting backend endpoints and mobile infrastructure.

**Architecture:** Screen-driven approach — build infrastructure (API client, TanStack Query, routing) first, then implement screens top-down. Backend changes include extending `/me` with academy context, a new upload module for Cloudflare R2, and a stats endpoint. Mobile uses Expo Router with role-based redirect and tab navigation.

**Tech Stack:** Expo Router, NativeWind, Clerk, TanStack Query, react-hook-form, Zod, Express, Drizzle ORM, Cloudflare R2

**Spec:** `docs/superpowers/specs/2026-03-24-manager-core-screens-design.md`

---

## File Structure

### Backend — New/Modified Files

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/validators/src/user.schema.ts` | Modify | Add `activeAcademy` to `userMeResponseSchema` |
| `packages/validators/src/academy.schema.ts` | Modify | Add `academyStatsResponseSchema` |
| `packages/validators/src/upload.schema.ts` | Create | `uploadImageResponseSchema` |
| `packages/validators/src/index.ts` | Modify | Export new schemas |
| `packages/config/src/env.ts` | Modify | Add R2 env vars |
| `apps/api/src/modules/user/user.repository.ts` | Modify | Add `findActiveAcademyForManager` method |
| `apps/api/src/modules/user/user.repository.postgres.ts` | Modify | Implement `findActiveAcademyForManager` |
| `apps/api/src/modules/user/user.service.ts` | Modify | Add `getActiveAcademyForManager` method |
| `apps/api/src/modules/user/user.routes.ts` | Modify | Include `activeAcademy` in `/me` response |
| `apps/api/src/modules/academy/academy.repository.ts` | Modify | Add `getStats` method |
| `apps/api/src/modules/academy/academy.repository.postgres.ts` | Modify | Implement `getStats` |
| `apps/api/src/modules/academy/academy.service.ts` | Modify | Add `getStats` method |
| `apps/api/src/modules/academy/academy.routes.ts` | Modify | Add `GET /:academyId/stats` |
| `apps/api/src/modules/upload/upload.config.ts` | Create | R2 S3 client setup |
| `apps/api/src/modules/upload/upload.service.ts` | Create | Upload logic |
| `apps/api/src/modules/upload/upload.routes.ts` | Create | Route with multer |
| `apps/api/src/router.ts` | Modify | Register upload router |

### Mobile — New/Modified Files

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/mobile/lib/api.ts` | Create | Fetch wrapper with Clerk token |
| `apps/mobile/lib/query-client.ts` | Create | QueryClient singleton |
| `apps/mobile/lib/hooks/use-user.ts` | Create | `useCurrentUser()` hook |
| `apps/mobile/lib/hooks/use-academy.ts` | Create | Academy query/mutation hooks |
| `apps/mobile/lib/hooks/use-upload.ts` | Create | `useUploadImage()` hook |
| `apps/mobile/lib/academy-context.tsx` | Create | AcademyContext + provider + hook |
| `apps/mobile/app/(app)/_layout.tsx` | Modify | Role-based redirect + QueryClientProvider + AcademyContext |
| `apps/mobile/app/(app)/create-academy.tsx` | Create | M-MGR-01 screen |
| `apps/mobile/app/(app)/(manager)/_layout.tsx` | Create | Tab navigator |
| `apps/mobile/app/(app)/(manager)/(home)/_layout.tsx` | Create | Stack navigator |
| `apps/mobile/app/(app)/(manager)/(home)/index.tsx` | Create | M-MGR-02 dashboard |
| `apps/mobile/app/(app)/(manager)/(home)/settings.tsx` | Create | M-MGR-03 settings |
| `apps/mobile/components/StatCard.tsx` | Create | Dashboard stat card |
| `apps/mobile/components/ClassCard.tsx` | Create | Class preview card |
| `apps/mobile/components/ImagePickerField.tsx` | Create | Image picker with preview |
| `apps/mobile/components/DatePickerField.tsx` | Create | Date picker wrapper |

---

## Task 1: Install Dependencies

**Status:** ✅ Completed

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/api/package.json`

- [x] **Step 1: Install mobile dependencies**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
pnpm --filter @tatame/mobile add @tanstack/react-query react-hook-form @hookform/resolvers expo-image-picker @react-native-community/datetimepicker
```

- [x] **Step 2: Install API dependencies**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
pnpm --filter @tatame/api add multer @aws-sdk/client-s3
pnpm --filter @tatame/api add -D @types/multer
```

- [x] **Step 3: Verify installation**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
pnpm install
```
Expected: no errors, lock file updated.

- [x] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/api/package.json pnpm-lock.yaml
git commit -m "chore: add dependencies for manager core screens"
```

---

## Task 2: Backend — Extend `/me` with `activeAcademy`

**Status:** ✅ Completed

**Files:**
- Modify: `packages/validators/src/user.schema.ts`
- Modify: `packages/validators/src/index.ts`
- Modify: `apps/api/src/modules/user/user.repository.ts`
- Modify: `apps/api/src/modules/user/user.repository.postgres.ts`
- Modify: `apps/api/src/modules/user/user.service.ts`
- Modify: `apps/api/src/modules/user/user.routes.ts`
- Test: `apps/api/src/modules/user/__tests__/user.routes.test.ts` (if exists)

- [x] **Step 1: Update `userMeResponseSchema` in validators**

In `packages/validators/src/user.schema.ts`, add the `activeAcademy` field:

```typescript
export const activeAcademySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  logoUrl: z.string().nullable(),
});

export type ActiveAcademy = z.infer<typeof activeAcademySchema>;

export const userMeResponseSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string(),
  email: z.string().email(),
  name: z.string(),
  profileImageUrl: z.string().nullable(),
  /** Null until `POST /users/me/role` (spec §8). */
  activeRole: roleEnumSchema.nullable(),
  /** Non-null for managers who own an academy. */
  activeAcademy: activeAcademySchema.nullable(),
});
```

- [x] **Step 2: Export new types from validators index**

In `packages/validators/src/index.ts`, add to the user exports:

```typescript
export {
  activeAcademySchema,
  roleEnumSchema,
  setInitialRoleBodySchema,
  setInitialRoleResponseSchema,
  userMeResponseSchema,
  type ActiveAcademy,
  type SetInitialRoleBody,
  type SetInitialRoleResponse,
  type UserMeResponse,
} from "./user.schema.js";
```

- [x] **Step 3: Add `findActiveAcademyForManager` to user repository interface**

In `apps/api/src/modules/user/user.repository.ts`, add:

```typescript
findActiveAcademyForManager(userId: string): Promise<{
  id: string;
  name: string;
  logoUrl: string | null;
} | undefined>;
```

- [x] **Step 4: Implement in Postgres repository**

In `apps/api/src/modules/user/user.repository.postgres.ts`, update the imports at the top of the file:

```typescript
import { and, eq } from "drizzle-orm";
import { users, userRoles, academyMemberships, academies, type Database } from "@tatame/db";
import type { IUserRepository, UserRow } from "./user.repository.js";
```

Then add the method:

```typescript
async findActiveAcademyForManager(userId: string): Promise<{
  id: string;
  name: string;
  logoUrl: string | null;
} | undefined> {
  const [row] = await this.db
    .select({
      id: academies.id,
      name: academies.name,
      logoUrl: academies.logoUrl,
    })
    .from(academyMemberships)
    .innerJoin(academies, eq(academies.id, academyMemberships.academyId))
    .where(
      and(
        eq(academyMemberships.userId, userId),
        eq(academyMemberships.role, "manager"),
        eq(academyMemberships.status, "active"),
        eq(academyMemberships.isActive, true),
      ),
    )
    .limit(1);
  return row ?? undefined;
}
```

- [x] **Step 5: Add method to UserService**

In `apps/api/src/modules/user/user.service.ts`, add:

```typescript
async getActiveAcademyForManager(userId: string) {
  return (await this.userRepo.findActiveAcademyForManager(userId)) ?? null;
}
```

- [x] **Step 6: Update `/me` route to include `activeAcademy`**

In `apps/api/src/modules/user/user.routes.ts`, update the GET `/me` handler:

```typescript
userRouter.get("/me", requireSession, async (req, res, next) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const row = await userService.getByClerkId(clerkUserId);

    if (!row) {
      res.status(404).json({
        error: "User not provisioned yet; wait for Clerk webhook sync",
      });
      return;
    }

    const activeRole = await userService.getActiveRole(row.id);

    let activeAcademy = null;
    if (activeRole === "manager") {
      activeAcademy = await userService.getActiveAcademyForManager(row.id);
    }

    const body = {
      id: row.id,
      clerkUserId: row.clerkUserId,
      email: row.email,
      name: row.name,
      profileImageUrl: row.profileImageUrl,
      activeRole,
      activeAcademy,
    };
    const parsed = userMeResponseSchema.safeParse(body);
    res.json(parsed.success ? parsed.data : body);
  } catch (e) {
    next(e);
  }
});
```

- [x] **Step 7: Build and verify**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
pnpm --filter @tatame/validators build
pnpm --filter @tatame/api build
```
Expected: no type errors.

- [x] **Step 8: Run existing tests**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
pnpm --filter @tatame/api test
```
Expected: all existing tests pass (update any snapshots if needed for the new `activeAcademy` field).

- [x] **Step 9: Commit**

```bash
git add packages/validators/src/user.schema.ts packages/validators/src/index.ts \
  apps/api/src/modules/user/user.repository.ts \
  apps/api/src/modules/user/user.repository.postgres.ts \
  apps/api/src/modules/user/user.service.ts \
  apps/api/src/modules/user/user.routes.ts
git commit -m "feat(api): extend /me response with activeAcademy for managers"
```

---

## Task 3: Backend — Upload Module (Cloudflare R2)

**Status:** ✅ Completed

**Files:**
- Modify: `packages/config/src/env.ts`
- Create: `packages/validators/src/upload.schema.ts`
- Modify: `packages/validators/src/index.ts`
- Create: `apps/api/src/modules/upload/upload.config.ts`
- Create: `apps/api/src/modules/upload/upload.service.ts`
- Create: `apps/api/src/modules/upload/upload.routes.ts`
- Modify: `apps/api/src/router.ts`

- [x] **Step 1: Add R2 env vars to config**

In `packages/config/src/env.ts`, add to `envSchema`:

```typescript
R2_ACCOUNT_ID: z.string().optional(),
R2_ACCESS_KEY_ID: z.string().optional(),
R2_SECRET_ACCESS_KEY: z.string().optional(),
R2_BUCKET_NAME: z.string().optional(),
R2_PUBLIC_URL: z.string().url().optional(),
```

- [x] **Step 2: Create upload Zod schema**

Create `packages/validators/src/upload.schema.ts`:

```typescript
import { z } from "zod";

export const uploadImageResponseSchema = z.object({
  url: z.string().url(),
});

export type UploadImageResponse = z.infer<typeof uploadImageResponseSchema>;
```

- [x] **Step 3: Export from validators index**

In `packages/validators/src/index.ts`, add:

```typescript
export {
  uploadImageResponseSchema,
  type UploadImageResponse,
} from "./upload.schema.js";
```

- [x] **Step 4: Create R2 client config**

Create `apps/api/src/modules/upload/upload.config.ts`:

```typescript
import { S3Client } from "@aws-sdk/client-s3";
import { loadEnv } from "@tatame/config";

let client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (client) return client;

  const env = loadEnv();
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 credentials not configured");
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  return client;
}

export function getR2Config() {
  const env = loadEnv();
  if (!env.R2_BUCKET_NAME || !env.R2_PUBLIC_URL) {
    throw new Error("R2_BUCKET_NAME and R2_PUBLIC_URL must be configured");
  }
  return {
    bucketName: env.R2_BUCKET_NAME,
    publicUrl: env.R2_PUBLIC_URL,
  };
}
```

- [x] **Step 5: Create upload service**

Create `apps/api/src/modules/upload/upload.service.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Config } from "./upload.config.js";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class UploadService {
  async uploadImage(file: {
    buffer: Buffer;
    mimetype: string;
    size: number;
  }): Promise<string> {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      throw new Error("Invalid file type. Allowed: jpeg, png, webp");
    }
    if (file.size > MAX_SIZE) {
      throw new Error("File too large. Maximum: 5MB");
    }

    const ext = MIME_TO_EXT[file.mimetype] ?? "jpg";
    const key = `${randomUUID()}.${ext}`;

    const r2 = getR2Client();
    const { bucketName, publicUrl } = getR2Config();

    await r2.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return `${publicUrl}/${key}`;
  }
}
```

- [x] **Step 6: Create upload routes**

Create `apps/api/src/modules/upload/upload.routes.ts`:

```typescript
import { Router } from "express";
import multer from "multer";
import { requireSession } from "../../middleware/require-session.js";
import { HttpError } from "../../lib/http-error.js";
import { UploadService } from "./upload.service.js";

export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadService = new UploadService();

uploadRouter.post(
  "/image",
  requireSession,
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new HttpError(400, "No image file provided");
      }

      const url = await uploadService.uploadImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });

      res.status(201).json({ url });
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Invalid file type")) {
        next(new HttpError(400, e.message));
        return;
      }
      if (e instanceof Error && e.message.startsWith("File too large")) {
        next(new HttpError(400, e.message));
        return;
      }
      next(e);
    }
  },
);
```

- [x] **Step 7: Register upload router**

In `apps/api/src/router.ts`, add import and registration:

```typescript
import { uploadRouter } from "./modules/upload/upload.routes.js";
// ... existing imports

// After existing apiRouter.use() calls:
apiRouter.use("/uploads", uploadRouter);
```

- [x] **Step 8: Build and verify**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
pnpm --filter @tatame/validators build
pnpm --filter @tatame/config build
pnpm --filter @tatame/api build
```
Expected: no type errors.

- [x] **Step 9: Commit**

```bash
git add packages/config/src/env.ts \
  packages/validators/src/upload.schema.ts packages/validators/src/index.ts \
  apps/api/src/modules/upload/ apps/api/src/router.ts
git commit -m "feat(api): add image upload module with Cloudflare R2"
```

---

## Task 4: Backend — Academy Stats Endpoint

**Status:** ✅ Completed

**Files:**
- Modify: `packages/validators/src/academy.schema.ts`
- Modify: `packages/validators/src/index.ts`
- Modify: `apps/api/src/modules/academy/academy.repository.ts`
- Modify: `apps/api/src/modules/academy/academy.repository.postgres.ts`
- Modify: `apps/api/src/modules/academy/academy.service.ts`
- Modify: `apps/api/src/modules/academy/academy.routes.ts`

- [x] **Step 1: Add stats schema to validators**

In `packages/validators/src/academy.schema.ts`, add:

```typescript
export const academyStatsResponseSchema = z.object({
  activeMembers: z.number().int().min(0),
  pendingRequests: z.number().int().min(0),
  classesToday: z.number().int().min(0),
  activePlans: z.number().int().min(0),
});

export type AcademyStatsResponse = z.infer<typeof academyStatsResponseSchema>;
```

- [x] **Step 2: Export from validators index**

In `packages/validators/src/index.ts`, update the academy exports block:

```typescript
export {
  academyIdParamSchema,
  academyResponseSchema,
  academyStatsResponseSchema,
  createAcademyBodySchema,
  updateAcademyBodySchema,
  type AcademyResponse,
  type AcademyStatsResponse,
  type CreateAcademyBody,
  type UpdateAcademyBody,
} from "./academy.schema.js";
```

- [x] **Step 3: Add `getStats` to academy repository interface**

In `apps/api/src/modules/academy/academy.repository.ts`, add:

```typescript
getStats(academyId: string, currentDayOfWeek: number): Promise<{
  activeMembers: number;
  pendingRequests: number;
  classesToday: number;
  activePlans: number;
}>;
```

- [x] **Step 4: Implement `getStats` in Postgres repository**

In `apps/api/src/modules/academy/academy.repository.postgres.ts`, add imports for `and` and `count` from `drizzle-orm` (keep existing `eq` / `ilike`) and `academyMemberships`, `classes`, `subscriptionPlans` from `@tatame/db`, then add:

```typescript
async getStats(academyId: string, currentDayOfWeek: number) {
  const [[membersRow], [pendingRow], [classesRow], [plansRow]] =
    await Promise.all([
      this.db
        .select({ count: count() })
        .from(academyMemberships)
        .where(
          and(
            eq(academyMemberships.academyId, academyId),
            eq(academyMemberships.status, "active"),
          ),
        ),
      this.db
        .select({ count: count() })
        .from(academyMemberships)
        .where(
          and(
            eq(academyMemberships.academyId, academyId),
            eq(academyMemberships.status, "pending"),
          ),
        ),
      this.db
        .select({ count: count() })
        .from(classes)
        .where(
          and(
            eq(classes.academyId, academyId),
            eq(classes.dayOfWeek, currentDayOfWeek),
            eq(classes.isActive, true),
          ),
        ),
      this.db
        .select({ count: count() })
        .from(subscriptionPlans)
        .where(
          and(
            eq(subscriptionPlans.academyId, academyId),
            eq(subscriptionPlans.isActive, true),
          ),
        ),
    ]);

  return {
    activeMembers: membersRow?.count ?? 0,
    pendingRequests: pendingRow?.count ?? 0,
    classesToday: classesRow?.count ?? 0,
    activePlans: plansRow?.count ?? 0,
  };
}
```

- [x] **Step 5: Add `getStats` to AcademyService**

In `apps/api/src/modules/academy/academy.service.ts`, add:

```typescript
async getStats(academyId: string, ownerUserId: string) {
  await this.assertManagerOwnsAcademy(ownerUserId, academyId);
  const currentDayOfWeek = new Date().getDay(); // 0=Sunday
  return this.academyRepo.getStats(academyId, currentDayOfWeek);
}
```

- [x] **Step 6: Add stats route**

In `apps/api/src/modules/academy/academy.routes.ts`, add the route after the existing `GET /:academyId` route:

```typescript
academyRouter.get(
  "/:academyId/stats",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const params = academyIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid academy id");
      }
      const userId = req.appAuth!.userId;
      const stats = await academyService.getStats(
        params.data.academyId,
        userId,
      );
      res.json(stats);
    } catch (e) {
      next(e);
    }
  },
);
```

**Important:** This route must be placed BEFORE the `POST /` route to avoid route conflicts. Insert it after the `GET /:academyId` handler.

- [x] **Step 7: Build and run tests**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
pnpm --filter @tatame/validators build
pnpm --filter @tatame/api build
pnpm --filter @tatame/api test
```
Expected: build succeeds, all tests pass.

- [x] **Step 8: Commit**

```bash
git add packages/validators/src/academy.schema.ts packages/validators/src/index.ts \
  apps/api/src/modules/academy/
git commit -m "feat(api): add GET /academies/:id/stats endpoint for manager dashboard"
```

---

## Task 5: Mobile — API Client + TanStack Query Setup

**Status:** ✅ Completed — also added `academy-context`, `use-user`, and minimal routes so redirects and `tsc` succeed (Task 7 replaces manager shell with tabs).

**Files:**
- Create: `apps/mobile/lib/api.ts`
- Create: `apps/mobile/lib/query-client.ts`
- Modify: `apps/mobile/app/(app)/_layout.tsx`

- [x] **Step 1: Create API client**

Create `apps/mobile/lib/api.ts`:

```typescript
import { useAuth } from "@clerk/clerk-expo";

const API_BASE_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/v1";

type FetchOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

async function request<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, token } = opts;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, error.error ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function useApi() {
  const { getToken } = useAuth();

  return {
    async get<T>(path: string): Promise<T> {
      const token = await getToken();
      return request<T>(path, { token });
    },

    async post<T>(path: string, body?: unknown): Promise<T> {
      const token = await getToken();
      return request<T>(path, { method: "POST", body, token });
    },

    async patch<T>(path: string, body?: unknown): Promise<T> {
      const token = await getToken();
      return request<T>(path, { method: "PATCH", body, token });
    },

    async uploadImage(file: {
      uri: string;
      type: string;
      name: string;
    }): Promise<{ url: string }> {
      const token = await getToken();
      const formData = new FormData();
      formData.append("image", file as unknown as Blob);
      return request("/uploads/image", { method: "POST", body: formData, token });
    },
  };
}
```

- [x] **Step 2: Create query client**

Create `apps/mobile/lib/query-client.ts`:

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});
```

- [x] **Step 3: Update `(app)/_layout.tsx` with QueryClientProvider**

Replace `apps/mobile/app/(app)/_layout.tsx` with:

```typescript
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { AcademyProvider } from "@/lib/academy-context";

export default function AppLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  );
}

function AppRouter() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUser();

  useEffect(() => {
    if (isLoading || !user) return;

    if (user.activeRole === "manager" && !user.activeAcademy) {
      router.replace("/(app)/create-academy");
    } else if (user.activeRole === "manager" && user.activeAcademy) {
      router.replace("/(app)/(manager)/(home)");
    }
    // Future: instructor/student redirects
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  const academyContext =
    user.activeRole === "manager" && user.activeAcademy
      ? {
          academyId: user.activeAcademy.id,
          academyName: user.activeAcademy.name,
          academyLogoUrl: user.activeAcademy.logoUrl,
        }
      : null;

  if (academyContext) {
    return (
      <AcademyProvider value={academyContext}>
        <Stack screenOptions={{ headerShown: false }} />
      </AcademyProvider>
    );
  }

  // Render Stack unconditionally so Expo Router can resolve child routes
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [x] **Step 4: Verify no type errors**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/mobile
npx tsc --noEmit
```
Expected: will have errors for missing hooks files — that's OK, we create them next.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/lib/api.ts apps/mobile/lib/query-client.ts apps/mobile/app/\(app\)/_layout.tsx
git commit -m "feat(mobile): add API client and TanStack Query setup"
```

---

## Task 6: Mobile — Hooks + Academy Context

**Status:** ✅ Completed

**Files:**
- Create: `apps/mobile/lib/academy-context.tsx`
- Create: `apps/mobile/lib/hooks/use-user.ts`
- Create: `apps/mobile/lib/hooks/use-academy.ts`
- Create: `apps/mobile/lib/hooks/use-upload.ts`

**Note:** Steps 1–2 were shipped with Task 5 (`lib/academy-context.tsx`, `lib/hooks/use-user.ts`).

- [x] **Step 1: Create academy context**

Create `apps/mobile/lib/academy-context.tsx`:

```typescript
import { createContext, useContext } from "react";
import type { ReactNode } from "react";

type AcademyContextValue = {
  academyId: string;
  academyName: string;
  academyLogoUrl: string | null;
};

const AcademyContext = createContext<AcademyContextValue | null>(null);

export function AcademyProvider({
  value,
  children,
}: {
  value: AcademyContextValue;
  children: ReactNode;
}) {
  return (
    <AcademyContext.Provider value={value}>{children}</AcademyContext.Provider>
  );
}

export function useAcademyContext(): AcademyContextValue {
  const ctx = useContext(AcademyContext);
  if (!ctx) {
    throw new Error("useAcademyContext must be used within AcademyProvider");
  }
  return ctx;
}
```

- [x] **Step 2: Create user hook**

Create `apps/mobile/lib/hooks/use-user.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import type { UserMeResponse } from "@tatame/validators";

export function useCurrentUser() {
  const api = useApi();

  return useQuery({
    queryKey: ["user", "me"],
    queryFn: () => api.get<UserMeResponse>("/users/me"),
  });
}
```

- [x] **Step 3: Create academy hooks**

Create `apps/mobile/lib/hooks/use-academy.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import type {
  AcademyResponse,
  AcademyStatsResponse,
  CreateAcademyBody,
  UpdateAcademyBody,
} from "@tatame/validators";

export function useAcademy(academyId: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["academy", academyId],
    queryFn: () => api.get<AcademyResponse>(`/academies/${academyId}`),
  });
}

export function useAcademyStats(academyId: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["academy-stats", academyId],
    queryFn: () =>
      api.get<AcademyStatsResponse>(`/academies/${academyId}/stats`),
  });
}

export function useCreateAcademy() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateAcademyBody) =>
      api.post<AcademyResponse>("/academies", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useUpdateAcademy(academyId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateAcademyBody) =>
      api.patch<AcademyResponse>(`/academies/${academyId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy", academyId] });
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}
```

- [x] **Step 4: Create upload hook**

Create `apps/mobile/lib/hooks/use-upload.ts`:

```typescript
import { useMutation } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export function useUploadImage() {
  const api = useApi();

  return useMutation({
    mutationFn: (file: { uri: string; type: string; name: string }) =>
      api.uploadImage(file),
  });
}
```

- [x] **Step 5: Commit**

```bash
git add apps/mobile/lib/academy-context.tsx apps/mobile/lib/hooks/
git commit -m "feat(mobile): add academy context and API hooks"
```

---

## Task 7: Mobile — Manager Tab Navigator + Home Stack

**Status:** ✅ Completed

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(manager)/(home)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(manager)/(members)/index.tsx` (placeholder)
- Create: `apps/mobile/app/(app)/(manager)/(classes)/index.tsx` (placeholder)
- Create: `apps/mobile/app/(app)/(manager)/(more)/index.tsx` (placeholder)
- Create: `apps/mobile/app/(app)/(manager)/(members)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(manager)/(classes)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(manager)/(more)/_layout.tsx`

- [x] **Step 1: Create manager tab navigator**

Create `apps/mobile/app/(app)/(manager)/_layout.tsx`:

```typescript
import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { Home, Users, Calendar, MoreHorizontal } from "lucide-react-native";

export default function ManagerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1A1A1A",
          borderTopColor: "#2A2A2A",
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 16,
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
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(members)"
        options={{
          title: "Members",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(classes)"
        options={{
          title: "Classes",
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(more)"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => (
            <MoreHorizontal size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [x] **Step 2: Create home stack layout**

Create `apps/mobile/app/(app)/(manager)/(home)/_layout.tsx`:

```typescript
import { Stack } from "expo-router";

export default function HomeLayout() {
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

- [x] **Step 3: Create placeholder layouts and screens for other tabs**

Create `apps/mobile/app/(app)/(manager)/(members)/_layout.tsx`:

```typescript
import { Stack } from "expo-router";

export default function MembersLayout() {
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

Create `apps/mobile/app/(app)/(manager)/(members)/index.tsx`:

```typescript
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MembersPlaceholder() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center">
        <Text className="font-poppins text-muted">Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}
```

Create `apps/mobile/app/(app)/(manager)/(classes)/_layout.tsx` — same as members layout.

Create `apps/mobile/app/(app)/(manager)/(classes)/index.tsx` — same as members placeholder (change function name to `ClassesPlaceholder`).

Create `apps/mobile/app/(app)/(manager)/(more)/_layout.tsx` — same as members layout.

Create `apps/mobile/app/(app)/(manager)/(more)/index.tsx` — same as members placeholder (change function name to `MorePlaceholder`).

- [x] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/\(manager\)/
git commit -m "feat(mobile): add manager tab navigator with placeholders"
```

---

## Task 8: Mobile — Shared Components (ImagePickerField, DatePickerField, StatCard, ClassCard)

**Status:** ✅ Completed

**Files:**
- Create: `apps/mobile/components/ImagePickerField.tsx`
- Create: `apps/mobile/components/DatePickerField.tsx`
- Create: `apps/mobile/components/StatCard.tsx`
- Create: `apps/mobile/components/ClassCard.tsx`

- [x] **Step 1: Update GradientButton with disabled and loading props**

Modify `apps/mobile/components/GradientButton.tsx`:

```typescript
import { Pressable, Text, View, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";

type GradientButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function GradientButton({ label, onPress, disabled, loading }: GradientButtonProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} className="w-full">
      <View className="overflow-hidden rounded-xl">
        <LinearGradient
          colors={disabled ? ["#3A3A3A", "#3A3A3A"] : ["#A078E8", "#7C5CBF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="h-14 flex-row items-center justify-center"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text className="font-poppins-semibold text-base text-white">
                {label}
              </Text>
              <ArrowRight size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
            </>
          )}
        </LinearGradient>
      </View>
    </Pressable>
  );
}
```

- [x] **Step 2: Create ImagePickerField component**

Create `apps/mobile/components/ImagePickerField.tsx`:

```typescript
import { View, Text, Pressable, Image } from "react-native";
import { Camera, ImagePlus } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

type ImagePickerFieldProps = {
  label: string;
  imageUri: string | null;
  onImageSelected: (asset: ImagePicker.ImagePickerAsset) => void;
  error?: string;
};

export function ImagePickerField({
  label,
  imageUri,
  onImageSelected,
  error,
}: ImagePickerFieldProps) {
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      onImageSelected(result.assets[0]);
    }
  };

  return (
    <View className="gap-1.5">
      <Text className="font-poppins-medium text-[13px] text-muted">
        {label}
      </Text>
      <Pressable
        onPress={pickImage}
        className={`h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border ${
          error ? "border-red-500" : "border-surface-border"
        } bg-surface`}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <ImagePlus size={28} color="#ABABAB" />
        )}
      </Pressable>
      {error ? (
        <Text className="font-poppins text-xs text-red-500">{error}</Text>
      ) : null}
    </View>
  );
}
```

- [x] **Step 3: Create DatePickerField**

Create `apps/mobile/components/DatePickerField.tsx`:

```typescript
import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";

type DatePickerFieldProps = {
  label: string;
  value: string | null; // YYYY-MM-DD or null
  onChange: (date: string | null) => void;
  error?: string;
};

export function DatePickerField({
  label,
  value,
  onChange,
  error,
}: DatePickerFieldProps) {
  const [show, setShow] = useState(false);

  const dateValue = value ? new Date(value + "T00:00:00") : new Date();

  const formatDisplay = (dateStr: string | null) => {
    if (!dateStr) return "Select date";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const handleChange = (_event: unknown, selectedDate?: Date) => {
    setShow(Platform.OS === "ios");
    if (selectedDate) {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const dd = String(selectedDate.getDate()).padStart(2, "0");
      onChange(`${yyyy}-${mm}-${dd}`);
    }
  };

  return (
    <View className="gap-1.5">
      <Text className="font-poppins-medium text-[13px] text-muted">
        {label}
      </Text>
      <Pressable
        onPress={() => setShow(true)}
        className={`h-[52px] flex-row items-center rounded-xl border px-4 ${
          error ? "border-red-500" : "border-surface-border"
        } bg-surface`}
      >
        <Calendar size={18} color="#525252" style={{ marginRight: 8 }} />
        <Text
          className={`flex-1 font-poppins text-[15px] ${value ? "text-primary" : "text-[#525252]"}`}
        >
          {formatDisplay(value)}
        </Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleChange}
          themeVariant="dark"
        />
      )}
      {error ? (
        <Text className="font-poppins text-xs text-red-500">{error}</Text>
      ) : null}
    </View>
  );
}
```

- [x] **Step 4: Create StatCard**

Create `apps/mobile/components/StatCard.tsx`:

```typescript
import { View, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";

type StatCardProps = {
  icon: LucideIcon;
  count: number;
  label: string;
};

export function StatCard({ icon: Icon, count, label }: StatCardProps) {
  return (
    <View className="flex-1 rounded-2xl border border-surface-border bg-surface p-4">
      <Icon size={20} color="#A078E8" />
      <Text
        className="mt-2 font-poppins-bold text-primary"
        style={{ fontSize: 24 }}
      >
        {count}
      </Text>
      <Text className="font-poppins text-xs text-muted">{label}</Text>
    </View>
  );
}
```

- [x] **Step 5: Create ClassCard**

Create `apps/mobile/components/ClassCard.tsx`:

```typescript
import { View, Text } from "react-native";
import { Clock } from "lucide-react-native";

type ClassCardProps = {
  name: string;
  startTime: string;
  endTime: string;
  instructorName?: string;
};

export function ClassCard({
  name,
  startTime,
  endTime,
  instructorName,
}: ClassCardProps) {
  return (
    <View className="flex-row items-center rounded-2xl border border-surface-border bg-surface p-4">
      <View className="flex-1">
        <Text className="font-poppins-semibold text-sm text-primary">
          {name}
        </Text>
        {instructorName ? (
          <Text className="mt-0.5 font-poppins text-xs text-muted">
            {instructorName}
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-center gap-1">
        <Clock size={14} color="#ABABAB" />
        <Text className="font-poppins text-xs text-muted">
          {startTime} – {endTime}
        </Text>
      </View>
    </View>
  );
}
```

- [x] **Step 6: Commit**

```bash
git add apps/mobile/components/GradientButton.tsx apps/mobile/components/ImagePickerField.tsx \
  apps/mobile/components/DatePickerField.tsx apps/mobile/components/StatCard.tsx \
  apps/mobile/components/ClassCard.tsx
git commit -m "feat(mobile): update GradientButton and add shared components for manager screens"
```

---

## Task 9: Mobile — M-MGR-01 Create Academy Screen

**Status:** ✅ Completed

**Files:**
- Create: `apps/mobile/app/(app)/create-academy.tsx`

- [x] **Step 1: Create the screen**

Create `apps/mobile/app/(app)/create-academy.tsx`:

```typescript
import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAcademyBodySchema, type CreateAcademyBody } from "@tatame/validators";
import type { ImagePickerAsset } from "expo-image-picker";
import { BackButton } from "@/components/BackButton";
import { FormInput } from "@/components/FormInput";
import { GradientButton } from "@/components/GradientButton";
import { ImagePickerField } from "@/components/ImagePickerField";
import { DatePickerField } from "@/components/DatePickerField";
import { useCreateAcademy } from "@/lib/hooks/use-academy";
import { useUploadImage } from "@/lib/hooks/use-upload";

export default function CreateAcademyScreen() {
  const router = useRouter();
  const createAcademy = useCreateAcademy();
  const uploadImage = useUploadImage();
  const [imageAsset, setImageAsset] = useState<ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateAcademyBody>({
    resolver: zodResolver(createAcademyBodySchema),
    defaultValues: {
      name: "",
      logoUrl: null,
      address: null,
      contactEmail: null,
      contactPhone: null,
      foundedAt: null,
    },
  });

  const onSubmit = async (data: CreateAcademyBody) => {
    setSubmitting(true);
    setGeneralError("");
    try {
      let logoUrl = data.logoUrl;

      if (imageAsset) {
        const uploaded = await uploadImage.mutateAsync({
          uri: imageAsset.uri,
          type: imageAsset.mimeType ?? "image/jpeg",
          name: imageAsset.fileName ?? "logo.jpg",
        });
        logoUrl = uploaded.url;
      }

      await createAcademy.mutateAsync({ ...data, logoUrl });
      router.replace("/(app)/(manager)/(home)");
    } catch (e) {
      setGeneralError(
        e instanceof Error ? e.message : "Failed to create academy",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="flex-1 px-6 pt-2">
          <BackButton />

          <View className="mt-4 gap-2">
            <Text
              className="font-poppins-bold text-primary"
              style={{ fontSize: 28, letterSpacing: -1 }}
            >
              Create Academy
            </Text>
            <Text className="font-poppins text-[15px] text-[#525252]">
              Set up your BJJ academy
            </Text>
          </View>

          <ScrollView
            className="mt-6 flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-4 pb-4">
              <ImagePickerField
                label="Academy Logo"
                imageUri={imageAsset?.uri ?? null}
                onImageSelected={setImageAsset}
              />

              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Academy Name"
                    placeholder="Enter academy name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    error={errors.name?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="address"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Address"
                    placeholder="Street, city, state"
                    value={value ?? ""}
                    onChangeText={(t) => onChange(t || null)}
                    onBlur={onBlur}
                    error={errors.address?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="contactEmail"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Contact Email"
                    placeholder="academy@email.com"
                    value={value ?? ""}
                    onChangeText={(t) => onChange(t || null)}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={errors.contactEmail?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="contactPhone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Contact Phone"
                    placeholder="(11) 99999-9999"
                    value={value ?? ""}
                    onChangeText={(t) => onChange(t || null)}
                    onBlur={onBlur}
                    keyboardType="phone-pad"
                    error={errors.contactPhone?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="foundedAt"
                render={({ field: { onChange, value } }) => (
                  <DatePickerField
                    label="Founded Date"
                    value={value ?? null}
                    onChange={onChange}
                    error={errors.foundedAt?.message}
                  />
                )}
              />
            </View>
          </ScrollView>

          {generalError ? (
            <Text className="mb-2 font-poppins text-sm text-red-500">
              {generalError}
            </Text>
          ) : null}

          <View className="pb-2">
            {submitting ? (
              <View className="h-14 items-center justify-center rounded-xl bg-accent">
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : (
              <GradientButton
                label="Create Academy"
                onPress={handleSubmit(onSubmit)}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/create-academy.tsx
git commit -m "feat(mobile): add M-MGR-01 Create Academy screen"
```

---

## Task 10: Mobile — M-MGR-02 Manager Dashboard

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(home)/index.tsx`

- [ ] **Step 1: Create the dashboard screen**

Create `apps/mobile/app/(app)/(manager)/(home)/index.tsx`:

```typescript
import { View, Text, ScrollView, RefreshControl, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Settings,
  Users,
  Clock,
  Calendar,
  CreditCard,
  ChevronRight,
} from "lucide-react-native";
import { useAcademyContext } from "@/lib/academy-context";
import { useAcademyStats } from "@/lib/hooks/use-academy";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useApi } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StatCard } from "@/components/StatCard";
import { ClassCard } from "@/components/ClassCard";
import { useState } from "react";

export default function ManagerDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { academyId, academyName, academyLogoUrl } = useAcademyContext();
  const { data: user } = useCurrentUser();
  const { data: stats } = useAcademyStats(academyId);
  const [refreshing, setRefreshing] = useState(false);

  // Note: The existing GET /v1/classes endpoint returns class data with instructorId
  // but not instructorName. For the MVP dashboard, we display the class name and time
  // only. The instructorName field will be added when implementing M-MGR-07/08/09.
  const dayOfWeek = new Date().getDay();
  const api = useApi();
  const { data: classesData } = useQuery({
    queryKey: ["classes", academyId, dayOfWeek],
    queryFn: () =>
      api.get<{ items: Array<{ id: string; name: string; startTime: string; endTime: string }> }>(
        `/classes?academyId=${academyId}&dayOfWeek=${dayOfWeek}`,
      ),
  });

  const todayClasses = classesData?.items?.slice(0, 3) ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["academy-stats", academyId] }),
      queryClient.invalidateQueries({
        queryKey: ["classes", academyId, dayOfWeek],
      }),
    ]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#A078E8"
          />
        }
      >
        <View className="px-6 pb-8 pt-2">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              {academyLogoUrl ? (
                <Image
                  source={{ uri: academyLogoUrl }}
                  className="h-10 w-10 rounded-full"
                />
              ) : (
                <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                  <Text className="font-poppins-bold text-sm text-accent">
                    {academyName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text className="font-poppins-semibold text-base text-primary">
                  {academyName}
                </Text>
                <Text className="font-poppins text-xs text-muted">
                  Manager Dashboard
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push("/(app)/(manager)/(home)/settings")}
              className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
            >
              <Settings size={20} color="#ABABAB" />
            </Pressable>
          </View>

          {/* Stats Grid */}
          <View className="mt-6 gap-3">
            <View className="flex-row gap-3">
              <StatCard
                icon={Users}
                count={stats?.activeMembers ?? 0}
                label="Active Members"
              />
              <StatCard
                icon={Clock}
                count={stats?.pendingRequests ?? 0}
                label="Pending Requests"
              />
            </View>
            <View className="flex-row gap-3">
              <StatCard
                icon={Calendar}
                count={stats?.classesToday ?? 0}
                label="Classes Today"
              />
              <StatCard
                icon={CreditCard}
                count={stats?.activePlans ?? 0}
                label="Active Plans"
              />
            </View>
          </View>

          {/* Quick Actions */}
          <View className="mt-6 gap-3">
            <Text className="font-poppins-semibold text-base text-primary">
              Quick Actions
            </Text>
            <View className="flex-row gap-3">
              <Pressable className="flex-1 flex-row items-center gap-2 rounded-xl border border-surface-border bg-surface p-3">
                <Clock size={18} color="#A078E8" />
                <Text className="font-poppins-medium text-sm text-primary">
                  Pending Requests
                </Text>
              </Pressable>
              <Pressable className="flex-1 flex-row items-center gap-2 rounded-xl border border-surface-border bg-surface p-3">
                <Calendar size={18} color="#A078E8" />
                <Text className="font-poppins-medium text-sm text-primary">
                  Today's Schedule
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Today's Classes */}
          <View className="mt-6 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-poppins-semibold text-base text-primary">
                Today's Classes
              </Text>
              {todayClasses.length > 0 && (
                <Pressable className="flex-row items-center gap-1">
                  <Text className="font-poppins-medium text-sm text-accent">
                    See all
                  </Text>
                  <ChevronRight size={16} color="#A078E8" />
                </Pressable>
              )}
            </View>
            {todayClasses.length === 0 ? (
              <View className="items-center rounded-2xl border border-surface-border bg-surface py-8">
                <Text className="font-poppins text-sm text-muted">
                  No classes scheduled for today
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {todayClasses.map((cls) => (
                  <ClassCard
                    key={cls.id}
                    name={cls.name}
                    startTime={cls.startTime}
                    endTime={cls.endTime}
                  />
                ))}
              </View>
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
git add apps/mobile/app/\(app\)/\(manager\)/\(home\)/index.tsx
git commit -m "feat(mobile): add M-MGR-02 Manager Dashboard screen"
```

---

## Task 11: Mobile — M-MGR-03 Academy Settings

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/(home)/settings.tsx`

- [ ] **Step 1: Create the settings screen**

Create `apps/mobile/app/(app)/(manager)/(home)/settings.tsx`:

```typescript
import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateAcademyBodySchema, type UpdateAcademyBody } from "@tatame/validators";
import type { ImagePickerAsset } from "expo-image-picker";
import { BackButton } from "@/components/BackButton";
import { FormInput } from "@/components/FormInput";
import { GradientButton } from "@/components/GradientButton";
import { ImagePickerField } from "@/components/ImagePickerField";
import { DatePickerField } from "@/components/DatePickerField";
import { useAcademyContext } from "@/lib/academy-context";
import { useAcademy, useUpdateAcademy } from "@/lib/hooks/use-academy";
import { useUploadImage } from "@/lib/hooks/use-upload";

export default function AcademySettingsScreen() {
  const router = useRouter();
  const { academyId } = useAcademyContext();
  const { data: academy, isLoading } = useAcademy(academyId);
  const updateAcademy = useUpdateAcademy(academyId);
  const uploadImage = useUploadImage();
  const [imageAsset, setImageAsset] = useState<ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<UpdateAcademyBody>({
    resolver: zodResolver(updateAcademyBodySchema),
  });

  useEffect(() => {
    if (academy) {
      reset({
        name: academy.name,
        logoUrl: academy.logoUrl,
        address: academy.address,
        contactEmail: academy.contactEmail,
        contactPhone: academy.contactPhone,
        foundedAt: academy.foundedAt,
      });
    }
  }, [academy, reset]);

  const onSubmit = async (data: UpdateAcademyBody) => {
    setSubmitting(true);
    setGeneralError("");
    try {
      const changes: Record<string, unknown> = {};

      for (const key of Object.keys(dirtyFields)) {
        changes[key] = data[key as keyof UpdateAcademyBody];
      }

      if (imageAsset) {
        const uploaded = await uploadImage.mutateAsync({
          uri: imageAsset.uri,
          type: imageAsset.mimeType ?? "image/jpeg",
          name: imageAsset.fileName ?? "logo.jpg",
        });
        changes.logoUrl = uploaded.url;
      }

      if (Object.keys(changes).length === 0) return;

      await updateAcademy.mutateAsync(changes);
      setSaved(true);
      setTimeout(() => {
        router.back();
      }, 1000);
    } catch (e) {
      setGeneralError(
        e instanceof Error ? e.message : "Failed to save changes",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const hasChanges = isDirty || !!imageAsset;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="flex-1 px-6 pt-2">
          <BackButton />

          <View className="mt-4 gap-2">
            <Text
              className="font-poppins-bold text-primary"
              style={{ fontSize: 28, letterSpacing: -1 }}
            >
              Academy Settings
            </Text>
            <Text className="font-poppins text-[15px] text-[#525252]">
              Update your academy information
            </Text>
          </View>

          <ScrollView
            className="mt-6 flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-4 pb-4">
              <ImagePickerField
                label="Academy Logo"
                imageUri={imageAsset?.uri ?? academy?.logoUrl ?? null}
                onImageSelected={setImageAsset}
              />

              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Academy Name"
                    placeholder="Enter academy name"
                    value={value ?? ""}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    error={errors.name?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="address"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Address"
                    placeholder="Street, city, state"
                    value={value ?? ""}
                    onChangeText={(t) => onChange(t || null)}
                    onBlur={onBlur}
                    error={errors.address?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="contactEmail"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Contact Email"
                    placeholder="academy@email.com"
                    value={value ?? ""}
                    onChangeText={(t) => onChange(t || null)}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={errors.contactEmail?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="contactPhone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Contact Phone"
                    placeholder="(11) 99999-9999"
                    value={value ?? ""}
                    onChangeText={(t) => onChange(t || null)}
                    onBlur={onBlur}
                    keyboardType="phone-pad"
                    error={errors.contactPhone?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="foundedAt"
                render={({ field: { onChange, value } }) => (
                  <DatePickerField
                    label="Founded Date"
                    value={value ?? null}
                    onChange={onChange}
                    error={errors.foundedAt?.message}
                  />
                )}
              />
            </View>
          </ScrollView>

          {generalError ? (
            <Text className="mb-2 font-poppins text-sm text-red-500">
              {generalError}
            </Text>
          ) : null}

          <View className="pb-2">
            {saved ? (
              <View className="h-14 items-center justify-center rounded-xl bg-accent">
                <Text className="font-poppins-semibold text-base text-white">
                  Saved!
                </Text>
              </View>
            ) : (
              <GradientButton
                label="Save Changes"
                onPress={handleSubmit(onSubmit)}
                disabled={!hasChanges}
                loading={submitting}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/\(manager\)/\(home\)/settings.tsx
git commit -m "feat(mobile): add M-MGR-03 Academy Settings screen"
```

---

## Task 12: Verify Full Build + Final Commit

- [ ] **Step 1: Build all packages**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2
pnpm build
```
Expected: all packages build without errors.

- [ ] **Step 2: Run API tests**

```bash
pnpm --filter @tatame/api test
```
Expected: all tests pass.

- [ ] **Step 3: Type-check mobile**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/mobile
npx tsc --noEmit
```
Expected: no type errors.

- [ ] **Step 4: Test mobile app manually**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/mobile
pnpm dev
```

Verify:
- App redirects correctly based on role + academy status
- Create Academy form submits successfully
- Dashboard loads stats and today's classes
- Settings pre-fills and saves changes
- Tab navigation works between tabs

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address build issues from manager core screens implementation"
```
