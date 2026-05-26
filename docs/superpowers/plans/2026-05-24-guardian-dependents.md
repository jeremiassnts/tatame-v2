# Guardian & Dependents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support children (kids classes) by allowing guardians and students to manage dependents — profiles without login — for check-ins, subscriptions, payments, and belt promotions.

**Architecture:** New `dependents` table with soft-delete. New `guardian` role added to `app_role` enum. Existing tables (`checkins`, `student_subscriptions`, `payments`, `belt_promotions`) get an optional `dependentId` FK. New `dependent` API module (CRUD). Existing modules (checkin, subscription, payment, graduation) accept optional `dependentId` with ownership validation. Mobile adds guardian-specific screens + dependent selection flows.

**Tech Stack:** Express (API), React Native / Expo (mobile), Drizzle ORM (Postgres), React Query (mobile data fetching), Zod (validators), NativeWind (styling)

**Spec:** `docs/superpowers/specs/2026-05-22-guardian-dependents-design.md`
**Screens:** `docs/superpowers/specs/2026-05-22-guardian-dependents-screens.md`
**Design:** Pencil file nodes `LMcUj`–`vLvnE`

---

## Phase 1: Foundation (Types, Schema, Validators, Migration)

### Task 1: Add `guardian` to Role enum and types

**Files:**
- Modify: `packages/types/src/index.ts`
- Modify: `packages/validators/src/user.schema.ts`

- [ ] **Step 1: Add Guardian to Role constant**

In `packages/types/src/index.ts`, add `Guardian` to the `Role` object:

```typescript
export const Role = {
  Manager: "manager",
  Instructor: "instructor",
  Student: "student",
  Guardian: "guardian",
} as const;
export type Role = (typeof Role)[keyof typeof Role];
```

- [ ] **Step 2: Update roleEnumSchema validator**

In `packages/validators/src/user.schema.ts`, update the schema:

