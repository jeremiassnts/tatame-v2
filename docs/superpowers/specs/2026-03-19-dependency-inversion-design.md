# Dependency Inversion for API Service Layer

## Goal

Decouple business logic from data access (Drizzle ORM, PostgreSQL) and external tools (Redis, Clerk, Stripe) across all API modules. Services must contain only business logic and depend on abstractions (interfaces), never on concrete implementations. This enables isolated unit testing of business logic without a real database.

## Scope

Refactor the 4 existing modules (`user`, `academy`, `class`, `membership`) and establish the pattern for the 4 remaining modules (`checkin`, `graduation`, `subscription`, `auth`).

## Pattern Overview

Each module follows the **Repository Pattern with Constructor Injection**:

```
Interface (contract) → Concrete implementation (Drizzle/Postgres)
                    ↘
Service (business logic, receives interface via constructor)
                    ↗
Route (wires concrete implementation into service)
```

In tests, the concrete implementation is replaced by an in-memory mock that implements the same interface.

## File Structure Per Module

```
modules/{module}/
  {module}.repository.ts            # Interface I{Module}Repository + domain types
  {module}.repository.postgres.ts   # Postgres{Module}Repository implements interface
  {module}.service.ts               # {Module}Service class with constructor injection
  {module}.routes.ts                # Instantiates service with concrete repos
```

No new folders or packages. Files stay flat within the existing module directory.

## Repository Interface

Each interface defines only the data access operations the service needs. Methods are named by intent (`findByAcademyId`, `create`), not by SQL operation.

```typescript
// class.repository.ts
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

Rules:
- Return types use `{Module}Row` derived from `InferSelectModel<typeof table>` for convenience, but the interface itself does not import or depend on Drizzle at runtime.
- No business logic in repository methods — only data access (queries, inserts, updates).
- Each interface file also exports the row types that the service will use.

## Concrete Postgres Implementation

Receives `Database` via constructor instead of importing the `getDb()` singleton.

```typescript
// class.repository.postgres.ts
import { and, eq, inArray } from "drizzle-orm";
import { classes, academyMemberships, type Database } from "@tatame/db";
import type { IClassRepository, ClassRow } from "./class.repository.js";

export class PostgresClassRepository implements IClassRepository {
  constructor(private readonly db: Database) {}

  async findByAcademyId(
    academyId: string,
    filters: { dayOfWeek?: number; includeInactive?: boolean; instructorId?: string },
  ): Promise<ClassRow[]> {
    const conditions = [eq(classes.academyId, academyId)];
    if (!filters.includeInactive) conditions.push(eq(classes.isActive, true));
    if (filters.dayOfWeek !== undefined) conditions.push(eq(classes.dayOfWeek, filters.dayOfWeek));
    if (filters.instructorId) conditions.push(eq(classes.instructorId, filters.instructorId));
    return this.db.select().from(classes).where(and(...conditions))
      .orderBy(classes.dayOfWeek, classes.startTime);
  }

  async findById(classId: string, academyId: string): Promise<ClassRow | undefined> {
    const [row] = await this.db.select().from(classes)
      .where(and(eq(classes.id, classId), eq(classes.academyId, academyId)))
      .limit(1);
    return row;
  }

  async create(data: { /* ... */ }): Promise<ClassRow> {
    const [row] = await this.db.insert(classes).values(data).returning();
    if (!row) throw new Error("Failed to insert class");
    return row;
  }

  async update(classId: string, data: Partial<{ /* ... */ }>): Promise<ClassRow | undefined> {
    const [row] = await this.db.update(classes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(classes.id, classId))
      .returning();
    return row;
  }
}
```

Rules:
- All Drizzle imports and ORM logic live exclusively here.
- The constructor receives `Database` — the same type exported from `@tatame/db`.
- Error handling in repositories is limited to data-level failures. Business errors (`HttpError`) stay in the service.

## Service as Class with Constructor Injection

Services become classes. Business logic (authorization, validation, role-based filtering) stays here. Data access is delegated to the injected repository.

```typescript
// class.service.ts
import type { IClassRepository } from "./class.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { CreateClassBody, UpdateClassBody } from "@tatame/validators";
import type { Role } from "@tatame/types";
import { HttpError } from "../../lib/http-error.js";

export type ClassAuthContext = {
  userId: string;
  role: Role;
  activeAcademyId: string;
};

function normalizeTime(t: string): string { /* unchanged */ }
function assertEndAfterStart(start: string, end: string): void { /* unchanged */ }

export class ClassService {
  constructor(
    private readonly classRepo: IClassRepository,
    private readonly membershipRepo: IMembershipRepository,
  ) {}

