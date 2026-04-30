# Event-Triggered Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect existing business logic to the notification dispatch pipeline so users receive push notifications when real academy events happen (class changes, payments, promotions, new members, etc.).

**Architecture:** A thin `NotificationDispatcher` class wraps `NotificationService.send()` with recipient resolution (UUID→clerkUserId), template lookup, and fire-and-forget error handling. Each service that triggers events receives an optional dispatcher dependency and calls it after successful operations. The dispatcher resolves clerkUserIds via a new repository method, then delegates to the existing notification pipeline.

**Tech Stack:** Express.js, Drizzle ORM, BullMQ (existing notification pipeline), TypeScript.

---

## File Structure

### New files
- **Create:** `apps/api/src/modules/notification/notification-templates.ts` — All notification text templates in Portuguese, organized by category
- **Create:** `apps/api/src/modules/notification/notification-dispatcher.ts` — High-level dispatcher that resolves recipients (UUID→clerkUserId), picks template, calls NotificationService.send() with fire-and-forget
- **Create:** `apps/api/src/modules/notification/notification-dispatcher.test.ts` — Unit tests for dispatcher

### Modified files (add dispatcher dependency + calls)
- **Modify:** `apps/api/src/modules/membership/membership.service.ts` — Add dispatcher call in `approve()`
- **Modify:** `apps/api/src/modules/graduation/graduation.service.ts` — Add dispatcher call in `promoteMember()`
- **Modify:** `apps/api/src/modules/payment/payment.service.ts` — Add dispatcher call in `confirmManual()`
- **Modify:** `apps/api/src/modules/class/class.service.ts` — Add dispatcher call in `update()` and `deactivate()`
- **Modify:** `apps/api/src/modules/checkin/checkin.service.ts` — Add dispatcher call in `checkIn()` for anomaly warnings

### Modified files (repository additions)
- **Modify:** `apps/api/src/modules/user/user.repository.ts` — Add `findClerkIdsByInternalIds()` and `findClerkIdByInternalId()`
- **Modify:** `apps/api/src/modules/user/user.repository.postgres.ts` — Implement new methods
- **Modify:** `apps/api/src/modules/user/user.repository.in-memory.ts` — Implement new methods (if exists)
- **Modify:** `apps/api/src/modules/membership/membership.repository.ts` — Add `findManagerClerkIdsByAcademy()`
- **Modify:** `apps/api/src/modules/membership/membership.repository.postgres.ts` — Implement new method

### Modified files (route wiring)
- **Modify:** `apps/api/src/modules/membership/membership.routes.ts` — Wire dispatcher into MembershipService
- **Modify:** `apps/api/src/modules/graduation/graduation.routes.ts` — Wire dispatcher into GraduationService
- **Modify:** `apps/api/src/modules/payment/payment.routes.ts` — Wire dispatcher into PaymentService
- **Modify:** `apps/api/src/modules/class/class.routes.ts` — Wire dispatcher into ClassService
- **Modify:** `apps/api/src/modules/checkin/checkin.routes.ts` — Wire dispatcher into CheckinService

---

## Task 1: Notification templates

**Files:**
- Create: `apps/api/src/modules/notification/notification-templates.ts`

- [ ] **Step 1: Create the templates file**

```typescript
// apps/api/src/modules/notification/notification-templates.ts

import type { NotificationRow } from "./notification.repository.js";

type Category = NotificationRow["category"];

type NotificationTemplate = {
  title: string;
  body: (...args: string[]) => string;
};

export const notificationTemplates: Record<string, NotificationTemplate> = {
  class_updated: {
    title: "Aula alterada",
    body: (className: string) =>
      `A aula "${className}" teve alterações no horário.`,
  },
  class_deactivated: {
    title: "Aula cancelada",
    body: (className: string) =>
      `A aula "${className}" foi cancelada.`,
  },
  payment_confirmed: {
    title: "Pagamento confirmado",
    body: (planName: string) =>
      `Seu pagamento para o plano "${planName}" foi confirmado.`,
  },
  belt_promotion: {
    title: "Nova graduação registrada!",
    body: (belt: string, stripes: string) =>
      `Parabéns! Você foi promovido para faixa ${belt} com ${stripes} grau(s).`,
  },
  new_member: {
    title: "Novo aluno na academia",
    body: (memberName: string) =>
      `${memberName} acabou de entrar na academia.`,
  },
  checkin_anomaly: {
    title: "Check-in sem assinatura ativa",
    body: (studentName: string, className: string) =>
      `${studentName} fez check-in na aula "${className}" com assinatura vencida ou pagamento pendente.`,
  },
};

export function getTemplate(key: string): NotificationTemplate | undefined {
  return notificationTemplates[key];
}

export function categoryForTemplateKey(key: string): Category {
  const map: Record<string, Category> = {
    class_updated: "class_change",
    class_deactivated: "class_change",
    payment_confirmed: "payment",
    belt_promotion: "belt_promotion",
    new_member: "new_member",
    checkin_anomaly: "checkin_anomaly",
  };
  return map[key] ?? "announcement";
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/notification/notification-templates.ts
git commit -m "feat(api): add notification text templates in Portuguese (TAT-97)"
```

