# Apple IAP Bypass - Free Plan Strategy

**Date:** 2026-05-06
**Status:** Draft
**Context:** Apple rejected Tatame v2.1.0 (build 30) under Guideline 3.1.1. The app blocks managers without an active Stripe subscription (`BlockedScreen`) and links to the web portal for payment — Apple considers this selling digital content outside IAP.

## Strategy

Adopt the Netflix/Spotify model: the mobile app is fully functional on a limited free tier. Managers who want Pro upgrade via the website. No mention of pricing, plans, upgrades, or subscriptions (in the manager context) inside the mobile app.

## Plan Tiers

### Free Plan

Available only to **new managers who have never subscribed to Pro**. Not a fallback after cancellation.

| Resource | Limit |
|----------|-------|
| Approved students | 30 |
| Instructors (beyond the manager) | 1 |
| Classes per day of week | 2 |
| Subscription plans created | 1 |
| Payment collection | Manual confirmation only |

### Pro Plan

Unlimited on all resources. Pix + Card + Manual payment collection.

### Cancellation Behavior

| Situation | Behavior |
|-----------|----------|
| New manager, never subscribed | Free (limited, functional) |
| Pro active / trialing | Pro (unlimited) |
| Canceled Pro | **Blocked** (neutral blocked screen, no free fallback) |
| Past due (past_due) | **Blocked** |

This prevents gaming: subscribe Pro, add 100 students, cancel, continue free.

## Mobile Changes

### 1. Manager Layout (`_layout.tsx`)

Replace current logic:

```
isPending                              -> loading spinner
!subscription                          -> call POST /manager-subscriptions/free silently, then continue
plan === "free" && status === "active"  -> render tabs (with limits enforced)
status === "active" || "trialing"       -> render tabs (pro, no limits)
status === "canceled" || "past_due"     -> BlockedScreen (neutral)
```

**BlockedScreen (neutral text):**
- Title: "Acesso indisponivel"
- Message: "Sua conta nao tem acesso ao painel de gestor no momento."
- Button: "Acessar minha conta" -> opens portal web
- No mention of subscription, plan, price, or upgrade

### 2. PlanLimitModal Component

New reusable modal component: `apps/mobile/components/PlanLimitModal.tsx`

**Visual structure:**
```
+-------------------------------+
|          (Lock icon)          |
|                               |
|       Limite atingido         |  <- font-poppins-bold
|                               |
|    {contextual message}       |  <- font-poppins, muted
|                               |
|    [  Gerenciar conta   ]     |  <- accent button, opens portal web
|                               |
|          Fechar               |  <- text pressable, muted
+-------------------------------+
```

**Props:**
```typescript
type PlanLimitModalProps = {
  visible: boolean;
  onClose: () => void;
  message: string;
};
```

Title is always "Limite atingido". Button always opens `PORTAL_URL`. Only `message` changes.

**Messages by trigger:**

| Trigger | Message |
|---------|---------|
| Approve student (>= 30) | "Voce atingiu o numero maximo de alunos para sua conta." |
| Approve instructor (>= 1) | "Voce atingiu o numero maximo de instrutores para sua conta." |
| Create class (>= 2/day) | "Voce atingiu o numero maximo de aulas por dia para sua conta." |
| Create subscription plan (>= 1) | "Voce atingiu o numero maximo de planos para sua conta." |
| Auto payment (Pix/Card) | "Pagamentos automaticos nao estao disponiveis para sua conta." |

No message mentions "Pro", price, "upgrade", or "assinatura".

**Activation pattern:** Backend returns 403 with `PLAN_LIMIT_*` error code -> mobile intercepts -> opens PlanLimitModal with corresponding message.

### 3. Financial Dashboard (`(finances)/index.tsx`)

- Card "Gerenciar minha conta": change subtitle from "Assinatura, pagamento e dados" to "Dados da conta"
- Replace Crown icon with neutral icon (Settings or ExternalLink)

### 4. Student Subscription Screen (`(subscription)/index.tsx`)

When `academyPlan === "free"`:
- Hide "Pix" and "Cartao" payment buttons
- Show instead: "Pagamento gerenciado pela academia"

When `academyPlan === "pro"`:
- Show buttons normally

### 5. Plan Creation (`(finances)/plans/create.tsx`)

