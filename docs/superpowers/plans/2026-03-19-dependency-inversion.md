# Dependency Inversion Refactoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor 4 existing API modules to use Repository Pattern with Constructor Injection, decoupling business logic from Drizzle ORM.

**Architecture:** Each module gets an interface file (`{module}.repository.ts`), a Postgres implementation (`{module}.repository.postgres.ts`), a service class (`{module}.service.ts`), and updated routes that wire concrete repos into services. A shared `RepoFactory` type enables cross-repo transactions.

**Tech Stack:** TypeScript, Drizzle ORM, Express, PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-19-dependency-inversion-design.md`

**Note:** No tests are written in this plan. The refactoring preserves existing behavior exactly.

---

## File Map

### New files to create

| File                                                                | Purpose                                                                                |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/api/src/lib/repo-factory.ts`                                  | Shared `RepoFactory<T>` type                                                           |
| `apps/api/src/modules/user/user.repository.ts`                      | `IUserRepository` interface + `UserRow`, `UserRoleRow` types                           |
| `apps/api/src/modules/user/user.repository.postgres.ts`             | `PostgresUserRepository`                                                               |
| `apps/api/src/modules/academy/academy.repository.ts`                | `IAcademyRepository` interface + `AcademyRow` type                                     |
| `apps/api/src/modules/academy/academy.repository.postgres.ts`       | `PostgresAcademyRepository`                                                            |
| `apps/api/src/modules/class/class.repository.ts`                    | `IClassRepository` interface + `ClassRow` type                                         |
| `apps/api/src/modules/class/class.repository.postgres.ts`           | `PostgresClassRepository`                                                              |
| `apps/api/src/modules/membership/membership.repository.ts`          | `IMembershipRepository` interface + `MembershipRow`, `PendingMembershipWithUser` types |
| `apps/api/src/modules/membership/membership.repository.postgres.ts` | `PostgresMembershipRepository`                                                         |

### Files to rewrite

| File                                                    | Change                                     |
| ------------------------------------------------------- | ------------------------------------------ |
| `apps/api/src/modules/user/user.service.ts`             | Free functions → `UserService` class       |
| `apps/api/src/modules/academy/academy.service.ts`       | Free functions → `AcademyService` class    |
| `apps/api/src/modules/class/class.service.ts`           | Free functions → `ClassService` class      |
| `apps/api/src/modules/membership/membership.service.ts` | Free functions → `MembershipService` class |

### Files to modify

| File                                                   | Change                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `apps/api/src/modules/user/user.routes.ts`             | Wire `UserService` with `PostgresUserRepository`                         |
| `apps/api/src/modules/academy/academy.routes.ts`       | Wire `AcademyService` with repos + factory                               |
| `apps/api/src/modules/class/class.routes.ts`           | Wire `ClassService` with repos                                           |
| `apps/api/src/modules/membership/membership.routes.ts` | Wire `MembershipService` with repos                                      |
| `apps/api/src/modules/auth/clerk-webhook.handler.ts`   | Wire `UserService`, move Clerk DTO extraction here                       |
| `apps/api/src/middleware/academy-context.ts`           | Use `PostgresMembershipRepository` directly instead of old free function |

---

## Task 1: Create shared RepoFactory type

**Files:**

- Create: `apps/api/src/lib/repo-factory.ts`

- [x] **Step 1: Create the RepoFactory type file**

```typescript
// apps/api/src/lib/repo-factory.ts
import type { Database } from "@tatame/db";

export type RepoFactory<T> = (db: Database) => T;
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors (new file is not imported yet, so no impact)

- [x] **Step 3: Commit**

```bash
git add apps/api/src/lib/repo-factory.ts
git commit -m "feat(api): add shared RepoFactory type for transactional DI"
```

---

## Task 2: User module — repository interface + Postgres implementation

**Files:**

- Create: `apps/api/src/modules/user/user.repository.ts`
- Create: `apps/api/src/modules/user/user.repository.postgres.ts`

- [x] **Step 1: Create `IUserRepository` interface**

```typescript
// apps/api/src/modules/user/user.repository.ts
import type { InferSelectModel } from "drizzle-orm";
import type { users, userRoles } from "@tatame/db";

export type UserRow = InferSelectModel<typeof users>;
export type UserRoleRow = InferSelectModel<typeof userRoles>;

export interface IUserRepository {
  upsert(data: {
    clerkUserId: string;
    email: string;
    name: string;
    profileImageUrl: string | null;
  }): Promise<void>;

  deleteByClerkId(clerkUserId: string): Promise<void>;

  findByClerkId(clerkUserId: string): Promise<UserRow | undefined>;

  findActiveRole(userId: string): Promise<string | undefined>;

  hasActiveRole(userId: string): Promise<boolean>;

  insertRole(data: {
    userId: string;
    role: string;
    isActive: boolean;
    startedAt: Date;
    endedAt: Date | null;
  }): Promise<void>;
}
```

- [x] **Step 2: Create `PostgresUserRepository`**

Extract all Drizzle queries from `user.service.ts` into this class.

```typescript
// apps/api/src/modules/user/user.repository.postgres.ts
import { and, eq } from "drizzle-orm";
import { users, userRoles, type Database } from "@tatame/db";
import type { IUserRepository, UserRow } from "./user.repository.js";

export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly db: Database) {}

  async upsert(data: {
    clerkUserId: string;
    email: string;
    name: string;
    profileImageUrl: string | null;
  }): Promise<void> {
    await this.db
      .insert(users)
      .values({
        clerkUserId: data.clerkUserId,
        email: data.email,
        name: data.name,
        profileImageUrl: data.profileImageUrl,
      })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: {
          email: data.email,
          name: data.name,
          profileImageUrl: data.profileImageUrl,
          updatedAt: new Date(),
        },
      });
  }

  async deleteByClerkId(clerkUserId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.clerkUserId, clerkUserId));
  }

  async findByClerkId(clerkUserId: string): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);
    return row;
  }

  async findActiveRole(userId: string): Promise<string | undefined> {
    const [row] = await this.db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.isActive, true)))
      .limit(1);
    return row?.role;
  }

  async hasActiveRole(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.isActive, true)))
      .limit(1);
    return !!row;
  }

  async insertRole(data: {
    userId: string;
    role: string;
    isActive: boolean;
    startedAt: Date;
    endedAt: Date | null;
  }): Promise<void> {
    await this.db.insert(userRoles).values(data);
  }
}
```

- [x] **Step 3: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [x] **Step 4: Commit**

```bash
git add apps/api/src/modules/user/user.repository.ts apps/api/src/modules/user/user.repository.postgres.ts
git commit -m "feat(api): add IUserRepository interface and Postgres implementation"
```

---

## Task 3: User module — rewrite service as class

**Files:**

- Rewrite: `apps/api/src/modules/user/user.service.ts`

- [x] **Step 1: Rewrite `user.service.ts` as `UserService` class**

The service receives `IUserRepository` via constructor. The `primaryEmail` and `displayName` Clerk helpers are removed from this file — they move to the webhook handler in Task 5.

```typescript
// apps/api/src/modules/user/user.service.ts
import type { IUserRepository } from "./user.repository.js";
import type { Role } from "@tatame/types";