```typescript
export const roleEnumSchema = z.enum(["manager", "instructor", "student", "guardian"]);
```

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/index.ts packages/validators/src/user.schema.ts
git commit -m "feat(guardian): add guardian role to types and validators"
```

---

### Task 2: Add `dependents` table and alter existing tables in Drizzle schema

**Files:**
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Add `guardian` to `appRoleEnum`**

```typescript
export const appRoleEnum = pgEnum("app_role", [
  "manager",
  "instructor",
  "student",
  "guardian",
]);
```

- [ ] **Step 2: Add `dependents` table after the `academyMemberships` table**

```typescript
export const dependents = pgTable("dependents", {
  id: uuid("id").primaryKey().defaultRandom(),
  guardianId: uuid("guardian_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  academyId: uuid("academy_id")
    .notNull()
    .references(() => academies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  birthDate: date("birth_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
```

- [ ] **Step 3: Add `dependentId` to `checkins` table and update unique index**

```typescript
export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dependentId: uuid("dependent_id").references(() => dependents.id, {
      onDelete: "set null",
    }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    date: date("date").notNull(),
    weekReference: date("week_reference").notNull(),
  },
  (t) => ({
    userWeekIdx: index("checkins_user_id_week_reference_idx").on(
      t.userId,
      t.weekReference,
    ),
    classDateIdx: index("checkins_class_id_date_idx").on(t.classId, t.date),
    onePerUserClassDate: uniqueIndex("checkins_user_class_date_unique").on(
      t.userId,
      t.classId,
      t.date,
    ),
    onePerDependentClassDate: uniqueIndex("checkins_dependent_class_date_unique")
      .on(t.dependentId, t.classId, t.date)
      .where(sql`${t.dependentId} IS NOT NULL`),
  }),
);
```

- [ ] **Step 4: Add `dependentId` to `studentSubscriptions` table**

```typescript
export const studentSubscriptions = pgTable("student_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  dependentId: uuid("dependent_id").references(() => dependents.id, {
    onDelete: "set null",
  }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => subscriptionPlans.id, { onDelete: "restrict" }),
  status: subscriptionStatusEnum("status").notNull(),
  startsAt: date("starts_at").notNull(),
  expiresAt: date("expires_at").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
```

- [ ] **Step 5: Add `dependentId` to `payments` table**

```typescript
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => studentSubscriptions.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  dependentId: uuid("dependent_id").references(() => dependents.id, {
    onDelete: "set null",
  }),
  academyId: uuid("academy_id")
    .notNull()
    .references(() => academies.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  method: paymentMethodEnum("method").notNull(),
  confirmedBy: uuid("confirmed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  stripePaymentId: text("stripe_payment_id"),
  referenceMonth: date("reference_month").notNull(),
  notes: text("notes"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  transferredAt: timestamp("transferred_at", { withTimezone: true }),
});
```

- [ ] **Step 6: Add `dependentId` to `beltPromotions` table and add dependent unique index**

```typescript
export const beltPromotions = pgTable(
  "belt_promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dependentId: uuid("dependent_id").references(() => dependents.id, {
      onDelete: "set null",
    }),
    academyId: uuid("academy_id")
      .notNull()
      .references(() => academies.id, { onDelete: "cascade" }),
    promotedBy: uuid("promoted_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    belt: beltEnum("belt").notNull(),
    stripes: smallint("stripes").notNull(),
    isCurrent: boolean("is_current").notNull(),
    promotedAt: timestamp("promoted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    notes: text("notes"),
  },
  (t) => ({
    oneCurrentPerUser: uniqueIndex("belt_promotions_one_current_per_user")
      .on(t.userId)
      .where(sql`${t.isCurrent} = true`),
    oneCurrentPerDependent: uniqueIndex("belt_promotions_one_current_per_dependent")
      .on(t.dependentId)
      .where(sql`${t.isCurrent} = true AND ${t.dependentId} IS NOT NULL`),
  }),
);
```

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/index.ts
git commit -m "feat(guardian): add dependents table and dependentId to checkins, subscriptions, payments, belt_promotions"
```

---

### Task 3: Generate and apply database migration

**Files:**
- Generate: `packages/db/drizzle/*.sql` (auto-generated)

- [ ] **Step 1: Generate migration**

```bash
cd packages/db
pnpm drizzle-kit generate
```

This generates a migration SQL file adding:
- `guardian` value to `app_role` enum
- `dependents` table
- `dependent_id` columns to `checkins`, `student_subscriptions`, `payments`, `belt_promotions`
- Partial unique indexes for dependent check-ins and belt promotions

- [ ] **Step 2: Review the generated migration SQL**

Open the generated file in `packages/db/drizzle/` and verify it includes all changes. If using Drizzle's introspection, enum alterations may need a manual `ALTER TYPE app_role ADD VALUE 'guardian';` — check and add if missing.

- [ ] **Step 3: Apply migration to local database**

```bash
pnpm drizzle-kit push
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/drizzle/
git commit -m "feat(guardian): add database migration for dependents"
```

---

### Task 4: Create dependent validator schemas

**Files:**
- Create: `packages/validators/src/dependent.schema.ts`
- Modify: `packages/validators/src/index.ts`
- Modify: `packages/validators/src/checkin.schema.ts`

- [ ] **Step 1: Create dependent.schema.ts**

```typescript
// packages/validators/src/dependent.schema.ts
import { z } from "zod";

export const createDependentBodySchema = z.object({
  name: z.string().min(2).max(100),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date as YYYY-MM-DD"),
  belt: z.enum(["white", "blue", "purple", "brown", "black"]),
  stripes: z.number().int().min(0).max(4),
});

export type CreateDependentBody = z.infer<typeof createDependentBodySchema>;

export const updateDependentBodySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date as YYYY-MM-DD").optional(),
});

export type UpdateDependentBody = z.infer<typeof updateDependentBodySchema>;

export const dependentResponseSchema = z.object({
  id: z.string().uuid(),
  guardianId: z.string().uuid(),
  academyId: z.string().uuid(),
  name: z.string(),
  birthDate: z.string(),
  currentBelt: z.object({
    belt: z.string(),
    stripes: z.number(),
  }).nullable(),
  subscriptionStatus: z.enum(["active", "expired", "none"]).nullable(),
  createdAt: z.string(),
});

export type DependentResponse = z.infer<typeof dependentResponseSchema>;
```

- [ ] **Step 2: Export from validators index**

In `packages/validators/src/index.ts`, add:

```typescript
export * from "./dependent.schema.js";
```

- [ ] **Step 3: Add optional `dependentId` to checkin schema**

In `packages/validators/src/checkin.schema.ts`, update `createCheckinBodySchema`:

```typescript
export const createCheckinBodySchema = z.object({
  classId: z.string().uuid(),
  date: checkinSessionDateSchema,
  dependentId: z.string().uuid().optional(),
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/validators/src/dependent.schema.ts packages/validators/src/index.ts packages/validators/src/checkin.schema.ts
git commit -m "feat(guardian): add dependent validator schemas and dependentId to checkin"
```

---

## Phase 2: Backend — Dependent CRUD Module

### Task 5: Create dependent repository interface

**Files:**
- Create: `apps/api/src/modules/dependent/dependent.repository.ts`

- [ ] **Step 1: Create repository interface**

```typescript
// apps/api/src/modules/dependent/dependent.repository.ts
import type { InferSelectModel } from "drizzle-orm";
import type { dependents } from "@tatame/db";

export type DependentRow = InferSelectModel<typeof dependents>;

export interface IDependentRepository {
  insert(data: {
    guardianId: string;
    academyId: string;
    name: string;
    birthDate: string;
  }): Promise<DependentRow>;

  findById(id: string): Promise<DependentRow | undefined>;

  findByGuardian(guardianId: string): Promise<DependentRow[]>;

  findByAcademy(academyId: string): Promise<DependentRow[]>;

  update(id: string, data: {
    name?: string;
    birthDate?: string;
  }): Promise<DependentRow | undefined>;

  softDelete(id: string): Promise<void>;

  softDeleteByGuardianAndAcademy(guardianId: string, academyId: string): Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/dependent/dependent.repository.ts
git commit -m "feat(guardian): add dependent repository interface"
```

---

### Task 6: Create dependent Postgres repository

**Files:**
- Create: `apps/api/src/modules/dependent/dependent.repository.postgres.ts`

- [ ] **Step 1: Implement Postgres repository**

```typescript
// apps/api/src/modules/dependent/dependent.repository.postgres.ts
import { eq, and, isNull } from "drizzle-orm";
import { dependents } from "@tatame/db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DependentRow, IDependentRepository } from "./dependent.repository.js";

export class PostgresDependentRepository implements IDependentRepository {
  constructor(private readonly db: NodePgDatabase) {}

  async insert(data: {
    guardianId: string;
    academyId: string;
    name: string;
    birthDate: string;
  }): Promise<DependentRow> {
    const [row] = await this.db
      .insert(dependents)
      .values({
        guardianId: data.guardianId,
        academyId: data.academyId,
        name: data.name,
        birthDate: data.birthDate,
      })
      .returning();
    return row!;
  }

  async findById(id: string): Promise<DependentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(dependents)
      .where(and(eq(dependents.id, id), isNull(dependents.deletedAt)));
    return row;
  }

  async findByGuardian(guardianId: string): Promise<DependentRow[]> {
    return this.db
      .select()
      .from(dependents)
      .where(and(eq(dependents.guardianId, guardianId), isNull(dependents.deletedAt)));
  }

  async findByAcademy(academyId: string): Promise<DependentRow[]> {
    return this.db
      .select()
      .from(dependents)
      .where(and(eq(dependents.academyId, academyId), isNull(dependents.deletedAt)));
  }

  async update(id: string, data: {
    name?: string;
    birthDate?: string;
  }): Promise<DependentRow | undefined> {
    const [row] = await this.db
      .update(dependents)
      .set(data)
      .where(and(eq(dependents.id, id), isNull(dependents.deletedAt)))
      .returning();
    return row;
  }

  async softDelete(id: string): Promise<void> {
    await this.db
      .update(dependents)
      .set({ deletedAt: new Date() })
      .where(and(eq(dependents.id, id), isNull(dependents.deletedAt)));
  }

  async softDeleteByGuardianAndAcademy(guardianId: string, academyId: string): Promise<void> {
    await this.db
      .update(dependents)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(dependents.guardianId, guardianId),
          eq(dependents.academyId, academyId),
          isNull(dependents.deletedAt),
        ),
      );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/dependent/dependent.repository.postgres.ts
git commit -m "feat(guardian): add dependent Postgres repository"
```

---

### Task 7: Create dependent service

**Files:**
- Create: `apps/api/src/modules/dependent/dependent.service.ts`

- [ ] **Step 1: Create service**

```typescript
// apps/api/src/modules/dependent/dependent.service.ts
import type { Belt, Role } from "@tatame/types";
import { HttpError } from "../../lib/http-error.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { IGraduationRepository } from "../graduation/graduation.repository.js";
import type { IStudentSubscriptionRepository } from "../subscription/subscription.repository.js";
import type { IDependentRepository, DependentRow } from "./dependent.repository.js";
import { assertValidBeltRank } from "../graduation/graduation.service.js";

export class DependentService {
  constructor(
    private readonly dependentRepo: IDependentRepository,
    private readonly membershipRepo: IMembershipRepository,
    private readonly graduationRepo: IGraduationRepository,
    private readonly studentSubRepo: IStudentSubscriptionRepository,
  ) {}

  async create(opts: {
    userId: string;
    role: Role;
    academyId: string;
    name: string;
    birthDate: string;
    belt: Belt;
    stripes: number;
  }): Promise<DependentRow> {
    if (opts.role !== "guardian" && opts.role !== "student") {
      throw new HttpError(403, "Apenas responsáveis e alunos podem cadastrar dependentes");
    }

    const membership = await this.membershipRepo.findActiveByUserAndAcademy(
      opts.userId,
      opts.academyId,
    );
    if (!membership || membership.status !== "active") {
      throw new HttpError(403, "Matrícula ativa na academia é necessária");
    }

    assertValidBeltRank(opts.belt, opts.stripes);

    const dependent = await this.dependentRepo.insert({
      guardianId: opts.userId,
      academyId: opts.academyId,
      name: opts.name,
      birthDate: opts.birthDate,
    });

    // Register initial belt for the dependent
    await this.graduationRepo.insertInitialCurrent({
      userId: opts.userId,
      academyId: opts.academyId,
      promotedBy: opts.userId,
      belt: opts.belt,
      stripes: opts.stripes,
      notes: null,
      dependentId: dependent.id,
    });

    return dependent;
  }

  async listMine(userId: string) {
    return this.dependentRepo.findByGuardian(userId);
  }

  async getById(userId: string, role: Role, dependentId: string, academyId?: string) {
    const dep = await this.dependentRepo.findById(dependentId);
    if (!dep) throw new HttpError(404, "Dependente não encontrado");

    // Guardian/student can only see their own dependents
    if (role !== "manager") {
      if (dep.guardianId !== userId) {
        throw new HttpError(404, "Dependente não encontrado");
      }
    } else {
      // Manager can see dependents in their academy
      if (academyId && dep.academyId !== academyId) {
        throw new HttpError(404, "Dependente não encontrado");
      }
    }

    return dep;
  }

  async update(userId: string, role: Role, dependentId: string, data: {
    name?: string;
    birthDate?: string;
  }, academyId?: string) {
    const dep = await this.getById(userId, role, dependentId, academyId);

    if (role !== "manager" && dep.guardianId !== userId) {
      throw new HttpError(403, "Sem permissão para editar este dependente");
    }

    return this.dependentRepo.update(dependentId, data);
  }

  async delete(userId: string, role: Role, dependentId: string, academyId?: string) {
    const dep = await this.getById(userId, role, dependentId, academyId);

    if (role !== "manager" && dep.guardianId !== userId) {
      throw new HttpError(403, "Sem permissão para excluir este dependente");
    }

    await this.dependentRepo.softDelete(dependentId);
  }

  async listByAcademy(userId: string, role: Role, academyId: string) {
    if (role !== "manager") {
      throw new HttpError(403, "Apenas gestores podem listar dependentes da academia");
    }
    return this.dependentRepo.findByAcademy(academyId);
  }

  /**
   * Validates that the authenticated user is the guardian of the given dependent.
   * Used by checkin, subscription, and payment modules.
   */
  async assertGuardianOwnership(userId: string, dependentId: string): Promise<DependentRow> {
    const dep = await this.dependentRepo.findById(dependentId);
    if (!dep || dep.guardianId !== userId) {
      throw new HttpError(403, "Você não é responsável por este dependente");
    }
    return dep;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/dependent/dependent.service.ts
git commit -m "feat(guardian): add dependent service with CRUD and ownership validation"
```

---

### Task 8: Create dependent routes and register in router

**Files:**
- Create: `apps/api/src/modules/dependent/dependent.routes.ts`
- Modify: `apps/api/src/router.ts`

- [ ] **Step 1: Create routes**

```typescript
// apps/api/src/modules/dependent/dependent.routes.ts
import { Role } from "@tatame/types";
import type { CreateDependentBody, UpdateDependentBody } from "@tatame/validators";
import { createDependentBodySchema, updateDependentBodySchema } from "@tatame/validators";
import { Router } from "express";
import { getDb } from "../../lib/db.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresDependentRepository } from "./dependent.repository.postgres.js";
import { DependentService } from "./dependent.service.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresGraduationRepository } from "../graduation/graduation.repository.postgres.js";
import { PostgresStudentSubscriptionRepository } from "../subscription/subscription.repository.postgres.js";

export const dependentRouter = Router();

const db = getDb();
const dependentService = new DependentService(
  new PostgresDependentRepository(db),
  new PostgresMembershipRepository(db),
  new PostgresGraduationRepository(db),
  new PostgresStudentSubscriptionRepository(db),
);

// POST /dependents - Register a dependent
dependentRouter.post(
  "/",
  authorize(Role.Guardian, Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(createDependentBodySchema),
  async (req, res, next) => {
    try {
      const auth = req.appAuth!;
      const body = req.validatedBody as CreateDependentBody;
      const dependent = await dependentService.create({
        userId: auth.userId,
        role: auth.role,
        academyId: auth.activeAcademyId!,
        name: body.name,
        birthDate: body.birthDate,
        belt: body.belt,
        stripes: body.stripes,
      });
      res.status(201).json(dependent);
    } catch (e) {
      next(e);
    }
  },
);

// GET /dependents/me - List my dependents
dependentRouter.get(
  "/me",
  authorize(Role.Guardian, Role.Student),
  async (req, res, next) => {
    try {
      const result = await dependentService.listMine(req.appAuth!.userId);
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

// GET /dependents/academy/:academyId - List all academy dependents (manager only)
dependentRouter.get(
  "/academy/:academyId",
  authorize(Role.Manager),
  async (req, res, next) => {
    try {
      const auth = req.appAuth!;
      const result = await dependentService.listByAcademy(
        auth.userId,
        auth.role,
        req.params.academyId,
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

// GET /dependents/:id - Dependent detail
dependentRouter.get(
  "/:id",
  authorize(Role.Guardian, Role.Student, Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const auth = req.appAuth!;
      const result = await dependentService.getById(
        auth.userId,
        auth.role,
        req.params.id,
        auth.activeAcademyId ?? undefined,
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

// PUT /dependents/:id - Edit dependent
dependentRouter.put(
  "/:id",
  authorize(Role.Guardian, Role.Student, Role.Manager),
  attachActiveAcademyContext,
  validateBody(updateDependentBodySchema),
  async (req, res, next) => {
    try {
      const auth = req.appAuth!;
      const body = req.validatedBody as UpdateDependentBody;
      const result = await dependentService.update(
        auth.userId,
        auth.role,
        req.params.id,
        body,
        auth.activeAcademyId ?? undefined,
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

// DELETE /dependents/:id - Soft delete dependent
dependentRouter.delete(
  "/:id",
  authorize(Role.Guardian, Role.Student, Role.Manager),
  attachActiveAcademyContext,
  async (req, res, next) => {
    try {
      const auth = req.appAuth!;
      await dependentService.delete(
        auth.userId,
        auth.role,
        req.params.id,
        auth.activeAcademyId ?? undefined,
      );
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
);
```

- [ ] **Step 2: Register in router**

In `apps/api/src/router.ts`, add the import and mount:

```typescript
import { dependentRouter } from "./modules/dependent/dependent.routes.js";
```

Add before the admin line:

```typescript
apiRouter.use("/dependents", dependentRouter);
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/dependent/dependent.routes.ts apps/api/src/router.ts
git commit -m "feat(guardian): add dependent routes and register in API router"
```

---

## Phase 3: Backend — Modify Existing Modules for dependentId

### Task 9: Update checkin module to accept dependentId

**Files:**
- Modify: `apps/api/src/modules/checkin/checkin.repository.ts`
- Modify: `apps/api/src/modules/checkin/checkin.repository.postgres.ts`
- Modify: `apps/api/src/modules/checkin/checkin.service.ts`
- Modify: `apps/api/src/modules/checkin/checkin.routes.ts`

- [ ] **Step 1: Add dependentId to repository insert interface**

In `apps/api/src/modules/checkin/checkin.repository.ts`, update the `insert` method signature:

```typescript
insert(data: {
  classId: string;
  userId: string;
  dependentId?: string;
  date: string;
  weekReference: string;
}): Promise<CheckinRow>;
```

Add a new method for counting dependent check-ins:

```typescript
countByDependentAndWeek(dependentId: string, weekReference: string): Promise<number>;
```

- [ ] **Step 2: Update Postgres repository insert**

In `apps/api/src/modules/checkin/checkin.repository.postgres.ts`, update the `insert` method to include `dependentId` in the values:

```typescript
async insert(data: {
  classId: string;
  userId: string;
  dependentId?: string;
  date: string;
  weekReference: string;
}): Promise<CheckinRow> {
  const [row] = await this.db
    .insert(checkins)
    .values({
      classId: data.classId,
      userId: data.userId,
      dependentId: data.dependentId ?? null,
      date: data.date,
      weekReference: data.weekReference,
    })
    .returning();
  return row!;
}
```

Add `countByDependentAndWeek`:

```typescript
async countByDependentAndWeek(dependentId: string, weekReference: string): Promise<number> {
  const [row] = await this.db
    .select({ count: sql<number>`count(*)::int` })
    .from(checkins)
    .where(
      and(
        eq(checkins.dependentId, dependentId),
        eq(checkins.weekReference, weekReference),
      ),
    );
  return row?.count ?? 0;
}
```

- [ ] **Step 3: Update checkin service to handle dependentId**

In `apps/api/src/modules/checkin/checkin.service.ts`, update the `checkIn` method opts to accept `dependentId`:

```typescript
async checkIn(opts: {
  userId: string;
  academyId: string;
  academyRole: Role;
  classId: string;
  sessionDate: string;
  dependentId?: string;
  now?: Date;
  redis?: RedisClientType;
}): Promise<CheckinSuccess> {
```

At the top of `checkIn`, after role validation, add guardian logic:

```typescript
// Guardian must provide dependentId
if (opts.academyRole === "guardian" && !opts.dependentId) {
  throw new HttpError(400, "Responsável deve informar o dependente para check-in");
}

// Allow guardian role to check in for dependents
const allowedRoles: Role[] = ["student", "guardian"];
if (!allowedRoles.includes(opts.academyRole)) {
  throw new HttpError(403, "Apenas alunos e responsáveis podem fazer check-in");
}
```

Replace the existing role check at the top (`if (opts.academyRole !== "student")`) with the above.

Update the membership check to accept both `student` and `guardian` roles:

```typescript
if (membership.role !== "student" && membership.role !== "guardian") {
  throw new HttpError(403, "Apenas alunos e responsáveis podem fazer check-in");
}
```

For weekly limit checking, when `dependentId` is provided, count by dependent instead of user:

```typescript
const weeklyCountTarget = opts.dependentId
  ? await this.checkinRepo.countByDependentAndWeek(opts.dependentId, weekReference)
  : await this.checkinRepo.countByUserAndWeek(opts.userId, weekReference);

if (
  plan.weeklyCheckinLimit !== null &&
  weeklyCountTarget >= plan.weeklyCheckinLimit
) {
  throw new HttpError(409, "Limite semanal de check-ins atingido");
}
```

Pass `dependentId` to the insert call:

```typescript
const checkin = await this.checkinRepo.insert({
  classId: opts.classId,
  userId: opts.userId,
  dependentId: opts.dependentId,
  date: opts.sessionDate,
  weekReference,
});
```

- [ ] **Step 4: Update checkin route to pass dependentId**

In `apps/api/src/modules/checkin/checkin.routes.ts`, update the POST handler:

Update the `authorize` call to also allow `Role.Guardian`:

```typescript
checkinRouter.post(
  "/",
  authorize(Role.Student, Role.Guardian),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(createCheckinBodySchema),
  async (req, res, next) => {
    try {
      const auth = req.appAuth!;
      const body = req.validatedBody as CreateCheckinBody;
      const { checkin, warnings } = await checkinService.checkIn({
        userId: auth.userId,
        academyId: auth.activeAcademyId!,
        academyRole: auth.academyRole,
        classId: body.classId,
        sessionDate: body.date,
        dependentId: body.dependentId,
      });
      // ... rest unchanged
```

Also update the GET endpoints to allow Guardian role:

```typescript
authorize(Role.Student, Role.Instructor, Role.Guardian),
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/checkin/
git commit -m "feat(guardian): support dependentId in checkin module"
```

---

### Task 10: Update graduation module to accept dependentId for belt promotions

**Files:**
- Modify: `apps/api/src/modules/graduation/graduation.repository.ts`
- Modify: `apps/api/src/modules/graduation/graduation.repository.postgres.ts`
- Modify: `apps/api/src/modules/graduation/graduation.service.ts`
- Modify: `apps/api/src/modules/graduation/graduation.routes.ts`
- Modify: `packages/validators/src/graduation.schema.ts`

- [ ] **Step 1: Add dependentId to graduation repository interface**

In `graduation.repository.ts`, add `dependentId?: string` to `insertInitialCurrent` and `replaceCurrentPromotion` data parameters. Add methods:

```typescript
findCurrentByDependentId(dependentId: string): Promise<BeltPromotionRow | undefined>;
listByDependentInAcademy(dependentId: string, academyId: string): Promise<BeltPromotionRow[]>;
```

- [ ] **Step 2: Implement in Postgres repository**

Update `graduation.repository.postgres.ts` to pass `dependentId` in insert values and implement the new methods.

- [ ] **Step 3: Add dependentId to graduation validator schemas**

In `packages/validators/src/graduation.schema.ts`, add `dependentId: z.string().uuid().optional()` to both `registerInitialBeltBodySchema` and `promoteMemberBodySchema`.

- [ ] **Step 4: Update graduation service**

In `graduation.service.ts`, update `promoteMember` to accept optional `dependentId`. When provided, look up current belt by dependent instead of by user, and pass `dependentId` to the repository.

- [ ] **Step 5: Update graduation routes**

Allow `Role.Guardian` where appropriate. Pass `dependentId` from request body to service.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/graduation/ packages/validators/src/graduation.schema.ts
git commit -m "feat(guardian): support dependentId in graduation module"
```

---

### Task 11: Update subscription module to accept dependentId

**Files:**
- Modify: `packages/validators/src/subscription.schema.ts`
- Modify: `apps/api/src/modules/subscription/subscription.repository.ts`
- Modify: `apps/api/src/modules/subscription/subscription.repository.postgres.ts`
- Modify: `apps/api/src/modules/subscription/subscription.routes.ts`

- [ ] **Step 1: Add dependentId to subscription validator**

In `packages/validators/src/subscription.schema.ts`, add `dependentId: z.string().uuid().optional()` to the student plan selection schema.

- [ ] **Step 2: Update subscription repository to accept dependentId**

Add `dependentId` parameter to the student subscription insert and query methods.

- [ ] **Step 3: Update subscription routes**

Allow `Role.Guardian` on the student subscription endpoint. Pass `dependentId` from body. Guardian requires `dependentId`.

- [ ] **Step 4: Commit**

```bash
git add packages/validators/src/subscription.schema.ts apps/api/src/modules/subscription/
git commit -m "feat(guardian): support dependentId in subscription module"
```

---

### Task 12: Update membership module for guardian visibility

**Files:**
- Modify: `apps/api/src/modules/membership/membership.repository.postgres.ts`
- Modify: `apps/api/src/modules/membership/membership.routes.ts`

- [ ] **Step 1: Include dependents in member list response**

Update the `GET /memberships/academy/:id` handler to also return dependents with guardian info. Add a join or separate query to include dependent data in the response when the requester is a manager.

- [ ] **Step 2: Allow guardian role in membership request flow**

Ensure `POST /memberships/request` works for guardians (it already works for students — just add `Role.Guardian` to the authorize call).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/membership/
git commit -m "feat(guardian): include dependents in member list and allow guardian membership"
```

---

## Phase 4: Mobile — Guardian Onboarding & Home

### Task 13: Add guardian to onboarding user type selection

**Files:**
- Modify: `apps/mobile/app/(onboarding)/user-type.tsx`

- [ ] **Step 1: Add guardian role to ROLES array**

In `apps/mobile/app/(onboarding)/user-type.tsx`, add the guardian option:

```typescript
import { GraduationCap, User, Users } from "lucide-react-native";

const ROLES = [
  {
    key: "instructor",
    label: "Instrutor",
    description: "Ensine aulas e acompanhe o progresso dos alunos",
    Icon: GraduationCap,
  },
  {
    key: "student",
    label: "Aluno",
    description: "Treine, registre presença e acompanhe sua graduação",
    Icon: User,
  },
  {
    key: "guardian",
    label: "Responsável",
    description: "Gerencie o acesso dos seus filhos na academia",
    Icon: Users,
  },
] as const;
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(onboarding)/user-type.tsx
git commit -m "feat(guardian): add guardian role to onboarding user type selection"
```

---

### Task 14: Create dependent API hooks

**Files:**
- Create: `apps/mobile/lib/hooks/use-dependents.ts`

- [ ] **Step 1: Create hooks**

```typescript
// apps/mobile/lib/hooks/use-dependents.ts
import { useApi } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useDependents() {
  const api = useApi();
  return useQuery({
    queryKey: ["dependents", "me"],
    queryFn: () => api.get("/dependents/me"),
  });
}

export function useDependent(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["dependents", id],
    queryFn: () => api.get(`/dependents/${id}`),
    enabled: !!id,
  });
}

export function useCreateDependent() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      birthDate: string;
      belt: string;
      stripes: number;
    }) => api.post("/dependents", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dependents"] });
    },
  });
}

export function useUpdateDependent() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id: string;
      name?: string;
      birthDate?: string;
    }) => api.put(`/dependents/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dependents"] });
    },
  });
}

