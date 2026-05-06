# Apple IAP Bypass — Free Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile app fully functional on a limited free tier so Apple can't reject it under Guideline 3.1.1, while keeping Pro upgrade exclusively on the web.

**Architecture:** Backend enforces plan limits via middleware + service-level checks. Mobile intercepts 403 `PLAN_LIMIT_*` errors and shows a reusable modal. Manager layout auto-creates a free plan for new managers without subscriptions. Canceled/past_due Pro managers see a neutral blocked screen.

**Tech Stack:** Express (API), React Native / Expo (mobile), Drizzle ORM (Postgres), React Query (mobile data fetching), Zod (validators)

---

### Task 1: Plan Limit Constants and Validator Schema Update

**Files:**
- Create: `apps/api/src/modules/manager-subscription/plan-limits.ts`
- Modify: `packages/validators/src/manager-subscription.schema.ts`

- [ ] **Step 1: Create plan-limits.ts**

```typescript
// apps/api/src/modules/manager-subscription/plan-limits.ts
export const FREE_PLAN_LIMITS = {
  maxStudents: 30,
  maxInstructors: 1,
  maxClassesPerDay: 2,
  maxPlans: 1,
  allowAutoPayment: false,
} as const;
```

- [ ] **Step 2: Update managerLimitsResponseSchema**

In `packages/validators/src/manager-subscription.schema.ts`, replace the `instructors` field:

```typescript
// OLD
instructors: z.object({ allowed: z.boolean() }),

// NEW
instructors: z.object({ used: z.number(), limit: z.number().nullable() }),
```

The full updated schema:

```typescript
export const managerLimitsResponseSchema = z.object({
  students: z.object({ used: z.number(), limit: z.number().nullable() }),
  plans: z.object({ used: z.number(), limit: z.number().nullable() }),
  schedulesPerDay: z.object({
    maxUsed: z.number(),
    limit: z.number().nullable(),
  }),
  instructors: z.object({ used: z.number(), limit: z.number().nullable() }),
  blocked: z.boolean(),
  plan: z.enum(["free", "pro"]),
});
```

- [ ] **Step 3: Add `trialing` to managerSubscriptionResponseSchema status enum**

The DB schema has `trialing` but the validator doesn't. Fix:

```typescript
// OLD
status: z.enum(["active", "past_due", "canceled", "incomplete"]),

// NEW
status: z.enum(["active", "trialing", "past_due", "canceled", "incomplete"]),
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/manager-subscription/plan-limits.ts packages/validators/src/manager-subscription.schema.ts
git commit -m "feat: add plan limit constants and update validator schema"
```

---

### Task 2: Update require-active-plan Middleware

**Files:**
- Modify: `apps/api/src/middleware/require-active-plan.ts`
- Modify: `apps/api/src/express-augment.ts`

- [ ] **Step 1: Update middleware to accept `trialing` and neutralize error messages**

Replace the full content of `apps/api/src/middleware/require-active-plan.ts`:

```typescript
import type { NextFunction, Request, Response } from "express";
import { getDb } from "../lib/db.js";
import { PostgresManagerSubscriptionRepository } from "../modules/manager-subscription/manager-subscription.repository.postgres.js";

const subRepo = new PostgresManagerSubscriptionRepository(getDb());

export function requireActivePlan(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  void (async () => {
    const academyId = req.appAuth?.activeAcademyId;
    if (!academyId) {
      next();
      return;
    }

    if (req.appAuth?.role !== "manager") {
      next();
      return;
    }

    try {
      const sub = await subRepo.findByAcademyId(academyId);
      if (!sub) {
        res.status(403).json({
          error: "NO_SUBSCRIPTION",
          message: "Nenhuma conta encontrada.",
        });
        return;
      }

      if (
        sub.status === "active" ||
        sub.status === "trialing" ||
        sub.status === "incomplete"
      ) {
        req.appAuth = {
          ...req.appAuth,
          managerPlan: sub.plan,
          managerSubscriptionStatus: sub.status,
        };
        next();
        return;
      }

      res.status(403).json({
        error: "SUBSCRIPTION_BLOCKED",
        message: "Sua conta nao tem acesso no momento.",
      });
    } catch (e) {
      next(e);
    }
  })();
}
```

- [ ] **Step 2: Update express-augment.ts to include `trialing` in type**

In `apps/api/src/express-augment.ts`, update the `managerSubscriptionStatus` type:

```typescript
// OLD
managerSubscriptionStatus?: "active" | "past_due" | "canceled" | "incomplete";

// NEW
managerSubscriptionStatus?: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/middleware/require-active-plan.ts apps/api/src/express-augment.ts
git commit -m "feat: update require-active-plan to accept trialing, neutralize messages"
```

---

### Task 3: Implement POST /manager-subscriptions/free and GET /manager-subscriptions/limits

**Files:**
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.service.ts`
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts`

- [ ] **Step 1: Add createFree() and getLimits() to manager-subscription.service.ts**