export class UserService {
  constructor(private readonly userRepo: IUserRepository) {}

  async upsertFromClerk(data: {
    clerkUserId: string;
    email: string;
    name: string;
    profileImageUrl: string | null;
  }): Promise<void> {
    await this.userRepo.upsert(data);
  }

  async deleteByClerkId(clerkUserId: string): Promise<void> {
    await this.userRepo.deleteByClerkId(clerkUserId);
  }

  async getByClerkId(clerkUserId: string) {
    return this.userRepo.findByClerkId(clerkUserId);
  }

  async getActiveRole(userId: string): Promise<Role | null> {
    const role = await this.userRepo.findActiveRole(userId);
    return (role as Role) ?? null;
  }

  async assignInitialRole(userId: string, role: Role): Promise<boolean> {
    const exists = await this.userRepo.hasActiveRole(userId);
    if (exists) return false;

    await this.userRepo.insertRole({
      userId,
      role,
      isActive: true,
      startedAt: new Date(),
      endedAt: null,
    });
    return true;
  }
}
```

- [x] **Step 2: Verify TypeScript compiles (expect errors in routes/webhook — will be fixed in Tasks 4-5)**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Errors in `user.routes.ts` and `clerk-webhook.handler.ts` (they still import old functions)

- [x] **Step 3: Commit**

```bash
git add apps/api/src/modules/user/user.service.ts
git commit -m "refactor(api): convert user service to class with constructor injection"
```

---

## Task 4: User module — update routes

**Files:**

- Modify: `apps/api/src/modules/user/user.routes.ts`

- [x] **Step 1: Rewrite routes to wire `UserService` with `PostgresUserRepository`**

```typescript
// apps/api/src/modules/user/user.routes.ts
import { Router } from "express";
import { getAuth } from "@clerk/express";
import {
  setInitialRoleBodySchema,
  setInitialRoleResponseSchema,
  userMeResponseSchema,
} from "@tatame/validators";
import type { SetInitialRoleBody } from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { requireSession } from "../../middleware/require-session.js";
import { validateBody } from "../../middleware/validate.js";
import { UserService } from "./user.service.js";
import { PostgresUserRepository } from "./user.repository.postgres.js";

export const userRouter = Router();

const db = getDb();
const userService = new UserService(new PostgresUserRepository(db));

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
        error:
          "Usuário não provisionado ainda; aguarde o sync do webhook do Clerk",
      });
      return;
    }

    const activeRole = await userService.getActiveRole(row.id);

    const body = {
      id: row.id,
      clerkUserId: row.clerkUserId,
      email: row.email,
      name: row.name,
      profileImageUrl: row.profileImageUrl,
      activeRole,
    };
    const parsed = userMeResponseSchema.safeParse(body);
    res.json(parsed.success ? parsed.data : body);
  } catch (e) {
    next(e);
  }
});

userRouter.post(
  "/me/role",
  requireSession,
  validateBody(setInitialRoleBodySchema),
  async (req, res, next) => {
    try {
      const { role } = req.validatedBody as SetInitialRoleBody;
      const { userId: clerkUserId } = getAuth(req);
      if (!clerkUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const userRow = await userService.getByClerkId(clerkUserId);
      if (!userRow) {
        res.status(404).json({
          error:
            "Usuário não provisionado ainda; aguarde o sync do webhook do Clerk",
        });
        return;
      }

      const created = await userService.assignInitialRole(userRow.id, role);
      if (!created) {
        res.status(409).json({
          error: "Role already set; MVP does not allow switching roles",
        });
        return;
      }

      const payload = { userId: userRow.id, role };
      const parsed = setInitialRoleResponseSchema.safeParse(payload);
      res.status(201).json(parsed.success ? parsed.data : payload);
    } catch (e) {
      next(e);
    }
  },
);
```

- [x] **Step 2: Commit**

```bash
git add apps/api/src/modules/user/user.routes.ts
git commit -m "refactor(api): wire UserService into user routes"
```

---

## Task 5: User module — update webhook handler (Clerk DTO extraction)

**Files:**

- Modify: `apps/api/src/modules/auth/clerk-webhook.handler.ts`

- [x] **Step 1: Move Clerk-specific helpers here, wire `UserService`**

The `primaryEmail` and `displayName` functions move from the old `user.service.ts` to here. The handler transforms `UserJSON` into a plain DTO before passing to `UserService`.

```typescript
// apps/api/src/modules/auth/clerk-webhook.handler.ts
import type { Request, Response } from "express";
import type { UserJSON } from "@clerk/backend";
import { verifyWebhook } from "@clerk/express/webhooks";
import { clerkWebhookSigningSecret, loadEnv } from "@tatame/config";
import { getDb } from "../../lib/db.js";
import { UserService } from "../user/user.service.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";

function primaryEmail(data: UserJSON): string | undefined {
  const list = data.email_addresses ?? [];
  const primaryId = data.primary_email_address_id;
  const chosen = primaryId ? list.find((e) => e.id === primaryId) : list[0];
  return chosen?.email_address;
}

function displayName(data: UserJSON): string {
  const parts = [data.first_name, data.last_name].filter((x): x is string =>
    Boolean(x?.trim()),
  );
  if (parts.length) return parts.join(" ");
  if (data.username) return data.username;
  return primaryEmail(data) ?? "User";
}

const db = getDb();
const userService = new UserService(new PostgresUserRepository(db));

export async function handleClerkWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  const env = loadEnv();
  const signingSecret = clerkWebhookSigningSecret(env);
  if (!signingSecret) {
    res
      .status(503)
      .json({ error: "CLERK_WEBHOOK_SIGNING_SECRET is not configured" });
    return;
  }

  try {
    const evt = await verifyWebhook(req, { signingSecret });

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const email = primaryEmail(evt.data);
      if (!email) {
        throw new Error("Clerk user has no email; cannot upsert into users");
      }
      await userService.upsertFromClerk({
        clerkUserId: evt.data.id,
        email,
        name: displayName(evt.data),
        profileImageUrl: evt.data.image_url ?? null,
      });
      res.json({ received: true });
      return;
    }

    if (evt.type === "user.deleted") {
      const id = evt.data.id;
      if (id) await userService.deleteByClerkId(id);
      res.json({ received: true });
      return;
    }

    res.json({ received: true, ignored: evt.type });
  } catch (err) {
    console.error("[clerk webhook]", err);
    res.status(400).json({ error: "Webhook verification or handling failed" });
  }
}
```

- [x] **Step 2: Verify TypeScript compiles (user module should be fully clean now)**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to user module

- [x] **Step 3: Commit**

```bash
git add apps/api/src/modules/auth/clerk-webhook.handler.ts
git commit -m "refactor(api): move Clerk DTO extraction to webhook handler, wire UserService"
```

---

## Task 6: Membership module — repository interface + Postgres implementation

**Files:**

- Create: `apps/api/src/modules/membership/membership.repository.ts`
- Create: `apps/api/src/modules/membership/membership.repository.postgres.ts`

- [x] **Step 1: Create `IMembershipRepository` interface**

```typescript
// apps/api/src/modules/membership/membership.repository.ts
import type { InferSelectModel } from "drizzle-orm";
import type { academyMemberships } from "@tatame/db";