export function useDeleteDependent() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/dependents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dependents"] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/lib/hooks/use-dependents.ts
git commit -m "feat(guardian): add dependent API hooks for mobile"
```

---

### Task 15: Create guardian navigation layout and home screen

**Files:**
- Create: `apps/mobile/app/(app)/(guardian)/_layout.tsx`
- Create: `apps/mobile/app/(app)/(guardian)/(home)/index.tsx`
- Create: `apps/mobile/app/(app)/(guardian)/(more)/index.tsx`

- [ ] **Step 1: Create guardian tab layout**

Create `apps/mobile/app/(app)/(guardian)/_layout.tsx` following the same tab layout pattern as the student layout, with 4 tabs: Início, Aulas, Avisos, Mais. Reference design node `wW12t` for the Guardian Home.

- [ ] **Step 2: Create guardian home screen**

Create `apps/mobile/app/(app)/(guardian)/(home)/index.tsx` with:
- Academy header (same as student)
- "Meus Dependentes" shortcut card (prominent, taps to dependents list)
- Today's classes section (reuse `useClasses` hook)
- Recent activity feed

Reference design node `wW12t`.

- [ ] **Step 3: Create guardian more menu**

Create `apps/mobile/app/(app)/(guardian)/(more)/index.tsx` with menu items: Avisos, Dependentes (with "Novo" badge), Notificações, and Sair. Reference design node `CbB3z`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/(guardian)/
git commit -m "feat(guardian): add guardian navigation layout, home screen, and more menu"
```