Add these imports at the top of the file:

```typescript
import { FREE_PLAN_LIMITS } from "./plan-limits.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { ISubscriptionPlanRepository } from "../subscription/subscription.repository.js";
import type { IClassRepository } from "../class/class.repository.js";
```

Update the constructor to accept new dependencies:

```typescript
constructor(
  private readonly subRepo: IManagerSubscriptionRepository,
  private readonly acadRepo: IAcademyRepository,
  private readonly stripe: Stripe | null = null,
  private readonly membershipRepo?: IMembershipRepository,
  private readonly planRepo?: ISubscriptionPlanRepository,
  private readonly classRepo?: IClassRepository,
) {}
```

Add these methods to the class:

```typescript
async createFree(academyId: string): Promise<ManagerSubscriptionRow> {
  const existing = await this.subRepo.findByAcademyId(academyId);
  if (existing) {
    throw new HttpError(409, "Uma conta ja existe para esta academia.");
  }

  return this.subRepo.create({
    academyId,
    plan: "free",
    status: "active",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    currentPeriodEnd: null,
    trialEndsAt: null,
  });
}

async getLimits(academyId: string) {
  const sub = await this.subRepo.findByAcademyId(academyId);
  if (!sub) {
    return {
      plan: "free" as const,
      blocked: false,
      students: { used: 0, limit: FREE_PLAN_LIMITS.maxStudents },
      instructors: { used: 0, limit: FREE_PLAN_LIMITS.maxInstructors },
      plans: { used: 0, limit: FREE_PLAN_LIMITS.maxPlans },
      schedulesPerDay: { maxUsed: 0, limit: FREE_PLAN_LIMITS.maxClassesPerDay },
    };
  }

  const isFree = sub.plan === "free";
  const isBlocked = sub.status === "canceled" || sub.status === "past_due";

  // Count resources
  const studentCount = this.membershipRepo
    ? (await this.membershipRepo.findByAcademy(academyId, { role: "student", status: "active" })).length
    : 0;

  const instructorCount = this.membershipRepo
    ? (await this.membershipRepo.findByAcademy(academyId, { role: "instructor", status: "active" })).length
    : 0;

  const planCount = this.planRepo
    ? (await this.planRepo.findByAcademyId(academyId, { includeInactive: false })).length
    : 0;

  // Find max classes on any single day of week
  let maxClassesOnAnyDay = 0;
  if (this.classRepo) {
    for (let day = 0; day < 7; day++) {
      const classes = await this.classRepo.findByAcademyId(academyId, {
        dayOfWeek: day,
        includeInactive: false,
      });
      if (classes.length > maxClassesOnAnyDay) {
        maxClassesOnAnyDay = classes.length;
      }
    }
  }

  return {
    plan: sub.plan,
    blocked: isBlocked,
    students: {
      used: studentCount,
      limit: isFree ? FREE_PLAN_LIMITS.maxStudents : null,
    },
    instructors: {
      used: instructorCount,
      limit: isFree ? FREE_PLAN_LIMITS.maxInstructors : null,
    },
    plans: {
      used: planCount,
      limit: isFree ? FREE_PLAN_LIMITS.maxPlans : null,
    },
    schedulesPerDay: {
      maxUsed: maxClassesOnAnyDay,
      limit: isFree ? FREE_PLAN_LIMITS.maxClassesPerDay : null,
    },
  };
}
```

- [ ] **Step 2: Update getService() and add routes in manager-subscription.routes.ts**

First, add imports at the top of the routes file:

```typescript
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresSubscriptionPlanRepository } from "../subscription/subscription.repository.postgres.js";
import { PostgresClassRepository } from "../class/class.repository.postgres.js";
```

Add repository instantiations after the existing ones:

```typescript
const membershipRepo = new PostgresMembershipRepository(db);
const planRepo = new PostgresSubscriptionPlanRepository(db);
const classRepo = new PostgresClassRepository(db);
```

Update `getService()`:

```typescript
function getService() {
  return new ManagerSubscriptionService(
    subRepo,
    acadRepo,
    getStripe(),
    membershipRepo,
    planRepo,
    classRepo,
  );
}
```

Add the POST /free route (before the /checkout route):

```typescript
// POST /manager-subscriptions/free — create free plan for new managers
managerSubscriptionRouter.post(
  "/free",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const sub = await getService().createFree(req.appAuth!.activeAcademyId!);
      res.status(201).json(sub);
    } catch (e) {
      next(e);
    }
  },
);
```

Add the GET /limits route (after the /me route):

```typescript
// GET /manager-subscriptions/limits — get plan limits and usage
managerSubscriptionRouter.get(
  "/limits",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const limits = await getService().getLimits(req.appAuth!.activeAcademyId!);
      res.json(limits);
    } catch (e) {
      next(e);
    }
  },
);
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/manager-subscription/manager-subscription.service.ts apps/api/src/modules/manager-subscription/manager-subscription.routes.ts
git commit -m "feat: add POST /free and GET /limits endpoints for manager subscriptions"
```