export type MembershipRow = InferSelectModel<typeof academyMemberships>;

export type PendingMembershipWithUser = MembershipRow & {
  userName: string;
  userEmail: string;
};

export interface IMembershipRepository {
  findById(membershipId: string): Promise<MembershipRow | undefined>;
  findActiveByUser(userId: string): Promise<MembershipRow | undefined>;
  findActiveByUserAndAcademy(
    userId: string,
    academyId: string,
  ): Promise<MembershipRow | undefined>;

  existsBlockedOrRejected(userId: string, academyId: string): Promise<boolean>;
  existsPending(userId: string, academyId: string): Promise<boolean>;

  findPendingByAcademy(academyId: string): Promise<PendingMembershipWithUser[]>;

  create(data: {
    academyId: string;
    userId: string;
    role: string;
    status: string;
    isActive: boolean;
    joinedAt?: Date | null;
    leftAt?: Date | null;
  }): Promise<MembershipRow>;

  updateStatus(
    membershipId: string,
    data: {
      status?: string;
      isActive?: boolean;
      joinedAt?: Date | null;
      leftAt?: Date | null;
    },
  ): Promise<MembershipRow | undefined>;

  rejectAllPendingExcept(
    userId: string,
    excludeMembershipId: string,
  ): Promise<void>;

  deleteById(membershipId: string): Promise<void>;

  withTransaction<T>(
    fn: (txRepo: IMembershipRepository) => Promise<T>,
  ): Promise<T>;
}
```

- [x] **Step 2: Create `PostgresMembershipRepository`**

```typescript
// apps/api/src/modules/membership/membership.repository.postgres.ts
import { and, eq, inArray, ne } from "drizzle-orm";
import { academyMemberships, users, type Database } from "@tatame/db";
import type {
  IMembershipRepository,
  MembershipRow,
  PendingMembershipWithUser,
} from "./membership.repository.js";

export class PostgresMembershipRepository implements IMembershipRepository {
  constructor(private readonly db: Database) {}

  async findById(membershipId: string): Promise<MembershipRow | undefined> {
    const [row] = await this.db
      .select()
      .from(academyMemberships)
      .where(eq(academyMemberships.id, membershipId))
      .limit(1);
    return row;
  }

  async findActiveByUser(userId: string): Promise<MembershipRow | undefined> {
    const [row] = await this.db
      .select()
      .from(academyMemberships)
      .where(
        and(
          eq(academyMemberships.userId, userId),
          eq(academyMemberships.isActive, true),
        ),
      )
      .limit(1);
    return row;
  }

  async findActiveByUserAndAcademy(
    userId: string,
    academyId: string,
  ): Promise<MembershipRow | undefined> {
    const [row] = await this.db
      .select()
      .from(academyMemberships)
      .where(
        and(
          eq(academyMemberships.userId, userId),
          eq(academyMemberships.academyId, academyId),
          eq(academyMemberships.isActive, true),
          eq(academyMemberships.status, "active"),
        ),
      )
      .limit(1);
    return row;
  }

  async existsBlockedOrRejected(
    userId: string,
    academyId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: academyMemberships.id })
      .from(academyMemberships)
      .where(
        and(
          eq(academyMemberships.userId, userId),
          eq(academyMemberships.academyId, academyId),
          inArray(academyMemberships.status, ["blocked", "rejected"]),
        ),
      )
      .limit(1);
    return !!row;
  }

  async existsPending(userId: string, academyId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: academyMemberships.id })
      .from(academyMemberships)
      .where(
        and(
          eq(academyMemberships.userId, userId),
          eq(academyMemberships.academyId, academyId),
          eq(academyMemberships.status, "pending"),
        ),
      )
      .limit(1);
    return !!row;
  }

  async findPendingByAcademy(
    academyId: string,
  ): Promise<PendingMembershipWithUser[]> {
    const rows = await this.db
      .select({
        membership: academyMemberships,
        userName: users.name,
        userEmail: users.email,
      })
      .from(academyMemberships)
      .innerJoin(users, eq(academyMemberships.userId, users.id))
      .where(
        and(
          eq(academyMemberships.academyId, academyId),
          eq(academyMemberships.status, "pending"),
        ),
      );

    return rows.map((r) => ({
      ...r.membership,
      userName: r.userName,
      userEmail: r.userEmail,
    }));
  }

  async create(data: {
    academyId: string;
    userId: string;
    role: string;
    status: string;
    isActive: boolean;
    joinedAt?: Date | null;
    leftAt?: Date | null;
  }): Promise<MembershipRow> {
    const [row] = await this.db
      .insert(academyMemberships)
      .values({
        academyId: data.academyId,
        userId: data.userId,
        role: data.role,
        status: data.status,
        isActive: data.isActive,
        joinedAt: data.joinedAt ?? null,
        leftAt: data.leftAt ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to insert membership");
    return row;
  }

  async updateStatus(
    membershipId: string,
    data: {
      status?: string;
      isActive?: boolean;
      joinedAt?: Date | null;
      leftAt?: Date | null;
    },
  ): Promise<MembershipRow | undefined> {
    const [row] = await this.db
      .update(academyMemberships)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(academyMemberships.id, membershipId))
      .returning();
    return row;
  }

  async rejectAllPendingExcept(
    userId: string,
    excludeMembershipId: string,
  ): Promise<void> {
    await this.db
      .update(academyMemberships)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(
        and(
          eq(academyMemberships.userId, userId),
          eq(academyMemberships.status, "pending"),
          ne(academyMemberships.id, excludeMembershipId),
        ),
      );
  }

  async deleteById(membershipId: string): Promise<void> {
    await this.db
      .delete(academyMemberships)
      .where(eq(academyMemberships.id, membershipId));
  }

  async withTransaction<T>(
    fn: (txRepo: IMembershipRepository) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      const txRepo = new PostgresMembershipRepository(
        tx as unknown as Database,
      );
      return fn(txRepo);
    });
  }
}
```

- [x] **Step 3: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20`