---

### Task 16: Create dependents list, detail, and form screens

**Files:**
- Create: `apps/mobile/app/(app)/(guardian)/(dependents)/index.tsx`
- Create: `apps/mobile/app/(app)/(guardian)/(dependents)/[dependentId].tsx`
- Create: `apps/mobile/app/(app)/(guardian)/(dependents)/create.tsx`
- Create: `apps/mobile/app/(app)/(guardian)/(dependents)/edit/[dependentId].tsx`

- [ ] **Step 1: Create dependents list screen**

Reference design node `GvNHl`. Shows dependent cards with name, age, belt, subscription status. FAB to add new. Tap navigates to detail.

- [ ] **Step 2: Create dependent detail screen**

Reference design node `VOMg6`. Shows profile header, stats (subscription, check-ins), 2x2 action grid, delete button with confirmation.

- [ ] **Step 3: Create add dependent form**

Reference design node `tSCJf`. Form with name, birthDate, belt selector. On submit calls `useCreateDependent()`.

- [ ] **Step 4: Create edit dependent form**

Reference design node `w22HU`. Same form but pre-filled, belt field locked with lock icon and helper text.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(app)/(guardian)/(dependents)/
git commit -m "feat(guardian): add dependents list, detail, create, and edit screens"
```

---

### Task 17: Create guardian dependent onboarding screen

**Files:**
- Create: `apps/mobile/app/(app)/(guardian)/(onboarding)/register-dependent.tsx`

- [ ] **Step 1: Create mandatory onboarding screen**

Reference design node `tSCJf`. After guardian approval, this screen forces registration of at least 1 dependent. Check `useDependents()` — if empty and role is guardian, redirect here from guardian home.

Form fields: name, birthDate, belt selector. After registering first dependent, option to "Adicionar outro" or "Continuar" → navigate to guardian home.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(guardian)/(onboarding)/
git commit -m "feat(guardian): add mandatory dependent onboarding for guardians"
```