---

### Task 4: Service-Level Plan Limit Enforcement

**Files:**
- Modify: `apps/api/src/modules/membership/membership.service.ts`
- Modify: `apps/api/src/modules/class/class.service.ts`
- Modify: `apps/api/src/modules/subscription/subscription.service.ts`
- Modify: `apps/api/src/modules/payment/payment.service.ts`

- [ ] **Step 1: Add limit enforcement to membership.service.ts approve()**

Add imports at the top:

```typescript
import { FREE_PLAN_LIMITS } from "../manager-subscription/plan-limits.js";
import type { IManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.js";
```

Update constructor:

```typescript
constructor(
  private readonly membershipRepo: IMembershipRepository,
  private readonly academyRepo: IAcademyRepository,
  private readonly dispatcher?: NotificationDispatcher,
  private readonly managerSubRepo?: IManagerSubscriptionRepository,
) {}
```

Add plan limit check at the beginning of `approve()`, right after the `assertManagerOwnsAcademy` call and the pending-status check (after line `if (m.status !== "pending") { ... }`), but before the `targetActive` check:

```typescript
// Plan limit enforcement
if (this.managerSubRepo) {
  const sub = await this.managerSubRepo.findByAcademyId(m.academyId);
  if (sub?.plan === "free") {
    if (m.role === "student") {
      const members = await this.membershipRepo.findByAcademy(m.academyId, {
        role: "student",
        status: "active",
      });
      if (members.length >= FREE_PLAN_LIMITS.maxStudents) {
        throw new HttpError(403, "Limite de alunos atingido para o plano atual", {
          code: "PLAN_LIMIT_STUDENTS",
        });
      }
    } else if (m.role === "instructor") {
      const instructors = await this.membershipRepo.findByAcademy(m.academyId, {
        role: "instructor",
        status: "active",
      });
      if (instructors.length >= FREE_PLAN_LIMITS.maxInstructors) {
        throw new HttpError(403, "Limite de instrutores atingido para o plano atual", {
          code: "PLAN_LIMIT_INSTRUCTORS",
        });
      }
    }
  }
}
```

Note: `HttpError` needs to support a `details` object for the `code` field. Check if it already does — if not, we'll handle it in Task 5.

- [ ] **Step 2: Add limit enforcement to class.service.ts create()**

Add imports:

```typescript
import { FREE_PLAN_LIMITS } from "../manager-subscription/plan-limits.js";
import type { IManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.js";
```

Update constructor:

```typescript
constructor(
  private readonly classRepo: IClassRepository,
  private readonly membershipRepo: IMembershipRepository,
  private readonly academyRepo: IAcademyRepository,
  private readonly dispatcher?: NotificationDispatcher,
  private readonly managerSubRepo?: IManagerSubscriptionRepository,
) {}
```

Add limit check in `create()`, after the `assertEndAfterStart` call and before the role check:

```typescript
// Plan limit enforcement
if (this.managerSubRepo) {
  const sub = await this.managerSubRepo.findByAcademyId(ctx.activeAcademyId);
  if (sub?.plan === "free") {
    const existing = await this.classRepo.findByAcademyId(ctx.activeAcademyId, {
      dayOfWeek: body.dayOfWeek,
      includeInactive: false,
    });
    if (existing.length >= FREE_PLAN_LIMITS.maxClassesPerDay) {
      throw new HttpError(403, "Limite de aulas por dia atingido para o plano atual", {
        code: "PLAN_LIMIT_CLASSES",
      });
    }
  }
}
```

- [ ] **Step 3: Add limit enforcement to subscription.service.ts createPlan()**

Add imports:

```typescript
import { FREE_PLAN_LIMITS } from "../manager-subscription/plan-limits.js";
import type { IManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.js";
```

Update constructor:

```typescript
constructor(
  private readonly planRepo: ISubscriptionPlanRepository,
  private readonly studentSubRepo: IStudentSubscriptionRepository,
  private readonly academyRepo: IAcademyRepository,
  private readonly managerSubRepo?: IManagerSubscriptionRepository,
) {}
```

Add limit check in `createPlan()`, after the `assertManagerOwnsAcademy` call:

```typescript
// Plan limit enforcement
if (this.managerSubRepo) {
  const sub = await this.managerSubRepo.findByAcademyId(academyId);
  if (sub?.plan === "free") {
    const plans = await this.planRepo.findByAcademyId(academyId, {
      includeInactive: false,
    });
    if (plans.length >= FREE_PLAN_LIMITS.maxPlans) {
      throw new HttpError(403, "Limite de planos atingido para o plano atual", {
        code: "PLAN_LIMIT_PLANS",
      });
    }
  }
}
```

- [ ] **Step 4: Add limit enforcement to payment.service.ts createCheckoutSession() and createPixQrCode()**

Add imports:

```typescript
import { FREE_PLAN_LIMITS } from "../manager-subscription/plan-limits.js";
import type { IManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.js";
```

Update constructor:

```typescript
constructor(
  private readonly paymentRepo: IPaymentRepository,
  private readonly studentSubRepo: IStudentSubscriptionRepository,
  private readonly academyRepo: IAcademyRepository,
  private readonly dispatcher?: NotificationDispatcher,
  private readonly managerSubRepo?: IManagerSubscriptionRepository,
) {}
```

Add at the very beginning of `createCheckoutSession()` (before the `subs` lookup):

```typescript
// Plan limit enforcement — free plan cannot use auto payment
if (this.managerSubRepo) {
  const managerSub = await this.managerSubRepo.findByAcademyId(academyId);
  if (managerSub?.plan === "free") {
    throw new HttpError(403, "Pagamentos automaticos nao estao disponiveis para o plano atual", {
      code: "PLAN_LIMIT_PAYMENTS",
    });
  }
}
```

Add the same check at the beginning of `createPixQrCode()`:

```typescript
// Plan limit enforcement — free plan cannot use auto payment
if (this.managerSubRepo) {
  const managerSub = await this.managerSubRepo.findByAcademyId(academyId);
  if (managerSub?.plan === "free") {
    throw new HttpError(403, "Pagamentos automaticos nao estao disponiveis para o plano atual", {
      code: "PLAN_LIMIT_PAYMENTS",
    });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/membership/membership.service.ts apps/api/src/modules/class/class.service.ts apps/api/src/modules/subscription/subscription.service.ts apps/api/src/modules/payment/payment.service.ts
git commit -m "feat: enforce plan limits in membership, class, subscription, and payment services"
```

---

### Task 5: Standardized Error Response with Code

**Files:**
- Modify: `apps/api/src/lib/http-error.ts`

- [ ] **Step 1: Check and update HttpError to support error code in response**

Read `apps/api/src/lib/http-error.ts`. If it doesn't already pass a `code` or `details` object to the response, update it. The goal is that when a service throws:

```typescript
throw new HttpError(403, "message", { code: "PLAN_LIMIT_STUDENTS" });
```

The API responds with:

```json
{ "error": "PLAN_LIMIT_STUDENTS", "message": "message" }
```

If HttpError only supports `(status, message)`, add a third optional `details` parameter:

```typescript
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
```

Then update the global error handler (likely in `apps/api/src/app.ts` or similar) so that when `HttpError` is thrown, if `details?.code` exists, it responds:

```typescript
res.status(err.status).json({
  error: err.details?.code ?? err.message,
  message: err.message,
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/lib/http-error.ts
git commit -m "feat: support error code in HttpError for plan limit responses"
```

---

### Task 6: Apply require-active-plan Middleware to Manager Routes

**Files:**
- Modify: `apps/api/src/modules/membership/membership.routes.ts`
- Modify: `apps/api/src/modules/class/class.routes.ts`
- Modify: `apps/api/src/modules/payment/payment.routes.ts`
- Modify: `apps/api/src/modules/subscription/subscription.routes.ts`

- [ ] **Step 1: Add import to each route file**

Add to each file:

```typescript
import { requireActivePlan } from "../../middleware/require-active-plan.js";
```

- [ ] **Step 2: Apply middleware to manager-only routes in membership.routes.ts**

Add `requireActivePlan` after `requireActiveAcademy` for these routes:
- `GET /pending`
- `PATCH /:membershipId/approve`
- `PATCH /:membershipId/reject`
- `PATCH /:membershipId/block`
- `PATCH /:membershipId/unblock`

Example for approve:

```typescript
membershipRouter.patch(
  "/:membershipId/approve",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  requireActivePlan,  // <-- ADD THIS
  async (req, res, next) => { ... }
);
```

- [ ] **Step 3: Apply middleware to class.routes.ts**

Add `requireActivePlan` after `requireActiveAcademy` for:
- `POST /` (create class)
- `PATCH /:classId` (update class)
- `DELETE /:classId` (deactivate class)

- [ ] **Step 4: Apply middleware to payment.routes.ts**

Add `requireActivePlan` after `requireActiveAcademy` for:
- `POST /` (confirm manual payment)

- [ ] **Step 5: Apply middleware to subscription.routes.ts**