---

## Task 2: User repository — clerkUserId resolution

**Files:**
- Modify: `apps/api/src/modules/user/user.repository.ts`
- Modify: `apps/api/src/modules/user/user.repository.postgres.ts`

- [ ] **Step 1: Add methods to IUserRepository interface**

Add to the end of the `IUserRepository` interface in `apps/api/src/modules/user/user.repository.ts`:

```typescript
  findClerkIdByInternalId(userId: string): Promise<string | undefined>;

  findClerkIdsByInternalIds(userIds: string[]): Promise<Map<string, string>>;
```

- [ ] **Step 2: Implement in Postgres repository**

Read `apps/api/src/modules/user/user.repository.postgres.ts` first, then add these methods to the `PostgresUserRepository` class:

```typescript
  async findClerkIdByInternalId(userId: string): Promise<string | undefined> {
    const [row] = await this.db
      .select({ clerkUserId: users.clerkUserId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.clerkUserId;
  }

  async findClerkIdsByInternalIds(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: users.id, clerkUserId: users.clerkUserId })
      .from(users)
      .where(inArray(users.id, userIds));
    return new Map(rows.map((r) => [r.id, r.clerkUserId]));
  }
```

Make sure `inArray` is imported from `drizzle-orm` at the top.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/user/user.repository.ts apps/api/src/modules/user/user.repository.postgres.ts
git commit -m "feat(api): add clerkUserId resolution methods to user repository (TAT-97)"
```

---

## Task 3: Membership repository — manager clerkUserIds

**Files:**
- Modify: `apps/api/src/modules/membership/membership.repository.ts`
- Modify: `apps/api/src/modules/membership/membership.repository.postgres.ts`

- [ ] **Step 1: Add method to IMembershipRepository interface**

Add to `apps/api/src/modules/membership/membership.repository.ts`:

```typescript
  findManagerClerkIdsByAcademy(academyId: string): Promise<string[]>;
```

- [ ] **Step 2: Implement in Postgres repository**

Read `apps/api/src/modules/membership/membership.repository.postgres.ts` first, then add this method:

```typescript
  async findManagerClerkIdsByAcademy(academyId: string): Promise<string[]> {
    const rows = await this.db
      .select({ clerkUserId: users.clerkUserId })
      .from(academyMemberships)
      .innerJoin(users, eq(users.id, academyMemberships.userId))
      .where(
        and(
          eq(academyMemberships.academyId, academyId),
          eq(academyMemberships.role, "manager"),
          eq(academyMemberships.isActive, true),
        ),
      );
    return rows.map((r) => r.clerkUserId);
  }
```

Make sure `users` is imported from `@tatame/db` and `and` from `drizzle-orm`.

- [ ] **Step 3: Also implement in in-memory repository**

Read `apps/api/src/modules/membership/membership.repository.in-memory.ts` and add:

```typescript
  async findManagerClerkIdsByAcademy(_academyId: string): Promise<string[]> {
    return [];
  }
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/membership/membership.repository.ts apps/api/src/modules/membership/membership.repository.postgres.ts apps/api/src/modules/membership/membership.repository.in-memory.ts
git commit -m "feat(api): add manager clerkUserId resolution to membership repository (TAT-97)"
```

---

## Task 4: NotificationDispatcher + tests

**Files:**
- Create: `apps/api/src/modules/notification/notification-dispatcher.ts`
- Create: `apps/api/src/modules/notification/notification-dispatcher.test.ts`

- [ ] **Step 1: Create the dispatcher**

```typescript
// apps/api/src/modules/notification/notification-dispatcher.ts