  async list(ctx: ClassAuthContext, query: { dayOfWeek?: number; includeInactive?: boolean }) {
    const includeInactive = ctx.role === "manager" ? Boolean(query.includeInactive) : false;
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
    if (ctx.role === "student" && !row.isActive) throw new HttpError(404, "Class not found");
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
        throw new HttpError(403, "Instructors can only create classes for themselves");
      }
      await this.assertCanTeach(ctx.activeAcademyId, ctx.userId);
    } else {
      throw new HttpError(403, "Forbidden");
    }

    return this.classRepo.create({
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
  }

  // Private helpers use the injected repos
  private async assertManagerOwnsAcademy(userId: string, academyId: string) {
    const m = await this.membershipRepo.findActiveByUserAndAcademy(userId, academyId);
    if (!m || m.role !== "manager") throw new HttpError(403, "Not the academy manager");
  }

  private async assertCanTeach(academyId: string, userId: string) {
    const m = await this.membershipRepo.findActiveByUserAndAcademy(userId, academyId);
    if (!m || !["instructor", "manager"].includes(m.role)) {
      throw new HttpError(400, "instructorId must be an active instructor or manager");
    }
  }
}
```

Rules:
- Services depend only on repository interfaces, never on concrete implementations.
- Cross-module dependencies use the **other module's repository interface** for simple data lookups, or the **other module's service** when its business logic is needed.
- Pure helper functions (`normalizeTime`, `assertEndAfterStart`) remain as free functions in the service file — they have no external dependencies.
- `HttpError` is a domain-level utility shared across services — it stays as a direct import.

## Cross-Module Dependency Resolution

When a service needs data from another module:
- **Data lookup only** → inject the other module's repository interface (e.g., `ClassService` needs to check if a user is an active member → injects `IMembershipRepository`).
- **Business logic needed** → inject the other module's service (e.g., if `ClassService` needed the full membership approval flow → injects `MembershipService`). The service being injected also receives its dependencies via constructor in the route wiring.

## Wiring in Routes

Routes are the composition root. They instantiate concrete repositories and wire them into services:

```typescript
// class.routes.ts
import { getDb } from "../../lib/db.js";
import { ClassService } from "./class.service.js";
import { PostgresClassRepository } from "./class.repository.postgres.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";

const db = getDb();
const classService = new ClassService(
  new PostgresClassRepository(db),
  new PostgresMembershipRepository(db),
);

classRouter.get("/", authorize(...), async (req, res, next) => {
  try {
    const ctx = buildClassAuthContext(req);
    const result = await classService.list(ctx, req.query);
    res.json(result);
  } catch (e) {
    next(e);
  }
});
```

Rules:
- `getDb()` is called once per route file, at module level.
- Service and repository instances are created once at module level (not per-request).
- Only route files import concrete repository implementations. No other layer references them.

## Modules to Refactor

The 4 implemented modules, listed with their current service functions that will be extracted:

### 1. user
- `upsertUserFromClerk` → `UserService.upsertFromClerk()`
- `deleteUserByClerkId` → `UserService.deleteByClerkId()`
- `getUserByClerkId` → `UserService.getByClerkId()`
- `getActiveRoleForUser` → `UserService.getActiveRole()`
- `assignInitialUserRole` → `UserService.assignInitialRole()`

### 2. academy
- `createAcademyWithManagerMembership` → `AcademyService.createWithManagerMembership()`
- `getAcademyById` → `AcademyService.getById()`
- `searchAcademiesByName` → `AcademyService.searchByName()`
- `assertManagerOwnsAcademy` → becomes private helper or moves to membership checks
- `updateAcademy` → `AcademyService.update()`

### 3. class
- `listClassesForActiveAcademy` → `ClassService.list()`
- `getClassInActiveAcademy` → `ClassService.getById()`
- `createClass` → `ClassService.create()`
- `updateClass` → `ClassService.update()`
- `deactivateClass` → `ClassService.deactivate()`

### 4. membership
- `getActiveMembership` → `MembershipService.getActive()`
- `requestMembership` → `MembershipService.request()`
- `listPendingMembershipsForAcademy` → `MembershipService.listPending()`
- `approveMembership` → `MembershipService.approve()`
- `rejectMembership` → `MembershipService.reject()`
- `blockMembership` → `MembershipService.block()`
- `unblockMembership` → `MembershipService.unblock()`
- `leaveActiveMembership` → `MembershipService.leave()`

## Transaction Handling

Some operations currently use `db.transaction()` (e.g., `createAcademyWithManagerMembership`, `approveMembership`). Since transactions require the same database connection:

- The repository interface exposes a `withTransaction(fn)` method that accepts a callback.
- Inside the callback, the repository provides a transactional version of itself.
- The service calls `this.repo.withTransaction(async (txRepo) => { ... })`.

```typescript
// In the interface
interface IAcademyRepository {
  // ...
  withTransaction<T>(fn: (txRepo: IAcademyRepository) => Promise<T>): Promise<T>;
}

// In the Postgres implementation
async withTransaction<T>(fn: (txRepo: IAcademyRepository) => Promise<T>): Promise<T> {
  return this.db.transaction(async (tx) => {
    const txRepo = new PostgresAcademyRepository(tx as unknown as Database);
    return fn(txRepo);
  });
}
```

For operations that span multiple repositories in a single transaction, the route file can create a shared transactional `db` and pass it to both repositories. Alternatively, the primary service's `withTransaction` can accept a factory to create the secondary transactional repo. This keeps the service unaware of the concrete database while still enabling atomic operations.

## What Does NOT Change

- `HttpError` class — stays as shared utility
- Validator types from `@tatame/validators` — still used by services
- Domain types from `@tatame/types` — still used by services
- Middleware (`authorize`, `academy-context`, `validate`) — unchanged
- Express augmentation (`req.appAuth`, `req.validatedBody`) — unchanged
- Route structure and URL paths — unchanged
- `@tatame/db` package — unchanged, still exports schema and `Database` type

## Future Modules

The 4 remaining modules (`checkin`, `graduation`, `subscription`, `auth`) must follow this same pattern from the start. No service function should directly import or use Drizzle/database operations.