---

## Phase 5: Mobile — Check-in & Subscription with Dependents

### Task 18: Create check-in dependent selection modal

**Files:**
- Create: `apps/mobile/components/DependentSelectionModal.tsx`
- Modify: `apps/mobile/app/(app)/(student)/(classes)/[classId].tsx` (or equivalent class detail screen)

- [ ] **Step 1: Create DependentSelectionModal component**

Reference design node `FWURk`. Bottom sheet modal with:
- Title "Check-in para quem?"
- "Eu" option (only for students, not guardians) with user name + belt
- Each dependent with name + belt + subscription status badge
- On select, calls the existing check-in flow with optional `dependentId`

```typescript
// apps/mobile/components/DependentSelectionModal.tsx
type DependentSelectionModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (dependentId?: string) => void;
  dependents: Array<{ id: string; name: string; /* ... */ }>;
  showSelfOption: boolean; // false for guardian
  userName?: string;
};
```

- [ ] **Step 2: Integrate modal into class detail screen**

When user has dependents (from `useDependents()`), show the modal instead of directly checking in. Pass selected `dependentId` to the check-in mutation.

- [ ] **Step 3: Update useCheckin hook to accept dependentId**

In `apps/mobile/lib/hooks/use-checkin.ts`, update the mutation function:

```typescript
export function useCheckin() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { classId: string; date: string; dependentId?: string }) =>
      api.post("/checkins", body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["checkins", variables.classId, variables.date] });
      queryClient.invalidateQueries({ queryKey: ["checkins", "me"] });
    },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/DependentSelectionModal.tsx apps/mobile/lib/hooks/use-checkin.ts apps/mobile/app/(app)/(student)/(classes)/
git commit -m "feat(guardian): add dependent selection modal for check-in"
```

---

### Task 19: Create consolidated subscription screen

**Files:**
- Create: `apps/mobile/app/(app)/(guardian)/(subscription)/index.tsx`

- [ ] **Step 1: Create consolidated subscription screen**

Reference design node `jK9DG`. Shows stacked subscription cards per dependent:
- For Student: own subscription first, then dependents'
- For Guardian: only dependents' subscription cards
- Each card shows dependent name, plan name, price, status badge, expiry date
- "Alterar plano" → existing plan selection flow with `dependentId` param
- "Escolher plano" for dependents without a plan

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(guardian)/(subscription)/
git commit -m "feat(guardian): add consolidated subscription screen"
```

---

## Phase 6: Mobile — Student with Dependents

### Task 20: Add dependents menu item for students

**Files:**
- Modify: `apps/mobile/app/(app)/(student)/(more)/index.tsx` (or equivalent student more menu)

- [ ] **Step 1: Add "Dependentes" menu item**

Add a "Dependentes" menu item after "Avisos" in the student more menu. Only shown when user has dependents (or always, to allow adding). Navigation goes to shared dependents list screen.

- [ ] **Step 2: Create student dependents route**

Symlink or create a thin screen that reuses the same dependents list/detail/form components from the guardian flow.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/(student)/
git commit -m "feat(guardian): add dependents menu item for students with dependents"
```