import { logger } from "../../lib/logger.js";
import type { NotificationService } from "./notification.service.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import {
  getTemplate,
  categoryForTemplateKey,
} from "./notification-templates.js";

export class NotificationDispatcher {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly userRepo: IUserRepository,
    private readonly membershipRepo: IMembershipRepository,
  ) {}

  /**
   * Send a notification to specific users (by internal UUID).
   * Resolves UUIDs to clerkUserIds, then dispatches.
   * Fire-and-forget: errors are logged, never thrown.
   */
  async notifyUsers(
    templateKey: string,
    userIds: string[],
    templateArgs: string[],
    opts?: { academyId?: string; data?: Record<string, unknown> },
  ): Promise<void> {
    try {
      const template = getTemplate(templateKey);
      if (!template) {
        logger.warn({ templateKey }, "[dispatcher] Unknown template key");
        return;
      }

      const clerkIdMap = await this.userRepo.findClerkIdsByInternalIds(userIds);
      const recipientIds = userIds
        .map((id) => clerkIdMap.get(id))
        .filter((id): id is string => id !== undefined);

      if (recipientIds.length === 0) return;

      await this.notificationService.send({
        recipientIds,
        title: template.title,
        body: template.body(...templateArgs),
        category: categoryForTemplateKey(templateKey),
        academyId: opts?.academyId,
        data: opts?.data,
      });
    } catch (err) {
      logger.error({ err, templateKey }, "[dispatcher] Failed to send notification");
    }
  }

  /**
   * Send a notification to all managers of an academy.
   * Fire-and-forget: errors are logged, never thrown.
   */
  async notifyAcademyManagers(
    templateKey: string,
    academyId: string,
    templateArgs: string[],
    opts?: { data?: Record<string, unknown> },
  ): Promise<void> {
    try {
      const template = getTemplate(templateKey);
      if (!template) {
        logger.warn({ templateKey }, "[dispatcher] Unknown template key");
        return;
      }

      const recipientIds =
        await this.membershipRepo.findManagerClerkIdsByAcademy(academyId);

      if (recipientIds.length === 0) return;

      await this.notificationService.send({
        recipientIds,
        title: template.title,
        body: template.body(...templateArgs),
        category: categoryForTemplateKey(templateKey),
        academyId,
        data: opts?.data,
      });
    } catch (err) {
      logger.error({ err, templateKey }, "[dispatcher] Failed to send notification to managers");
    }
  }
}
```

- [ ] **Step 2: Write tests**

```typescript
// apps/api/src/modules/notification/notification-dispatcher.test.ts

import { describe, expect, it, vi } from "vitest";
import { NotificationDispatcher } from "./notification-dispatcher.js";

function setup() {
  const notificationService = {
    send: vi.fn().mockResolvedValue([]),
  };
  const userRepo = {
    findClerkIdsByInternalIds: vi.fn().mockResolvedValue(
      new Map([
        ["uuid-1", "clerk_1"],
        ["uuid-2", "clerk_2"],
      ]),
    ),
    findClerkIdByInternalId: vi.fn(),
  };
  const membershipRepo = {
    findManagerClerkIdsByAcademy: vi.fn().mockResolvedValue(["clerk_mgr_1"]),
  };

  const dispatcher = new NotificationDispatcher(
    notificationService as any,
    userRepo as any,
    membershipRepo as any,
  );

  return { dispatcher, notificationService, userRepo, membershipRepo };
}