Add `requireActivePlan` after `requireActiveAcademy` for:
- `POST /plans` (create plan)
- `PATCH /plans/:planId` (update plan)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/membership/membership.routes.ts apps/api/src/modules/class/class.routes.ts apps/api/src/modules/payment/payment.routes.ts apps/api/src/modules/subscription/subscription.routes.ts
git commit -m "feat: apply require-active-plan middleware to manager routes"
```

---

### Task 7: Wire New Dependencies in Route Files

**Files:**
- Modify: `apps/api/src/modules/membership/membership.routes.ts`
- Modify: `apps/api/src/modules/class/class.routes.ts`
- Modify: `apps/api/src/modules/subscription/subscription.routes.ts`
- Modify: `apps/api/src/modules/payment/payment.routes.ts`

The services now require `IManagerSubscriptionRepository` as an optional constructor parameter. Update the service instantiations in route files.

- [ ] **Step 1: Update membership.routes.ts**

Add import:

```typescript
import { PostgresManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.postgres.js";
```

Where `MembershipService` is instantiated, add the new dependency:

```typescript
const managerSubRepo = new PostgresManagerSubscriptionRepository(db);
// ... in the service construction:
new MembershipService(membershipRepo, academyRepo, dispatcher, managerSubRepo)
```

- [ ] **Step 2: Update class.routes.ts**

Same pattern — add `PostgresManagerSubscriptionRepository` import and pass to `ClassService`:

```typescript
new ClassService(classRepo, membershipRepo, academyRepo, dispatcher, managerSubRepo)
```

- [ ] **Step 3: Update subscription.routes.ts**

Pass to `SubscriptionService`:

```typescript
const managerSubRepo = new PostgresManagerSubscriptionRepository(db);
const subscriptionService = new SubscriptionService(
  new PostgresSubscriptionPlanRepository(db),
  new PostgresStudentSubscriptionRepository(db),
  academyRepo,
  managerSubRepo,
);
```

- [ ] **Step 4: Update payment.routes.ts**

Pass to `PaymentService`:

```typescript
new PaymentService(paymentRepo, studentSubRepo, academyRepo, dispatcher, managerSubRepo)
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/membership/membership.routes.ts apps/api/src/modules/class/class.routes.ts apps/api/src/modules/subscription/subscription.routes.ts apps/api/src/modules/payment/payment.routes.ts
git commit -m "feat: wire IManagerSubscriptionRepository into services for plan enforcement"
```

---

### Task 8: Add academyPlan to GET /subscriptions/me Response

**Files:**
- Modify: `apps/api/src/modules/subscription/subscription.service.ts`
- Modify: `apps/api/src/modules/subscription/subscription.routes.ts`

- [ ] **Step 1: Update SubscriptionMePayload type**

In `subscription.service.ts`, update the type:

```typescript
export type SubscriptionMePayload = {
  subscription: (StudentSubscriptionRow & {
    expiredByDate: boolean;
    effectiveStatus: "active" | "expired" | "cancelled";
  }) | null;
  plan: SubscriptionPlanRow | null;
  academyPlan: "free" | "pro" | null;
};
```

- [ ] **Step 2: Update getMySubscription() to include academyPlan**

At the end of `getMySubscription()`, look up the manager subscription and add it to the return. Add a new method or inline the lookup:

```typescript
async getMySubscription(
  userId: string,
  academyId: string,
): Promise<SubscriptionMePayload> {
  // ... existing logic stays the same ...

  // After finding the active subscription or returning null, look up academy plan
  let academyPlan: "free" | "pro" | null = null;
  if (this.managerSubRepo) {
    const managerSub = await this.managerSubRepo.findByAcademyId(academyId);
    academyPlan = managerSub?.plan ?? null;
  }

  // Return with academyPlan added to whatever the existing return is
  // Find the existing return statement(s) and add academyPlan to them
}
```

The exact integration depends on the full method body. The key change is adding `academyPlan` to every return path of this method.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/subscription/subscription.service.ts apps/api/src/modules/subscription/subscription.routes.ts
git commit -m "feat: include academyPlan in GET /subscriptions/me response"
```

---

### Task 9: PlanLimitModal Component (Mobile)

**Files:**
- Create: `apps/mobile/components/PlanLimitModal.tsx`

- [ ] **Step 1: Create the PlanLimitModal component**

```typescript
// apps/mobile/components/PlanLimitModal.tsx
import Constants from "expo-constants";
import { Lock } from "lucide-react-native";
import { Linking, Modal, Pressable, Text, View } from "react-native";

const PORTAL_URL =
  Constants.expoConfig?.extra?.managerPortalUrl ?? "https://tatame.app/conta";

type PlanLimitModalProps = {
  visible: boolean;
  onClose: () => void;
  message: string;
};

export function PlanLimitModal({ visible, onClose, message }: PlanLimitModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center px-6">
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        <View
          className="rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 24, gap: 16, alignItems: "center" }}
        >
          <View
            className="items-center justify-center rounded-full"
            style={{ width: 56, height: 56, backgroundColor: "#A078E820" }}
          >
            <Lock size={24} color="#A078E8" />
          </View>
          <Text className="font-poppins-bold text-lg text-primary text-center">
            Limite atingido
          </Text>
          <Text className="font-poppins text-sm text-muted text-center">
            {message}
          </Text>
          <Pressable
            onPress={() => {
              onClose();
              Linking.openURL(PORTAL_URL);
            }}
            className="w-full items-center rounded-xl bg-accent"
            style={{ paddingVertical: 14 }}
          >
            <Text className="font-poppins-semibold text-sm text-white">
              Gerenciar conta
            </Text>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text className="font-poppins text-sm text-muted">Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export const PLAN_LIMIT_MESSAGES: Record<string, string> = {
  PLAN_LIMIT_STUDENTS: "Voce atingiu o numero maximo de alunos para sua conta.",
  PLAN_LIMIT_INSTRUCTORS: "Voce atingiu o numero maximo de instrutores para sua conta.",
  PLAN_LIMIT_CLASSES: "Voce atingiu o numero maximo de aulas por dia para sua conta.",
  PLAN_LIMIT_PLANS: "Voce atingiu o numero maximo de planos para sua conta.",
  PLAN_LIMIT_PAYMENTS: "Pagamentos automaticos nao estao disponiveis para sua conta.",
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/PlanLimitModal.tsx
git commit -m "feat: add PlanLimitModal component for limit-reached feedback"
```

---

### Task 10: Fix Mobile Hooks (use-manager-subscription.ts)

**Files:**
- Modify: `apps/mobile/lib/hooks/use-manager-subscription.ts`

- [ ] **Step 1: Fix missing imports and type**

Replace the entire file:

```typescript
import { useApi, ApiError } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type ManagerSubscription = {
  id: string;
  academyId: string;
  plan: "free" | "pro";
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  subscribedAt: string;
  canceledAt: string | null;
};

export type ManagerLimits = {
  plan: "free" | "pro";
  blocked: boolean;
  students: { used: number; limit: number | null };
  instructors: { used: number; limit: number | null };
  plans: { used: number; limit: number | null };
  schedulesPerDay: { maxUsed: number; limit: number | null };
};

export function useManagerSubscription() {
  const api = useApi();

  return useQuery({
    queryKey: ["manager-subscription"],
    queryFn: () => api.get<ManagerSubscription>("/manager-subscriptions/me"),
    retry: false,
  });
}

export function useManagerLimits() {
  const api = useApi();

  return useQuery({
    queryKey: ["manager-limits"],
    queryFn: () => api.get<ManagerLimits>("/manager-subscriptions/limits"),
  });
}

export function useSelectFreePlan() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<ManagerSubscription>("/manager-subscriptions/free"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/lib/hooks/use-manager-subscription.ts
git commit -m "fix: fix imports and types in use-manager-subscription hook"
```

---

### Task 11: Update Manager Layout (_layout.tsx)

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/_layout.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
import {
  useManagerSubscription,
  useSelectFreePlan,
} from "@/lib/hooks/use-manager-subscription";
import { Tabs } from "expo-router";
import Constants from "expo-constants";
import { Calendar, CreditCard, Home, Users } from "lucide-react-native";
import { useEffect } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PORTAL_URL =
  Constants.expoConfig?.extra?.managerPortalUrl ?? "https://tatame.app/conta";

function BlockedScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center px-6" style={{ gap: 16 }}>
        <Text className="font-poppins-bold text-xl text-primary text-center">
          Acesso indisponivel
        </Text>
        <Text className="font-poppins text-sm text-muted text-center">
          Sua conta nao tem acesso ao painel de gestor no momento.
        </Text>
        <Pressable
          onPress={() => Linking.openURL(PORTAL_URL)}
          className="items-center rounded-xl bg-accent"
          style={{ paddingVertical: 14, paddingHorizontal: 24, marginTop: 8 }}
        >
          <Text className="font-poppins-semibold text-sm text-white">
            Acessar minha conta
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function ManagerLayout() {
  const insets = useSafeAreaInsets();
  const { data: subscription, isPending, error } = useManagerSubscription();
  const selectFree = useSelectFreePlan();

  // Auto-create free plan for managers with no subscription
  const is404 = !isPending && !subscription && error !== null;
  useEffect(() => {
    if (is404 && !selectFree.isPending && !selectFree.isSuccess) {
      selectFree.mutate();
    }
  }, [is404, selectFree.isPending, selectFree.isSuccess]);

  if (isPending || (is404 && !selectFree.isSuccess)) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  // Canceled or past_due Pro → blocked
  const status = subscription?.status;
  if (status === "canceled" || status === "past_due") {
    return <BlockedScreen />;
  }

  // Free active or Pro active/trialing → show tabs
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: "#0C0C0C",
        },
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
          title: "Inicio",
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
          title: "Aulas",
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(finances)"
        options={{
          title: "Financas",
          tabBarIcon: ({ color, size }) => (
            <CreditCard size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/_layout.tsx
git commit -m "feat: auto-create free plan, neutral blocked screen, remove IAP references"
```

---

### Task 12: Update Financial Dashboard (Neutral Text)

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/(finances)/index.tsx`

- [ ] **Step 1: Replace Crown import with ExternalLink**

Change import:

```typescript
// OLD
import { CreditCard, FileText, Crown, KeyRound, Pencil, Plus, QrCode, Receipt, Users } from "lucide-react-native";

// NEW
import { CreditCard, FileText, ExternalLink, KeyRound, Pencil, Plus, QrCode, Receipt, Users } from "lucide-react-native";
```

- [ ] **Step 2: Update the "Gerenciar minha conta" card subtitle and icon**

Find the card around lines 206-229 and change:

```typescript
// OLD subtitle
<Text className="font-poppins text-[11px]" style={{ color: TEXT_SECONDARY }}>
  Assinatura, pagamento e dados
</Text>

// NEW subtitle
<Text className="font-poppins text-[11px]" style={{ color: TEXT_SECONDARY }}>
  Dados da conta
</Text>
```

```typescript
// OLD icon
<Crown size={20} color="#A078E8" />

// NEW icon
<ExternalLink size={20} color="#A078E8" />
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(finances)/index.tsx
git commit -m "feat: neutralize financial dashboard text, replace Crown icon"
```

---

### Task 13: Update Student Subscription Screen (Hide Pix/Card for Free)

**Files:**
- Modify: `apps/mobile/app/(app)/(student)/(subscription)/index.tsx`
- Modify: `apps/mobile/lib/hooks/use-subscription.ts`

- [ ] **Step 1: Update useMySubscription return type**

In `apps/mobile/lib/hooks/use-subscription.ts`, find the type used for the subscription response and add `academyPlan`. The hook calls `api.get<...>("/subscriptions/me")`. Update:

```typescript
type SubscriptionMeResponse = {
  subscription: { ... } | null;  // keep existing shape
  plan: { ... } | null;          // keep existing shape
  academyPlan: "free" | "pro" | null;
};
```

If the type is inline, extract or add the field where the response type is defined.

- [ ] **Step 2: Conditionally render payment buttons in index.tsx**

In the student subscription screen, find the payment buttons section (around lines 276-305). Wrap them in a condition:

```typescript
{(() => {
  // ... existing logic ...

  const academyPlan = subResponse?.academyPlan;

  return (
    <View ...>
      {/* ... existing status display ... */}

      {hasPaid ? (
        /* ... existing "Pago" button ... */
      ) : academyPlan === "free" ? (
        <View
          className="items-center justify-center rounded-xl"
          style={{ height: 48, backgroundColor: "#2A2A2A" }}
        >
          <Text className="font-poppins text-sm text-muted">
            Pagamento gerenciado pela academia
          </Text>
        </View>
      ) : (
        <View className="flex-row" style={{ gap: 10 }}>
          {/* ... existing Pix and Card buttons ... */}
        </View>
      )}
    </View>
  );
})()}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/(student)/(subscription)/index.tsx apps/mobile/lib/hooks/use-subscription.ts
git commit -m "feat: hide Pix/Card buttons for students in free-plan academies"
```

---

### Task 14: Intercept Plan Limit Errors in Mobile Screens

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/(members)/pending.tsx`
- Modify: `apps/mobile/app/(app)/(manager)/(classes)/create.tsx`
- Modify: `apps/mobile/app/(app)/(manager)/(finances)/plans/create.tsx`

- [ ] **Step 1: Add PlanLimitModal to pending.tsx (approve member)**

Add imports:

```typescript
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { PlanLimitModal, PLAN_LIMIT_MESSAGES } from "@/components/PlanLimitModal";
```

Add state and error handler inside the component:

```typescript
const [limitModal, setLimitModal] = useState<{ visible: boolean; message: string }>({
  visible: false,
  message: "",
});
```

Replace the `onApprove` callback:

```typescript
onApprove={() => {
  approveMutation.mutate(item.id, {
    onError: (error) => {
      if (error instanceof ApiError && error.message) {
        const code = Object.keys(PLAN_LIMIT_MESSAGES).find(
          (k) => error.message.includes("Limite") || error.message.includes("plano atual"),
        );
        // Check if error message matches plan limit pattern
        for (const [key, msg] of Object.entries(PLAN_LIMIT_MESSAGES)) {
          if (error.status === 403) {
            setLimitModal({ visible: true, message: msg });
            return;
          }
        }
      }
    },
  });
}}
```

Actually, a simpler approach: check the `error` field in the API response. The `ApiError` is constructed from `error.error` in the response body. Update the approach:

Since the API will return `{ error: "PLAN_LIMIT_STUDENTS", message: "..." }`, and the mobile `ApiError` is created with `new ApiError(res.status, error.error ?? "Request failed")`, the `ApiError.message` will be the error code like `"PLAN_LIMIT_STUDENTS"`.

So the handler becomes:

```typescript
onApprove={() => {
  approveMutation.mutate(item.id, {
    onError: (error) => {
      if (error instanceof ApiError && error.status === 403) {
        const msg = PLAN_LIMIT_MESSAGES[error.message];
        if (msg) {
          setLimitModal({ visible: true, message: msg });
          return;
        }
      }
    },
  });
}}
```

Add the modal to the JSX (before closing `</SafeAreaView>`):

```typescript
<PlanLimitModal
  visible={limitModal.visible}
  onClose={() => setLimitModal({ visible: false, message: "" })}
  message={limitModal.message}
/>
```

- [ ] **Step 2: Add PlanLimitModal to classes/create.tsx**

The file already uses try-catch with `Alert.alert`. Replace the error handling:

```typescript
import { useState } from "react";
import { PlanLimitModal, PLAN_LIMIT_MESSAGES } from "@/components/PlanLimitModal";
```

Add state:

```typescript
const [limitModal, setLimitModal] = useState<{ visible: boolean; message: string }>({
  visible: false,
  message: "",
});
```

Update the catch block in `handleSubmit`:

```typescript
} catch (e) {
  if (e instanceof ApiError && e.status === 403) {
    const msg = PLAN_LIMIT_MESSAGES[e.message];
    if (msg) {
      setLimitModal({ visible: true, message: msg });
      return;
    }
  }
  const message =
    e instanceof ApiError ? e.message : "Nao foi possivel criar a aula";
  Alert.alert("Erro", message);
}
```

Add modal before closing `</SafeAreaView>`:

```typescript
<PlanLimitModal
  visible={limitModal.visible}
  onClose={() => setLimitModal({ visible: false, message: "" })}
  message={limitModal.message}
/>
```

- [ ] **Step 3: Add PlanLimitModal to plans/create.tsx**

Same pattern. Add imports, state, and update the catch block in `onSubmit`:

```typescript
import { useState } from "react";
import { PlanLimitModal, PLAN_LIMIT_MESSAGES } from "@/components/PlanLimitModal";
```

State:

```typescript
const [limitModal, setLimitModal] = useState<{ visible: boolean; message: string }>({
  visible: false,
  message: "",
});
```

Update catch block:

```typescript
} catch (e) {
  if (e instanceof ApiError && e.status === 403) {
    const msg = PLAN_LIMIT_MESSAGES[e.message];
    if (msg) {
      setLimitModal({ visible: true, message: msg });
      return;
    }
  }
  const msg = e instanceof ApiError ? e.message : "Erro ao criar plano";
  Alert.alert("Erro", msg);
}
```

Also: hide the Stripe fee disclaimer for free managers. Add `useManagerSubscription` hook and conditionally render:

```typescript
import { useManagerSubscription } from "@/lib/hooks/use-manager-subscription";

// Inside component:
const { data: managerSub } = useManagerSubscription();
const isFree = managerSub?.plan === "free";
```

Wrap the fee disclaimer view (lines 195-207) with:

```typescript
{!isFree && (
  <View className="rounded-xl border ..." ...>
    ...fee disclaimer...
  </View>
)}
```

Add modal before closing `</SafeAreaView>`:

```typescript
<PlanLimitModal
  visible={limitModal.visible}
  onClose={() => setLimitModal({ visible: false, message: "" })}
  message={limitModal.message}
/>
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/(manager)/(members)/pending.tsx apps/mobile/app/(app)/(manager)/(classes)/create.tsx apps/mobile/app/(app)/(manager)/(finances)/plans/create.tsx
git commit -m "feat: intercept plan limit errors and show PlanLimitModal"
```

---

### Task 15: Delete Dead Code and Cleanup

**Files:**
- Delete: `apps/mobile/app/(app)/(manager)/(finances)/my-plan.tsx`
- Delete: `apps/mobile/components/PlanCard.tsx`
- Modify: `apps/mobile/package.json` (remove `react-native-purchases`)

- [ ] **Step 1: Delete my-plan.tsx**

```bash
rm apps/mobile/app/\(app\)/\(manager\)/\(finances\)/my-plan.tsx
```

- [ ] **Step 2: Delete PlanCard.tsx**

```bash
rm apps/mobile/components/PlanCard.tsx
```

- [ ] **Step 3: Remove react-native-purchases from package.json**

In `apps/mobile/package.json`, remove the line:

```json
"react-native-purchases": "10.0.0",
```

- [ ] **Step 4: Delete stale RevenueCat build artifacts**

```bash
find apps/api/dist -name "revenuecat-*" -delete 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add -A apps/mobile/app/\(app\)/\(manager\)/\(finances\)/my-plan.tsx apps/mobile/components/PlanCard.tsx apps/mobile/package.json
git commit -m "chore: remove dead code (my-plan, PlanCard, react-native-purchases, revenuecat artifacts)"
```

---

### Task 16: Verify Build and Run Tests

- [ ] **Step 1: Run API tests**

```bash
cd apps/api && npm test
```

Expected: All existing tests pass. New enforcement code uses optional dependencies so existing tests that don't pass `managerSubRepo` won't trigger limit checks.

- [ ] **Step 2: Check TypeScript compilation**

```bash
cd apps/api && npx tsc --noEmit
cd apps/mobile && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Install mobile dependencies (after removing react-native-purchases)**

```bash
cd apps/mobile && npm install
```

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address build/test issues from plan limit implementation"
```