---

## Phase 7: Backend — Unit Tests

### Task 21: Write unit tests for dependent service

**Files:**
- Create: `apps/api/src/modules/dependent/dependent.repository.in-memory.ts`
- Create: `apps/api/src/modules/dependent/dependent.service.test.ts`

- [ ] **Step 1: Create in-memory repository**

Implement `IDependentRepository` with an in-memory array for testing. Follow the same pattern as other in-memory repos in the project.

- [ ] **Step 2: Write service tests**

Test cases:
- Guardian can create a dependent
- Student with active membership can create a dependent
- Instructor cannot create a dependent (403)
- Guardian can list their own dependents
- Guardian cannot see another guardian's dependent (404)
- Manager can see any dependent in their academy
- Guardian can update their own dependent
- Guardian can delete their own dependent
- `assertGuardianOwnership` throws for wrong guardian

- [ ] **Step 3: Run tests**

```bash
cd apps/api && pnpm test:unit
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/dependent/
git commit -m "test(guardian): add dependent service unit tests"
```

---

### Task 22: Write unit tests for checkin service with dependentId

**Files:**
- Modify: `apps/api/src/modules/checkin/checkin.service.test.ts`

- [ ] **Step 1: Add test cases for dependent check-in**

Test cases:
- Guardian can check in for their dependent
- Guardian cannot check in without dependentId (400)
- Student can check in for themselves (dependentId = undefined)
- Student can check in for their dependent (dependentId provided)
- Weekly limit is enforced per dependent, not shared with guardian
- Duplicate dependent check-in returns 409

- [ ] **Step 2: Run tests**

```bash
cd apps/api && pnpm test:unit
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/checkin/checkin.service.test.ts
git commit -m "test(guardian): add checkin service tests for dependent check-in"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1–4 | Foundation: types, schema, migration, validators |
| 2 | 5–8 | Backend: dependent CRUD module |
| 3 | 9–12 | Backend: modify checkin, graduation, subscription, membership |
| 4 | 13–17 | Mobile: guardian onboarding, home, dependents screens |
| 5 | 18–19 | Mobile: check-in modal, consolidated subscription |
| 6 | 20 | Mobile: student with dependents flow |
| 7 | 21–22 | Backend: unit tests |