- On 403 from backend -> open PlanLimitModal
- Hide Stripe fee disclaimer if `plan === "free"` (free managers don't use auto payment)

### 6. All Screens with Approve/Create Actions

Any screen that calls approve member, create class, or create plan must intercept 403 `PLAN_LIMIT_*` responses and open PlanLimitModal.

### 7. Text Neutralization

Any text in the mobile app that mentions "assinatura" in the **manager** context must be neutralized. Student subscription nomenclature ("assinatura", "plano") remains unchanged -- these are real academy services, not digital purchases.

## Backend Changes

### 1. `POST /manager-subscriptions/free`

- Creates record: `{ plan: "free", status: "active" }` -- no Stripe, no trial
- Only works if **no subscription exists** for the academy (any status)
- If subscription exists -> 409 Conflict (prevents Pro->Free downgrade)
- Returns created record

### 2. `GET /manager-subscriptions/limits`

Schema already exists in `packages/validators/src/manager-subscription.schema.ts`.

Response:
```json
{
  "plan": "free",
  "blocked": false,
  "students": { "used": 12, "limit": 30 },
  "instructors": { "used": 0, "limit": 1 },
  "plans": { "used": 1, "limit": 1 },
  "schedulesPerDay": { "maxUsed": 1, "limit": 2 }
}
```

For Pro plan, all `limit` values are `null` (unlimited).

**Note:** The existing `managerLimitsResponseSchema` in `packages/validators` uses `instructors: { allowed: boolean }`. This must be updated to `instructors: { used: number, limit: number | null }` to match the pattern of other resources and support the 1-instructor limit on Free.

### 3. Plan Limit Constants

New file: `apps/api/src/modules/manager-subscription/plan-limits.ts`

```typescript
export const FREE_PLAN_LIMITS = {
  maxStudents: 30,
  maxInstructors: 1,
  maxClassesPerDay: 2,
  maxPlans: 1,
  allowAutoPayment: false,
} as const;
```

### 4. Service Enforcement

Each service checks the plan before the action. The `require-active-plan` middleware injects `managerPlan` into `req.appAuth`.

| Service | Method | Check |
|---------|--------|-------|
| `membership.service.ts` | `approve()` | Count active students >= 30 and free -> 403 `PLAN_LIMIT_STUDENTS` |
| `membership.service.ts` | `approve()` | Instructor role, free, already has 1 -> 403 `PLAN_LIMIT_INSTRUCTORS` |
| `class.service.ts` | `create()` | Count classes on dayOfWeek >= 2 and free -> 403 `PLAN_LIMIT_CLASSES` |
| subscription plan service | `create()` | Count plans >= 1 and free -> 403 `PLAN_LIMIT_PLANS` |
| `payment.service.ts` | `createCheckout()` | Free -> 403 `PLAN_LIMIT_PAYMENTS` |
| `payment.service.ts` | `createPixCheckout()` | Free -> 403 `PLAN_LIMIT_PAYMENTS` |

### 5. Activate `require-active-plan` Middleware

Currently defined but not applied to any routes. Must be applied to all manager routes (members, classes, finances, subscription plans).

**Fix:** Accept `trialing` status (currently only accepts `active` and `incomplete`).

### 6. Standardized Error Format

All 403 limit responses:

```json
{
  "error": "PLAN_LIMIT_STUDENTS",
  "message": "Limite de alunos atingido para o plano atual"
}
```

Error codes: `PLAN_LIMIT_STUDENTS`, `PLAN_LIMIT_INSTRUCTORS`, `PLAN_LIMIT_CLASSES`, `PLAN_LIMIT_PLANS`, `PLAN_LIMIT_PAYMENTS`.

### 7. Student Subscription Endpoint

`GET /subscriptions/me` includes `academyPlan` field in response so the mobile app knows whether to show Pix/Card buttons.

## Files to Create

| File | Purpose |
|------|---------|
| `apps/mobile/components/PlanLimitModal.tsx` | Reusable limit-reached modal |
| `apps/api/src/modules/manager-subscription/plan-limits.ts` | Free/Pro limit constants |

## Files to Modify

### Mobile

| File | Change |
|------|--------|
| `apps/mobile/app/(app)/(manager)/_layout.tsx` | New logic: free->tabs, canceled->BlockedScreen neutral, no sub->create free |
| `apps/mobile/app/(app)/(manager)/(finances)/index.tsx` | Neutral subtitle, replace Crown icon |
| `apps/mobile/app/(app)/(student)/(subscription)/index.tsx` | Hide Pix/Card if academyPlan === "free" |
| `apps/mobile/app/(app)/(manager)/(finances)/plans/create.tsx` | Intercept 403, open PlanLimitModal |
| `apps/mobile/lib/hooks/use-manager-subscription.ts` | Fix imports for useSelectFreePlan and useManagerLimits |
| Screens calling approve/create class | Intercept 403 PLAN_LIMIT_* -> open PlanLimitModal |

### API

| File | Change |
|------|--------|
| `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts` | Add POST /free and GET /limits |
| `apps/api/src/modules/manager-subscription/manager-subscription.service.ts` | Implement createFree(), getLimits(), accept trialing |
| `apps/api/src/modules/membership/membership.service.ts` | Limit enforcement in approve() |
| `apps/api/src/modules/class/class.service.ts` | Limit enforcement in create() |
| `apps/api/src/modules/payment/payment.service.ts` | Limit enforcement in createCheckout(), createPixCheckout() |
| Subscription plan service | Limit enforcement in create() |
| `apps/api/src/middleware/require-active-plan.ts` | Accept trialing, apply to routes |
| Manager route files | Apply require-active-plan middleware |
| Student subscription endpoint | Include academyPlan in response |
| `packages/validators/src/manager-subscription.schema.ts` | Change instructors from `{ allowed: boolean }` to `{ used: number, limit: number \| null }` |

## Files to Delete

| File | Reason |
|------|--------|
| `apps/mobile/app/(app)/(manager)/(finances)/my-plan.tsx` | Dead code, no navigation points to it |
| `apps/mobile/components/PlanCard.tsx` | Unused component |
| `apps/api/dist/**/revenuecat-*` | Stale build artifacts |
| `react-native-purchases` from mobile package.json | Unused, signals IAP intent to Apple |

## What Does NOT Change

- Student subscription screens (nomenclature "assinatura", "plano") -- real academy services, not digital purchases
- Student payment flow (Pix/Card) for academies with Pro plan
- Stripe checkout for manager subscription on **web**
- Existing webhooks (Stripe subscription + payment)
- Manual payment confirmation logic
- Web pricing page and subscription management

## Apple Review Response

After implementation, submit with note:

> "The app operates as a free-tier experience for academy managers. Users who have subscribed through our website can access their premium features in the app, but no purchase flow or pricing information is presented within the application. No digital content is sold or offered for sale within the application."