- [x] **Step 4: Commit**

```bash
git add apps/api/src/modules/membership/membership.repository.ts apps/api/src/modules/membership/membership.repository.postgres.ts
git commit -m "feat(api): add IMembershipRepository interface and Postgres implementation"
```

---

## Task 7: Academy module — repository interface + Postgres implementation

**Files:**

- Create: `apps/api/src/modules/academy/academy.repository.ts`
- Create: `apps/api/src/modules/academy/academy.repository.postgres.ts`

- [x] **Step 1: Create `IAcademyRepository` interface**

```typescript
// apps/api/src/modules/academy/academy.repository.ts
import type { InferSelectModel } from "drizzle-orm";
import type { academies } from "@tatame/db";
import type { RepoFactory } from "../../lib/repo-factory.js";

export type AcademyRow = InferSelectModel<typeof academies>;

export interface IAcademyRepository {
  findById(academyId: string): Promise<AcademyRow | undefined>;

  searchByName(query: string, limit: number): Promise<AcademyRow[]>;

  create(data: {
    ownerId: string;
    name: string;
    logoUrl: string | null;
    address: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    foundedAt: string | null;
  }): Promise<AcademyRow>;

  update(
    academyId: string,
    data: Partial<{
      name: string;
      logoUrl: string | null;
      address: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      foundedAt: string | null;
    }>,
  ): Promise<AcademyRow | undefined>;

  withTransaction<T>(
    fn: (
      txRepo: IAcademyRepository,
      createRepo: <R>(factory: RepoFactory<R>) => R,
    ) => Promise<T>,
  ): Promise<T>;
}
```

- [x] **Step 2: Create `PostgresAcademyRepository`**

```typescript
// apps/api/src/modules/academy/academy.repository.postgres.ts
import { eq, ilike } from "drizzle-orm";
import { academies, type Database } from "@tatame/db";
import type { IAcademyRepository, AcademyRow } from "./academy.repository.js";
import type { RepoFactory } from "../../lib/repo-factory.js";

export class PostgresAcademyRepository implements IAcademyRepository {
  constructor(private readonly db: Database) {}

  async findById(academyId: string): Promise<AcademyRow | undefined> {
    const [row] = await this.db
      .select()
      .from(academies)
      .where(eq(academies.id, academyId))
      .limit(1);
    return row;
  }

  async searchByName(query: string, limit: number): Promise<AcademyRow[]> {
    return this.db
      .select()
      .from(academies)
      .where(ilike(academies.name, `%${query}%`))
      .limit(limit);
  }

  async create(data: {
    ownerId: string;
    name: string;
    logoUrl: string | null;
    address: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    foundedAt: string | null;
  }): Promise<AcademyRow> {
    const [row] = await this.db.insert(academies).values(data).returning();
    if (!row) throw new Error("Failed to insert academy");
    return row;
  }

  async update(
    academyId: string,
    data: Partial<{
      name: string;
      logoUrl: string | null;
      address: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      foundedAt: string | null;
    }>,
  ): Promise<AcademyRow | undefined> {
    const [row] = await this.db
      .update(academies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(academies.id, academyId))
      .returning();
    return row;
  }

  async withTransaction<T>(
    fn: (
      txRepo: IAcademyRepository,
      createRepo: <R>(factory: RepoFactory<R>) => R,
    ) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      const txDb = tx as unknown as Database;
      const txRepo = new PostgresAcademyRepository(txDb);
      const createRepo = <R>(factory: RepoFactory<R>): R => factory(txDb);
      return fn(txRepo, createRepo);
    });
  }
}
```

- [x] **Step 3: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20`

- [x] **Step 4: Commit**

```bash
git add apps/api/src/modules/academy/academy.repository.ts apps/api/src/modules/academy/academy.repository.postgres.ts
git commit -m "feat(api): add IAcademyRepository interface and Postgres implementation"
```

---

## Task 8: Academy module — rewrite service as class + update routes

**Files:**

- Rewrite: `apps/api/src/modules/academy/academy.service.ts`
- Modify: `apps/api/src/modules/academy/academy.routes.ts`

- [x] **Step 1: Rewrite `academy.service.ts` as `AcademyService` class**

```typescript
// apps/api/src/modules/academy/academy.service.ts
import type { IAcademyRepository } from "./academy.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { CreateAcademyBody, UpdateAcademyBody } from "@tatame/validators";
import type { RepoFactory } from "../../lib/repo-factory.js";
import { HttpError } from "../../lib/http-error.js";

export class AcademyService {
  constructor(
    private readonly academyRepo: IAcademyRepository,
    private readonly membershipRepoFactory: RepoFactory<IMembershipRepository>,
  ) {}

  async createWithManagerMembership(
    ownerUserId: string,
    body: CreateAcademyBody,
  ) {
    return this.academyRepo.withTransaction(
      async (txAcademyRepo, createRepo) => {
        const created = await txAcademyRepo.create({
          ownerId: ownerUserId,
          name: body.name,
          logoUrl: body.logoUrl ?? null,
          address: body.address ?? null,
          contactEmail: body.contactEmail ?? null,
          contactPhone: body.contactPhone ?? null,
          foundedAt: body.foundedAt ?? null,
        });

        const txMembershipRepo = createRepo(this.membershipRepoFactory);
        await txMembershipRepo.create({
          academyId: created.id,
          userId: ownerUserId,
          role: "manager",
          status: "active",
          isActive: true,
          joinedAt: new Date(),
          leftAt: null,
        });

        return created;
      },
    );
  }

  async getById(academyId: string) {
    return this.academyRepo.findById(academyId);
  }

  async searchByName(q: string, limit = 50) {
    const term = q.trim();
    if (!term) return [];
    return this.academyRepo.searchByName(term, limit);
  }