describe("NotificationDispatcher", () => {
  describe("notifyUsers", () => {
    it("resolves UUIDs to clerkUserIds and sends notification", async () => {
      const { dispatcher, notificationService, userRepo } = setup();

      await dispatcher.notifyUsers(
        "payment_confirmed",
        ["uuid-1"],
        ["Plano Mensal"],
        { academyId: "acad-1" },
      );

      expect(userRepo.findClerkIdsByInternalIds).toHaveBeenCalledWith(["uuid-1"]);
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientIds: ["clerk_1"],
          title: "Pagamento confirmado",
          body: 'Seu pagamento para o plano "Plano Mensal" foi confirmado.',
          category: "payment",
          academyId: "acad-1",
        }),
      );
    });

    it("skips when no clerkUserIds resolved", async () => {
      const { dispatcher, notificationService, userRepo } = setup();
      userRepo.findClerkIdsByInternalIds.mockResolvedValue(new Map());

      await dispatcher.notifyUsers("payment_confirmed", ["unknown"], ["Plan"]);

      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it("does not throw on error", async () => {
      const { dispatcher, notificationService } = setup();
      notificationService.send.mockRejectedValue(new Error("boom"));

      await expect(
        dispatcher.notifyUsers("payment_confirmed", ["uuid-1"], ["Plan"]),
      ).resolves.not.toThrow();
    });

    it("skips unknown template key", async () => {
      const { dispatcher, notificationService } = setup();

      await dispatcher.notifyUsers("unknown_key", ["uuid-1"], []);

      expect(notificationService.send).not.toHaveBeenCalled();
    });
  });

  describe("notifyAcademyManagers", () => {
    it("resolves managers and sends notification", async () => {
      const { dispatcher, notificationService, membershipRepo } = setup();

      await dispatcher.notifyAcademyManagers(
        "new_member",
        "acad-1",
        ["João Silva"],
      );

      expect(membershipRepo.findManagerClerkIdsByAcademy).toHaveBeenCalledWith("acad-1");
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientIds: ["clerk_mgr_1"],
          title: "Novo aluno na academia",
          body: "João Silva acabou de entrar na academia.",
          category: "new_member",
          academyId: "acad-1",
        }),
      );
    });

    it("skips when no managers found", async () => {
      const { dispatcher, notificationService, membershipRepo } = setup();
      membershipRepo.findManagerClerkIdsByAcademy.mockResolvedValue([]);

      await dispatcher.notifyAcademyManagers("new_member", "acad-1", ["João"]);

      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it("does not throw on error", async () => {
      const { dispatcher, notificationService } = setup();
      notificationService.send.mockRejectedValue(new Error("boom"));

      await expect(
        dispatcher.notifyAcademyManagers("new_member", "acad-1", ["João"]),
      ).resolves.not.toThrow();
    });
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd apps/api && npx vitest run src/modules/notification/notification-dispatcher.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/notification/notification-dispatcher.ts apps/api/src/modules/notification/notification-dispatcher.test.ts
git commit -m "feat(api): add NotificationDispatcher with recipient resolution (TAT-97)"
```

---

## Task 5: Integrate — membership approve (new member)

**Files:**
- Modify: `apps/api/src/modules/membership/membership.service.ts`
- Modify: `apps/api/src/modules/membership/membership.routes.ts`

- [ ] **Step 1: Add optional dispatcher to MembershipService**

In `membership.service.ts`, add dispatcher as optional constructor param:

```typescript
import type { NotificationDispatcher } from "../notification/notification-dispatcher.js";
```

Change constructor:
```typescript
  constructor(
    private readonly membershipRepo: IMembershipRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly dispatcher?: NotificationDispatcher,
  ) {}
```

- [ ] **Step 2: Add notification call in approve()**

After the successful transaction in `approve()` (after `return this.membershipRepo.withTransaction(...)` resolves), add:

```typescript
  async approve(membershipId: string, managerUserId: string) {
    // ... existing code ...

    const result = await this.membershipRepo.withTransaction(async (txRepo) => {
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

    // Fire-and-forget: notify managers about new member
    if (this.dispatcher) {
      const user = await this.membershipRepo.findById(membershipId);
      if (user) {
        // We need the member's name. Get it from the detail view.
        const detail = await this.membershipRepo.findDetailById(membershipId);
        const memberName = detail?.userName ?? "Novo membro";
        this.dispatcher.notifyAcademyManagers(
          "new_member",
          m.academyId,
          [memberName],
        );
      }
    }

    return result;
  }
```

Wait — looking at the original code, `approve` returns the result directly from the transaction. We need to refactor slightly to capture the result, send the notification, then return. The updated `approve` method:

Replace the entire `approve` method:

```typescript
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

    const result = await this.membershipRepo.withTransaction(async (txRepo) => {
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

    if (this.dispatcher) {
      const detail = await this.membershipRepo.findDetailById(membershipId);
      this.dispatcher.notifyAcademyManagers(
        "new_member",
        m.academyId,
        [detail?.userName ?? "Novo membro"],
      );
    }

    return result;
  }
```

- [ ] **Step 3: Wire dispatcher in routes**

Read `apps/api/src/modules/membership/membership.routes.ts` to find where `MembershipService` is instantiated. Add the dispatcher:

Add imports:
```typescript
import { loadEnv } from "@tatame/config";
import { PostgresNotificationRepository } from "../notification/notification.repository.postgres.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import { getNotificationQueue } from "../notification/notification.queue.js";
import { NotificationService } from "../notification/notification.service.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { NotificationDispatcher } from "../notification/notification-dispatcher.js";
```

Create a helper to build the dispatcher (reusable across routes files):

```typescript
function buildDispatcher(db: Database) {
  const env = loadEnv();
  const queue = env.REDIS_URL ? getNotificationQueue(env.REDIS_URL) : null;
  const notificationService = new NotificationService(
    new PostgresNotificationRepository(db),
    new PostgresPushTokenRepository(db),
    queue,
  );
  return new NotificationDispatcher(
    notificationService,
    new PostgresUserRepository(db),
    new PostgresMembershipRepository(db),
  );
}
```

Update the MembershipService instantiation to pass the dispatcher:

```typescript
const membershipService = new MembershipService(
  new PostgresMembershipRepository(db),
  new PostgresAcademyRepository(db),
  buildDispatcher(db),
);
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/membership/membership.service.ts apps/api/src/modules/membership/membership.routes.ts
git commit -m "feat(api): notify managers when new member approved (TAT-97)"
```

---

## Task 6: Integrate — graduation promote (belt promotion)

**Files:**
- Modify: `apps/api/src/modules/graduation/graduation.service.ts`
- Modify: `apps/api/src/modules/graduation/graduation.routes.ts`

- [ ] **Step 1: Add optional dispatcher to GraduationService**

Add import and constructor param:

```typescript
import type { NotificationDispatcher } from "../notification/notification-dispatcher.js";
```

Add to constructor (as last param):
```typescript
  constructor(
    private readonly graduationRepo: IGraduationRepository,
    private readonly membershipRepo: IMembershipRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly dispatcher?: NotificationDispatcher,
  ) {}
```

- [ ] **Step 2: Add notification in promoteMember()**

After the successful `replaceCurrentPromotion`, add notification before returning:

```typescript
  async promoteMember(opts: {
    // ... existing params ...
  }): Promise<BeltPromotionRow> {
    // ... existing validation code ...

    const result = await this.graduationRepo.replaceCurrentPromotion({
      userId: opts.targetUserId,
      academyId: opts.academyId,
      promotedBy: opts.actorUserId,
      belt: opts.belt,
      stripes: opts.stripes,
      notes: opts.notes,
    });

    if (this.dispatcher) {
      const beltNames: Record<string, string> = {
        white: "branca", blue: "azul", purple: "roxa", brown: "marrom", black: "preta",
      };
      this.dispatcher.notifyUsers(
        "belt_promotion",
        [opts.targetUserId],
        [beltNames[opts.belt] ?? opts.belt, String(opts.stripes)],
        { academyId: opts.academyId },
      );
    }

    return result;
  }
```

Note: the `return this.graduationRepo.replaceCurrentPromotion(...)` needs to be changed to capture the result first.

- [ ] **Step 3: Wire dispatcher in graduation routes**

Read `apps/api/src/modules/graduation/graduation.routes.ts` and add the dispatcher following the same pattern as membership routes. Build the dispatcher and pass it as 4th param to `GraduationService`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/graduation/graduation.service.ts apps/api/src/modules/graduation/graduation.routes.ts
git commit -m "feat(api): notify student on belt promotion (TAT-97)"
```

---

## Task 7: Integrate — payment confirmed

**Files:**
- Modify: `apps/api/src/modules/payment/payment.service.ts`
- Modify: `apps/api/src/modules/payment/payment.routes.ts`

- [ ] **Step 1: Add optional dispatcher to PaymentService**

```typescript
import type { NotificationDispatcher } from "../notification/notification-dispatcher.js";
```

Add to constructor as last param:
```typescript
  constructor(
    private readonly paymentRepo: IPaymentRepository,
    private readonly studentSubRepo: IStudentSubscriptionRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly dispatcher?: NotificationDispatcher,
  ) {}
```

- [ ] **Step 2: Add notification in confirmManual()**

After creating the payment, notify the student:

```typescript
  async confirmManual(
    managerUserId: string,
    academyId: string,
    body: ConfirmManualPaymentBody,
  ): Promise<PaymentRow> {
    // ... existing validation ...

    const result = await this.paymentRepo.create({
      // ... existing create args ...
    });

    if (this.dispatcher) {
      const sub = await this.studentSubRepo.findByIdWithPlan(body.subscriptionId);
      this.dispatcher.notifyUsers(
        "payment_confirmed",
        [result.userId],
        [sub?.plan.name ?? "assinatura"],
        { academyId },
      );
    }

    return result;
  }
```

- [ ] **Step 3: Wire dispatcher in payment routes**

Read `apps/api/src/modules/payment/payment.routes.ts` and add the dispatcher.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/payment/payment.service.ts apps/api/src/modules/payment/payment.routes.ts
git commit -m "feat(api): notify student when payment confirmed (TAT-97)"
```

---

## Task 8: Integrate — class update/deactivate

**Files:**
- Modify: `apps/api/src/modules/class/class.service.ts`
- Modify: `apps/api/src/modules/class/class.routes.ts`

- [ ] **Step 1: Add optional dispatcher + membershipRepo for recipients to ClassService**

The ClassService already has `membershipRepo`. Add dispatcher:

```typescript
import type { NotificationDispatcher } from "../notification/notification-dispatcher.js";
```

Add to constructor as last param:
```typescript
  constructor(
    private readonly classRepo: IClassRepository,
    private readonly membershipRepo: IMembershipRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly dispatcher?: NotificationDispatcher,
  ) {}
```

- [ ] **Step 2: Add notification in update() for schedule changes**

After a successful update, if time-related fields changed, notify students:

```typescript
  async update(ctx: ClassAuthContext, classId: string, body: UpdateClassBody) {
    // ... existing code ...

    const updated = await this.classRepo.update(classId, {
      // ... existing update args ...
    });

    if (!updated) {
      throw new HttpError(404, "Class not found");
    }

    // Notify if schedule-related fields changed
    if (this.dispatcher && (body.startTime || body.endTime || body.dayOfWeek)) {
      this.dispatcher.notifyAcademyManagers(
        "class_updated",
        ctx.activeAcademyId,
        [updated.name],
      );
    }

    return updated;
  }
```

Wait — we want to notify students, not managers. But `notifyAcademyManagers` only gets managers. We need to notify all academy members. Let's add a helper. Actually, we can use `notifyUsers` but we'd need to get all student member IDs. Let's add a method to membership repo.

Actually, let's keep it simple. Add `findActiveStudentClerkIdsByAcademy` to the membership repository.

Add to `IMembershipRepository` in `membership.repository.ts`:
```typescript
  findActiveStudentClerkIdsByAcademy(academyId: string): Promise<string[]>;
```

Add postgres impl:
```typescript
  async findActiveStudentClerkIdsByAcademy(academyId: string): Promise<string[]> {
    const rows = await this.db
      .select({ clerkUserId: users.clerkUserId })
      .from(academyMemberships)
      .innerJoin(users, eq(users.id, academyMemberships.userId))
      .where(
        and(
          eq(academyMemberships.academyId, academyId),
          eq(academyMemberships.role, "student"),
          eq(academyMemberships.isActive, true),
        ),
      );
    return rows.map((r) => r.clerkUserId);
  }
```

Add in-memory impl:
```typescript
  async findActiveStudentClerkIdsByAcademy(_academyId: string): Promise<string[]> {
    return [];
  }
```

Then add a new dispatcher method `notifyAcademyStudents`:

Add to `NotificationDispatcher`:
```typescript
  async notifyAcademyStudents(
    templateKey: string,
    academyId: string,
    templateArgs: string[],
    opts?: { data?: Record<string, unknown> },
  ): Promise<void> {
    try {
      const template = getTemplate(templateKey);
      if (!template) {
        logger.warn({ templateKey }, "[dispatcher] Unknown template key");
        return;
      }

      const recipientIds =
        await this.membershipRepo.findActiveStudentClerkIdsByAcademy(academyId);

      if (recipientIds.length === 0) return;

      await this.notificationService.send({
        recipientIds,
        title: template.title,
        body: template.body(...templateArgs),
        category: categoryForTemplateKey(templateKey),
        academyId,
        data: opts?.data,
      });
    } catch (err) {
      logger.error({ err, templateKey }, "[dispatcher] Failed to send notification to students");
    }
  }
```

Now use it in `ClassService.update()`:

```typescript
    if (this.dispatcher && (body.startTime !== undefined || body.endTime !== undefined || body.dayOfWeek !== undefined)) {
      this.dispatcher.notifyAcademyStudents(
        "class_updated",
        ctx.activeAcademyId,
        [updated.name],
      );
    }
```

- [ ] **Step 3: Add notification in deactivate()**

```typescript
  async deactivate(ctx: ClassAuthContext, classId: string) {
    const existing = await this.loadForMutation(ctx, classId);

    const updated = await this.classRepo.update(classId, { isActive: false });
    if (!updated) {
      throw new HttpError(404, "Class not found");
    }

    if (this.dispatcher) {
      this.dispatcher.notifyAcademyStudents(
        "class_deactivated",
        ctx.activeAcademyId,
        [existing.name],
      );
    }

    return updated;
  }
```

- [ ] **Step 4: Wire dispatcher in class routes**

Read `apps/api/src/modules/class/class.routes.ts` and add the dispatcher.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/membership/membership.repository.ts apps/api/src/modules/membership/membership.repository.postgres.ts apps/api/src/modules/membership/membership.repository.in-memory.ts apps/api/src/modules/notification/notification-dispatcher.ts apps/api/src/modules/class/class.service.ts apps/api/src/modules/class/class.routes.ts
git commit -m "feat(api): notify students on class changes (TAT-97)"
```

---

## Task 9: Integrate — checkin anomaly

**Files:**
- Modify: `apps/api/src/modules/checkin/checkin.service.ts`
- Modify: `apps/api/src/modules/checkin/checkin.routes.ts`

- [ ] **Step 1: Add optional dispatcher to CheckinService**

```typescript
import type { NotificationDispatcher } from "../notification/notification-dispatcher.js";
```

Add to constructor as last param:
```typescript
  constructor(
    private readonly membershipRepo: IMembershipRepository,
    private readonly classRepo: IClassRepository,
    private readonly studentSubRepo: IStudentSubscriptionRepository,
    private readonly paymentRepo: IPaymentRepository,
    private readonly checkinRepo: ICheckinRepository,
    private readonly dispatcher?: NotificationDispatcher,
  ) {}
```

- [ ] **Step 2: Add anomaly notification in checkIn()**

After successful checkin, if there are warnings (subscriptionGrace or paymentOverdue), notify managers. We need the student name and class name. We already have `classRow` and can get user name from membership detail.

Inside the `withCheckinLock` callback, after creating the checkin, before returning:

Replace the try/catch block inside `withCheckinLock`:

```typescript
      try {
        const checkin = await this.checkinRepo.insert({
          classId: opts.classId,
          userId: opts.userId,
          date: opts.sessionDate,
          weekReference,
        });

        // Notify managers on checkin anomaly (subscription grace or payment overdue)
        if (this.dispatcher && (warnings.subscriptionGrace || warnings.paymentOverdue)) {
          const detail = await this.membershipRepo.findDetailById(membership.id);
          this.dispatcher.notifyAcademyManagers(
            "checkin_anomaly",
            opts.academyId,
            [detail?.userName ?? "Aluno", classRow.name],
          );
        }

        return { checkin, warnings };
      } catch (e) {
        if (isPostgresUniqueViolation(e)) {
          throw new HttpError(
            409,
            "Already checked in for this class on this date",
          );
        }
        throw e;
      }
```

- [ ] **Step 3: Wire dispatcher in checkin routes**

Read `apps/api/src/modules/checkin/checkin.routes.ts` and add the dispatcher.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/checkin/checkin.service.ts apps/api/src/modules/checkin/checkin.routes.ts
git commit -m "feat(api): notify managers on checkin anomaly (TAT-97)"
```

---

## Task 10: Run full test suite + type-check

- [ ] **Step 1: Run all unit tests**

```bash
cd apps/api && npx vitest run --project unit
```

Expected: all tests pass (existing + new dispatcher tests).

- [ ] **Step 2: Type-check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Fix any issues and commit**

If any fixes needed:

```bash
git add -A
git commit -m "fix(api): address test/type issues from event notifications (TAT-97)"
```