  async update(
    academyId: string,
    ownerUserId: string,
    body: UpdateAcademyBody,
  ) {
    await this.assertManagerOwnsAcademy(ownerUserId, academyId);

    const updated = await this.academyRepo.update(academyId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.contactEmail !== undefined
        ? { contactEmail: body.contactEmail }
        : {}),
      ...(body.contactPhone !== undefined
        ? { contactPhone: body.contactPhone }
        : {}),
      ...(body.foundedAt !== undefined ? { foundedAt: body.foundedAt } : {}),
    });
    if (!updated) {
      throw new HttpError(404, "Academy not found");
    }
    return updated;
  }

  private async assertManagerOwnsAcademy(userId: string, academyId: string) {
    const academy = await this.academyRepo.findById(academyId);
    if (!academy) {
      throw new HttpError(404, "Academy not found");
    }
    if (academy.ownerId !== userId) {
      throw new HttpError(403, "You do not manage this academy");
    }
  }
}
```

- [x] **Step 2: Rewrite `academy.routes.ts` to wire `AcademyService`**

```typescript
// apps/api/src/modules/academy/academy.routes.ts
import { Router } from "express";
import { Role } from "@tatame/types";
import type { CreateAcademyBody, UpdateAcademyBody } from "@tatame/validators";
import {
  academyIdParamSchema,
  createAcademyBodySchema,
  updateAcademyBodySchema,
} from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import { attachActiveAcademyContext } from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { requireSession } from "../../middleware/require-session.js";
import { validateBody } from "../../middleware/validate.js";
import { AcademyService } from "./academy.service.js";
import { PostgresAcademyRepository } from "./academy.repository.postgres.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";

export const academyRouter = Router();

const db = getDb();
const academyService = new AcademyService(
  new PostgresAcademyRepository(db),
  (txDb) => new PostgresMembershipRepository(txDb),
);

academyRouter.get("/", requireSession, async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const rows = await academyService.searchByName(q);
    res.json({ items: rows });
  } catch (e) {
    next(e);
  }
});

academyRouter.get("/:academyId", requireSession, async (req, res, next) => {
  try {
    const params = academyIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw new HttpError(400, "Invalid academy id");
    }
    const row = await academyService.getById(params.data.academyId);
    if (!row) {
      throw new HttpError(404, "Academy not found");
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
});

academyRouter.post(
  "/",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  validateBody(createAcademyBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as CreateAcademyBody;
      const userId = req.appAuth!.userId;
      const created = await academyService.createWithManagerMembership(
        userId,
        body,
      );
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

academyRouter.patch(
  "/:academyId",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  validateBody(updateAcademyBodySchema),
  async (req, res, next) => {
    try {
      const params = academyIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid academy id");
      }
      const body = req.validatedBody as UpdateAcademyBody;
      if (Object.keys(body).length === 0) {
        throw new HttpError(400, "At least one field is required");
      }
      const userId = req.appAuth!.userId;
      const updated = await academyService.update(
        params.data.academyId,
        userId,
        body,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);
```

- [x] **Step 3: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Errors in `class.service.ts` and `membership.service.ts` (they still import old `assertManagerOwnsAcademy`)

- [x] **Step 4: Commit**

```bash
git add apps/api/src/modules/academy/academy.service.ts apps/api/src/modules/academy/academy.routes.ts
git commit -m "refactor(api): convert academy service to class, wire into routes"
```

---

## Task 9: Class module — repository interface + Postgres implementation

**Files:**

- Create: `apps/api/src/modules/class/class.repository.ts`
- Create: `apps/api/src/modules/class/class.repository.postgres.ts`

- [x] **Step 1: Create `IClassRepository` interface**

```typescript
// apps/api/src/modules/class/class.repository.ts
import type { InferSelectModel } from "drizzle-orm";
import type { classes } from "@tatame/db";

export type ClassRow = InferSelectModel<typeof classes>;

export interface IClassRepository {
  findByAcademyId(
    academyId: string,
    filters: {
      dayOfWeek?: number;
      includeInactive?: boolean;
      instructorId?: string;
    },
  ): Promise<ClassRow[]>;

  findById(classId: string, academyId: string): Promise<ClassRow | undefined>;

  create(data: {
    academyId: string;
    instructorId: string;
    name: string;
    description: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    capacity: number | null;
    isActive: boolean;
  }): Promise<ClassRow>;

  update(
    classId: string,
    data: Partial<{
      name: string;
      description: string | null;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      capacity: number | null;
      instructorId: string;
      isActive: boolean;
    }>,
  ): Promise<ClassRow | undefined>;
}
```

- [x] **Step 2: Create `PostgresClassRepository`**

```typescript
// apps/api/src/modules/class/class.repository.postgres.ts
import { and, eq } from "drizzle-orm";
import { classes, type Database } from "@tatame/db";
import type { IClassRepository, ClassRow } from "./class.repository.js";

export class PostgresClassRepository implements IClassRepository {
  constructor(private readonly db: Database) {}

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
    return this.db
      .select()
      .from(classes)
      .where(and(...conditions))
      .orderBy(classes.dayOfWeek, classes.startTime);
  }

  async findById(
    classId: string,
    academyId: string,
  ): Promise<ClassRow | undefined> {
    const [row] = await this.db
      .select()
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.academyId, academyId)))
      .limit(1);
    return row;
  }

  async create(data: {
    academyId: string;
    instructorId: string;
    name: string;
    description: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    capacity: number | null;
    isActive: boolean;
  }): Promise<ClassRow> {
    const [row] = await this.db.insert(classes).values(data).returning();
    if (!row) throw new Error("Failed to insert class");
    return row;
  }

  async update(
    classId: string,
    data: Partial<{
      name: string;
      description: string | null;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      capacity: number | null;
      instructorId: string;
      isActive: boolean;
    }>,
  ): Promise<ClassRow | undefined> {
    const [row] = await this.db
      .update(classes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(classes.id, classId))
      .returning();
    return row;
  }
}
```

- [x] **Step 3: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20`

- [x] **Step 4: Commit**

```bash
git add apps/api/src/modules/class/class.repository.ts apps/api/src/modules/class/class.repository.postgres.ts
git commit -m "feat(api): add IClassRepository interface and Postgres implementation"
```

---

## Task 10: Class module — rewrite service as class + update routes

**Files:**

- Rewrite: `apps/api/src/modules/class/class.service.ts`
- Modify: `apps/api/src/modules/class/class.routes.ts`

- [x] **Step 1: Rewrite `class.service.ts` as `ClassService` class**

```typescript
// apps/api/src/modules/class/class.service.ts
import type { IClassRepository } from "./class.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { CreateClassBody, UpdateClassBody } from "@tatame/validators";
import type { Role } from "@tatame/types";
import { HttpError } from "../../lib/http-error.js";

export type ClassAuthContext = {
  userId: string;
  role: Role;
  activeAcademyId: string;
};

function normalizeTime(t: string): string {
  const parts = t.split(":");
  const h = parts[0] ?? "0";
  const m = parts[1] ?? "0";
  if (parts.length === 2) return `${h.padStart(2, "0")}:${m}:00`;
  if (parts.length === 3) {
    const s = parts[2] ?? "00";
    return `${h.padStart(2, "0")}:${m}:${s}`;
  }
  return t;
}

function assertEndAfterStart(start: string, end: string): void {
  if (normalizeTime(end) <= normalizeTime(start)) {
    throw new HttpError(400, "endTime must be after startTime");
  }
}

export class ClassService {
  constructor(
    private readonly classRepo: IClassRepository,
    private readonly membershipRepo: IMembershipRepository,
    private readonly academyRepo: IAcademyRepository,
  ) {}

  async list(
    ctx: ClassAuthContext,
    query: { dayOfWeek?: number; includeInactive?: boolean },
  ) {
    const includeInactive =
      ctx.role === "manager" ? Boolean(query.includeInactive) : false;
    const instructorId = ctx.role === "instructor" ? ctx.userId : undefined;
    return this.classRepo.findByAcademyId(ctx.activeAcademyId, {
      dayOfWeek: query.dayOfWeek,
      includeInactive,
      instructorId,
    });
  }

  async getById(ctx: ClassAuthContext, classId: string) {
    const row = await this.classRepo.findById(classId, ctx.activeAcademyId);
    if (!row) throw new HttpError(404, "Class not found");
    if (ctx.role === "student" && !row.isActive) {
      throw new HttpError(404, "Class not found");
    }
    if (ctx.role === "instructor" && row.instructorId !== ctx.userId) {
      throw new HttpError(403, "You can only view your own classes");
    }
    return row;
  }

  async create(ctx: ClassAuthContext, body: CreateClassBody) {
    const startTime = normalizeTime(body.startTime);
    const endTime = normalizeTime(body.endTime);
    assertEndAfterStart(startTime, endTime);

    if (ctx.role === "manager") {
      await this.assertManagerOwnsAcademy(ctx.userId, ctx.activeAcademyId);
      await this.assertCanTeach(ctx.activeAcademyId, body.instructorId);
    } else if (ctx.role === "instructor") {
      if (body.instructorId !== ctx.userId) {
        throw new HttpError(
          403,
          "Instructors can only create classes for themselves",
        );
      }
      await this.assertCanTeach(ctx.activeAcademyId, ctx.userId);
    } else {
      throw new HttpError(403, "Forbidden");
    }

    const created = await this.classRepo.create({
      academyId: ctx.activeAcademyId,
      instructorId: body.instructorId,
      name: body.name,
      description: body.description ?? null,
      dayOfWeek: body.dayOfWeek,
      startTime,
      endTime,
      capacity: body.capacity ?? null,
      isActive: true,
    });
    return created;
  }

  async update(ctx: ClassAuthContext, classId: string, body: UpdateClassBody) {
    if (Object.keys(body).length === 0) {
      throw new HttpError(400, "At least one field is required");
    }

    const existing = await this.loadForMutation(ctx, classId);

    const startTime =
      body.startTime !== undefined
        ? normalizeTime(body.startTime)
        : String(existing.startTime);
    const endTime =
      body.endTime !== undefined
        ? normalizeTime(body.endTime)
        : String(existing.endTime);
    assertEndAfterStart(startTime, endTime);

    let nextInstructorId = existing.instructorId;
    if (body.instructorId !== undefined) {
      if (ctx.role === "instructor" && body.instructorId !== ctx.userId) {
        throw new HttpError(403, "Instructors cannot reassign the instructor");
      }
      nextInstructorId = body.instructorId;
      await this.assertCanTeach(ctx.activeAcademyId, nextInstructorId);
    }

    if (ctx.role === "instructor" && body.isActive !== undefined) {
      throw new HttpError(403, "Only managers can change class active status");
    }

    const updated = await this.classRepo.update(classId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined
        ? { description: body.description }
        : {}),
      ...(body.dayOfWeek !== undefined ? { dayOfWeek: body.dayOfWeek } : {}),
      ...(body.startTime !== undefined ? { startTime } : {}),
      ...(body.endTime !== undefined ? { endTime } : {}),
      ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
      ...(body.instructorId !== undefined
        ? { instructorId: nextInstructorId }
        : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    });

    if (!updated) {
      throw new HttpError(404, "Class not found");
    }
    return updated;
  }

  async deactivate(ctx: ClassAuthContext, classId: string) {
    await this.loadForMutation(ctx, classId);

    const updated = await this.classRepo.update(classId, { isActive: false });
    if (!updated) {
      throw new HttpError(404, "Class not found");
    }
    return updated;
  }

  private async loadForMutation(ctx: ClassAuthContext, classId: string) {
    const row = await this.getById(ctx, classId);
    if (ctx.role === "manager") {
      await this.assertManagerOwnsAcademy(ctx.userId, ctx.activeAcademyId);
    } else if (ctx.role === "instructor") {
      if (row.instructorId !== ctx.userId) {
        throw new HttpError(403, "You can only edit your own classes");
      }
    } else {
      throw new HttpError(403, "Forbidden");
    }
    return row;
  }

  private async assertManagerOwnsAcademy(userId: string, academyId: string) {
    const academy = await this.academyRepo.findById(academyId);
    if (!academy) throw new HttpError(404, "Academy not found");
    if (academy.ownerId !== userId) {
      throw new HttpError(403, "You do not manage this academy");
    }
  }

  private async assertCanTeach(academyId: string, userId: string) {
    const m = await this.membershipRepo.findActiveByUserAndAcademy(
      userId,
      academyId,
    );
    if (!m || !["instructor", "manager"].includes(m.role)) {
      throw new HttpError(
        400,
        "instructorId must be an active instructor or manager in this academy",
      );
    }
  }
}
```

- [x] **Step 2: Rewrite `class.routes.ts`**

```typescript
// apps/api/src/modules/class/class.routes.ts
import { Router, type Request } from "express";
import { Role } from "@tatame/types";
import type { CreateClassBody, UpdateClassBody } from "@tatame/validators";
import {
  classIdParamSchema,
  createClassBodySchema,
  listClassesQuerySchema,
  updateClassBodySchema,
} from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { ClassService } from "./class.service.js";
import { PostgresClassRepository } from "./class.repository.postgres.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";

export const classRouter = Router();

const db = getDb();
const classService = new ClassService(
  new PostgresClassRepository(db),
  new PostgresMembershipRepository(db),
  new PostgresAcademyRepository(db),
);

function classCtx(req: Request) {
  const a = req.appAuth!;
  return {
    userId: a.userId,
    role: a.role,
    activeAcademyId: a.activeAcademyId!,
  };
}

classRouter.get(
  "/",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const query = listClassesQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Invalid query");
      }
      const items = await classService.list(classCtx(req), query.data);
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

classRouter.get(
  "/:classId",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const params = classIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid class id");
      }
      const row = await classService.getById(
        classCtx(req),
        params.data.classId,
      );
      res.json(row);
    } catch (e) {
      next(e);
    }
  },
);

classRouter.post(
  "/",
  authorize(Role.Manager, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(createClassBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as CreateClassBody;
      const created = await classService.create(classCtx(req), body);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

classRouter.patch(
  "/:classId",
  authorize(Role.Manager, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(updateClassBodySchema),
  async (req, res, next) => {
    try {
      const params = classIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid class id");
      }
      const body = req.validatedBody as UpdateClassBody;
      const updated = await classService.update(
        classCtx(req),
        params.data.classId,
        body,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

classRouter.delete(
  "/:classId",
  authorize(Role.Manager, Role.Instructor),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const params = classIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid class id");
      }
      const updated = await classService.deactivate(
        classCtx(req),
        params.data.classId,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);
```

- [x] **Step 3: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Errors only in `membership.service.ts` (still uses old pattern)

- [x] **Step 4: Commit**

```bash
git add apps/api/src/modules/class/class.service.ts apps/api/src/modules/class/class.routes.ts
git commit -m "refactor(api): convert class service to class, wire into routes"
```

---

## Task 11: Membership module — rewrite service as class + update routes

**Files:**

- Rewrite: `apps/api/src/modules/membership/membership.service.ts`
- Modify: `apps/api/src/modules/membership/membership.routes.ts`

- [x] **Step 1: Rewrite `membership.service.ts` as `MembershipService` class**

```typescript
// apps/api/src/modules/membership/membership.service.ts
import type { IMembershipRepository } from "./membership.repository.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import { HttpError } from "../../lib/http-error.js";

export class MembershipService {
  constructor(
    private readonly membershipRepo: IMembershipRepository,
    private readonly academyRepo: IAcademyRepository,
  ) {}

  async getActive(userId: string) {
    return (await this.membershipRepo.findActiveByUser(userId)) ?? null;
  }

  async request(
    userId: string,
    role: "instructor" | "student",
    academyId: string,
  ) {
    const academy = await this.academyRepo.findById(academyId);
    if (!academy) {
      throw new HttpError(404, "Academy not found");
    }

    const active = await this.membershipRepo.findActiveByUser(userId);
    if (active) {
      throw new HttpError(
        409,
        "You already have an active academy membership; leave before joining another",
      );
    }

    const blocked = await this.membershipRepo.existsBlockedOrRejected(
      userId,
      academyId,
    );
    if (blocked) {
      throw new HttpError(
        403,
        "Cannot request again for this academy until a manager unblocks you",
      );
    }

    const pending = await this.membershipRepo.existsPending(userId, academyId);
    if (pending) {
      throw new HttpError(
        409,
        "You already have a pending request for this academy",
      );
    }

    return this.membershipRepo.create({
      academyId,
      userId,
      role,
      status: "pending",
      isActive: false,
      joinedAt: null,
      leftAt: null,
    });
  }

  async listPending(academyId: string, managerUserId: string) {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);
    return this.membershipRepo.findPendingByAcademy(academyId);
  }

  async approve(membershipId: string, managerUserId: string) {
    const m = await this.membershipRepo.findById(membershipId);
    if (!m) {
      throw new HttpError(404, "Membership not found");
    }
    await this.assertManagerOwnsAcademy(managerUserId, m.academyId);

    if (m.status !== "pending") {
      throw new HttpError(409, "Only pending memberships can be approved");
    }

    const targetActive = await this.membershipRepo.findActiveByUser(m.userId);
    if (targetActive) {
      throw new HttpError(
        409,
        "User already has an active membership elsewhere",
      );
    }

    return this.membershipRepo.withTransaction(async (txRepo) => {
      await txRepo.rejectAllPendingExcept(m.userId, membershipId);
      const updated = await txRepo.updateStatus(membershipId, {
        status: "active",
        isActive: true,
        joinedAt: new Date(),
      });
      if (!updated) {
        throw new HttpError(500, "Failed to approve membership");
      }
      return updated;
    });
  }

  async reject(membershipId: string, managerUserId: string) {
    const m = await this.membershipRepo.findById(membershipId);
    if (!m) {
      throw new HttpError(404, "Membership not found");
    }
    await this.assertManagerOwnsAcademy(managerUserId, m.academyId);

    if (m.status !== "pending") {
      throw new HttpError(409, "Only pending memberships can be rejected");
    }

    const updated = await this.membershipRepo.updateStatus(membershipId, {
      status: "rejected",
      isActive: false,
    });
    if (!updated) {
      throw new HttpError(500, "Failed to reject membership");
    }
    return updated;
  }

  async block(membershipId: string, managerUserId: string) {
    const m = await this.membershipRepo.findById(membershipId);
    if (!m) {
      throw new HttpError(404, "Membership not found");
    }
    await this.assertManagerOwnsAcademy(managerUserId, m.academyId);

    if (m.status !== "pending" && m.status !== "active") {
      throw new HttpError(
        409,
        "Only pending or active memberships can be blocked",
      );
    }

    const now = new Date();
    const updated = await this.membershipRepo.updateStatus(membershipId, {
      status: "blocked",
      isActive: false,
      leftAt: m.isActive ? now : m.leftAt,
    });
    if (!updated) {
      throw new HttpError(500, "Failed to block membership");
    }
    return updated;
  }

  async unblock(membershipId: string, managerUserId: string) {
    const m = await this.membershipRepo.findById(membershipId);
    if (!m) {
      throw new HttpError(404, "Membership not found");
    }
    await this.assertManagerOwnsAcademy(managerUserId, m.academyId);

    if (m.status !== "blocked" && m.status !== "rejected") {
      throw new HttpError(
        409,
        "Only blocked or rejected memberships can be unblocked",
      );
    }

    await this.membershipRepo.deleteById(membershipId);
  }

  async leave(userId: string) {
    const active = await this.membershipRepo.findActiveByUser(userId);
    if (!active) {
      throw new HttpError(404, "No active membership to leave");
    }

    const academy = await this.academyRepo.findById(active.academyId);
    if (academy?.ownerId === userId) {
      throw new HttpError(
        403,
        "Academy owners cannot leave their own academy in MVP",
      );
    }

    const updated = await this.membershipRepo.updateStatus(active.id, {
      isActive: false,
      leftAt: new Date(),
    });
    if (!updated) {
      throw new HttpError(500, "Failed to leave membership");
    }
    return updated;
  }

  private async assertManagerOwnsAcademy(userId: string, academyId: string) {
    const academy = await this.academyRepo.findById(academyId);
    if (!academy) {
      throw new HttpError(404, "Academy not found");
    }
    if (academy.ownerId !== userId) {
      throw new HttpError(403, "You do not manage this academy");
    }
  }
}
```

- [x] **Step 2: Rewrite `membership.routes.ts`**

```typescript
// apps/api/src/modules/membership/membership.routes.ts
import { Router } from "express";
import { Role } from "@tatame/types";
import type { RequestMembershipBody } from "@tatame/validators";
import {
  membershipIdParamSchema,
  pendingQuerySchema,
  requestMembershipBodySchema,
} from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import { attachActiveAcademyContext } from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { MembershipService } from "./membership.service.js";
import { PostgresMembershipRepository } from "./membership.repository.postgres.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";

export const membershipRouter = Router();

const db = getDb();
const membershipService = new MembershipService(
  new PostgresMembershipRepository(db),
  new PostgresAcademyRepository(db),
);

membershipRouter.post(
  "/requests",
  authorize(Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  validateBody(requestMembershipBodySchema),
  async (req, res, next) => {
    try {
      const { academyId } = req.validatedBody as RequestMembershipBody;
      const userId = req.appAuth!.userId;
      const role = req.appAuth!.role;
      const created = await membershipService.request(
        userId,
        role as "instructor" | "student",
        academyId,
      );
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.get(
  "/pending",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const query = pendingQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Query academyId (uuid) is required");
      }
      const managerUserId = req.appAuth!.userId;
      const items = await membershipService.listPending(
        query.data.academyId,
        managerUserId,
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.patch(
  "/:membershipId/approve",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      const updated = await membershipService.approve(
        params.data.membershipId,
        req.appAuth!.userId,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.patch(
  "/:membershipId/reject",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      const updated = await membershipService.reject(
        params.data.membershipId,
        req.appAuth!.userId,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.patch(
  "/:membershipId/block",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      const updated = await membershipService.block(
        params.data.membershipId,
        req.appAuth!.userId,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.patch(
  "/:membershipId/unblock",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const params = membershipIdParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new HttpError(400, "Invalid membership id");
      }
      await membershipService.unblock(
        params.data.membershipId,
        req.appAuth!.userId,
      );
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);

membershipRouter.post(
  "/leave",
  authorize(Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const updated = await membershipService.leave(req.appAuth!.userId);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);
```

- [x] **Step 3: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Error in `academy-context.ts` (imports old `getActiveMembership` free function) — fixed in Task 12

- [x] **Step 4: Commit**

```bash
git add apps/api/src/modules/membership/membership.service.ts apps/api/src/modules/membership/membership.routes.ts
git commit -m "refactor(api): convert membership service to class, wire into routes"
```

---

## Task 12: Update academy-context middleware

**Files:**

- Modify: `apps/api/src/middleware/academy-context.ts`

The middleware currently imports `getActiveMembership` as a free function from `membership.service.ts`. After the rewrite, that export no longer exists. Since the middleware only needs a simple data lookup (no business logic), it uses `PostgresMembershipRepository` directly.

- [x] **Step 1: Rewrite `academy-context.ts`**

```typescript
// apps/api/src/middleware/academy-context.ts
import type { NextFunction, Request, Response } from "express";
import { getDb } from "../lib/db.js";
import { PostgresMembershipRepository } from "../modules/membership/membership.repository.postgres.js";

const membershipRepo = new PostgresMembershipRepository(getDb());

/**
 * After `authorize`, loads `academy_memberships` where `is_active` and merges
 * `activeAcademyId` + `academyRole` into `req.appAuth`. No-op when there is
 * no active row (e.g. onboarding, requesting to join).
 */
export function attachActiveAcademyContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  void (async () => {
    const auth = req.appAuth;
    if (!auth) {
      next();
      return;
    }
    try {
      const row = await membershipRepo.findActiveByUser(auth.userId);
      if (row) {
        req.appAuth = {
          ...auth,
          activeAcademyId: row.academyId,
          academyRole: row.role,
        };
      }
      next();
    } catch (e) {
      next(e);
    }
  })();
}

/** Requires `attachActiveAcademyContext` (or equivalent) after `authorize`. */
export function requireActiveAcademy(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = req.appAuth?.activeAcademyId;
  if (!id) {
    res.status(403).json({ error: "No active academy membership" });
    return;
  }
  next();
}
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [x] **Step 3: Commit**

```bash
git add apps/api/src/middleware/academy-context.ts
git commit -m "refactor(api): update academy-context middleware to use repository directly"
```

---

## Task 13: Final verification

**Files:** None (verification only)

- [x] **Step 1: Full TypeScript compilation check**

Run: `cd apps/api && npx tsc --noEmit --pretty`
Expected: Clean — zero errors

- [x] **Step 2: Verify no old service imports remain**

Run: `grep -r "from.*academy.service" apps/api/src --include="*.ts" | grep -v "academy.service.ts"`
Expected: Only route files importing `AcademyService` class. No file should import `assertManagerOwnsAcademy`, `createAcademyWithManagerMembership`, etc. as named exports.

Run: `grep -r "getDb()" apps/api/src/modules --include="*.ts"`
Expected: Only route files and webhook handler call `getDb()`. No service file should reference it.

- [x] **Step 3: Verify no Drizzle imports in service files**

Run: `grep -r "from \"drizzle-orm\"" apps/api/src/modules --include="*.service.ts"`
Expected: No matches — services should have zero Drizzle imports.

Run: `grep -r "from \"@tatame/db\"" apps/api/src/modules --include="*.service.ts"`
Expected: No matches — services should not import from the DB package.

- [x] **Step 4: Commit (if any cleanup was needed)**

If all checks pass, no commit needed. If cleanup was required, commit the fixes.
