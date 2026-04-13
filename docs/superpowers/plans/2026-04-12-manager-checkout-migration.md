# Manager Checkout Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Stripe native payment sheet with Stripe Checkout (browser redirect) to comply with Apple Guideline 3.1.1.

**Architecture:** New API endpoint creates a Stripe Checkout Session and returns the URL. Mobile opens it in Safari. Deep link brings the user back. New intermediate screen polls for subscription activation.

**Tech Stack:** Stripe Checkout Sessions (API), expo-router deep links, React Query polling (mobile)

---

### Task 1: Add `POST /manager-subscriptions/pro/checkout` API endpoint

**Files:**
- Modify: `apps/api/src/modules/manager-subscription/manager-subscription.routes.ts`

- [ ] **Step 1: Add the checkout endpoint after the existing `/pro/complete` route (after line 338)**

```typescript
managerSubscriptionRouter.post(
  "/pro/checkout",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRO_PRICE_ID) {
        throw new HttpError(503, "Stripe is not configured");
      }

      const stripe = getStripe();
      const academyId = req.appAuth!.activeAcademyId!;
      const userId = req.appAuth!.userId;

      let sub = await service.getSubscription(academyId);

      let stripeCustomerId = sub?.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create(
          { metadata: { academyId, userId } },
          { idempotencyKey: `create-customer-${academyId}` },
        );
        stripeCustomerId = customer.id;

        if (sub) {
          await subRepo.update(sub.id, { stripeCustomerId });
        } else {
          sub = await subRepo.create({
            academyId,
            plan: "free",
            status: "incomplete",
            stripeCustomerId,
          });
        }
      }

      const returnPath =
        typeof req.body?.returnPath === "string" ? req.body.returnPath : "subscription-result";

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: stripeCustomerId,
        line_items: [{ price: env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
        success_url: `tatame://${returnPath}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: "tatame://plan-selection",
        metadata: { academyId, userId },
      });

      if (!session.url) {
        throw new HttpError(500, "Failed to create checkout session");
      }

      res.json({ checkoutUrl: session.url });
    } catch (e) {
      next(e);
    }
  },
);
```

- [ ] **Step 2: Update the `/reactivate` endpoint to also use Checkout**

Replace the existing `/reactivate` handler (lines 476-525) with:

```typescript
managerSubscriptionRouter.post(
  "/reactivate",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRO_PRICE_ID) {
        throw new HttpError(503, "Stripe is not configured");
      }

      const stripe = getStripe();
      const academyId = req.appAuth!.activeAcademyId!;
      const userId = req.appAuth!.userId;
      const sub = await service.getSubscription(academyId);

      if (!sub) {
        throw new HttpError(404, "No subscription found");
      }
      if (sub.status === "active") {
        throw new HttpError(409, "Subscription is already active");
      }

      let stripeCustomerId = sub.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create(
          { metadata: { academyId, userId } },
          { idempotencyKey: `create-customer-${academyId}` },
        );
        stripeCustomerId = customer.id;
        await subRepo.update(sub.id, { stripeCustomerId });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: stripeCustomerId,
        line_items: [{ price: env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
        success_url: "tatame://subscription-result?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "tatame://plan-selection",
        metadata: { academyId, userId },
      });

      if (!session.url) {
        throw new HttpError(500, "Failed to create checkout session");
      }

      res.json({ checkoutUrl: session.url });
    } catch (e) {
      next(e);
    }
  },
);
```

- [ ] **Step 3: Run unit tests**

```bash
cd apps/api && pnpm test:unit
```

Expected: all pass (no unit tests for routes)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/manager-subscription/manager-subscription.routes.ts
git commit -m "feat(api): add Stripe Checkout endpoint for manager pro subscription"
```

---

### Task 2: Add `useProCheckout` hook on mobile

**Files:**
- Modify: `apps/mobile/lib/hooks/use-manager-subscription.ts`

- [ ] **Step 1: Add the hook after `useStripePortal`**

```typescript
export function useProCheckout() {
  const api = useApi();

  return useMutation({
    mutationFn: (input?: { returnPath?: string }) =>
      api.post<{ checkoutUrl: string }>("/manager-subscriptions/pro/checkout", input),
  });
}

export function useReactivateCheckout() {
  const api = useApi();

  return useMutation({
    mutationFn: () =>
      api.post<{ checkoutUrl: string }>("/manager-subscriptions/reactivate"),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/lib/hooks/use-manager-subscription.ts
git commit -m "feat(mobile): add useProCheckout and useReactivateCheckout hooks"
```

---

### Task 3: Create subscription-result intermediate screen

**Files:**
- Create: `apps/mobile/app/(app)/(manager)/subscription-result.tsx`

- [ ] **Step 1: Create the screen**

```typescript
import {
  useManagerSubscription,
} from "@/lib/hooks/use-manager-subscription";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle, RefreshCw, XCircle } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const POLL_INTERVAL = 3000;
const MAX_POLL_TIME = 30000;

export default function SubscriptionResultScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session_id, status } = useLocalSearchParams<{
    session_id?: string;
    status?: string;
  }>();

  const { data: sub, refetch } = useManagerSubscription();
  const [state, setState] = useState<"polling" | "success" | "timeout" | "cancelled">(
    status === "cancel" ? "cancelled" : "polling",
  );
  const startTime = useRef(Date.now());

  const checkSubscription = useCallback(async () => {
    const { data } = await refetch();
    if (data?.plan === "pro" && data?.status === "active") {
      setState("success");
      await queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      await queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
      await queryClient.invalidateQueries({ queryKey: ["user/me"] });
    } else if (Date.now() - startTime.current > MAX_POLL_TIME) {
      setState("timeout");
    }
  }, [refetch, queryClient]);

  useEffect(() => {
    if (state !== "polling") return;

    checkSubscription();
    const interval = setInterval(checkSubscription, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [state, checkSubscription]);

  useEffect(() => {
    if (state === "success") {
      const timer = setTimeout(() => {
        router.replace("/(app)/(manager)/(home)");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state, router]);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={["top"]}>
      {state === "polling" && (
        <View className="items-center" style={{ gap: 16 }}>
          <ActivityIndicator size="large" color="#A078E8" />
          <Text className="font-poppins-semibold text-lg text-primary">
            Aguardando confirmação...
          </Text>
          <Text className="font-poppins text-sm text-center px-10" style={{ color: "#ABABAB" }}>
            Estamos processando seu pagamento. Isso pode levar alguns segundos.
          </Text>
          <Pressable
            onPress={checkSubscription}
            className="mt-4 flex-row items-center rounded-xl bg-surface px-5 py-3"
            style={{ gap: 8 }}
          >
            <RefreshCw size={16} color="#A078E8" />
            <Text className="font-poppins-semibold text-sm" style={{ color: "#A078E8" }}>
              Verificar novamente
            </Text>
          </Pressable>
        </View>
      )}

      {state === "success" && (
        <View className="items-center" style={{ gap: 16 }}>
          <CheckCircle size={56} color="#32D74B" />
          <Text className="font-poppins-bold text-xl text-primary">
            Assinatura ativada!
          </Text>
          <Text className="font-poppins text-sm" style={{ color: "#ABABAB" }}>
            Redirecionando...
          </Text>
        </View>
      )}

      {state === "timeout" && (
        <View className="items-center" style={{ gap: 16 }}>
          <ActivityIndicator size="large" color="#A078E8" />
          <Text className="font-poppins-semibold text-lg text-primary text-center px-10">
            Pagamento sendo processado
          </Text>
          <Text className="font-poppins text-sm text-center px-10" style={{ color: "#ABABAB" }}>
            Pode levar alguns minutos. Você pode voltar e verificar depois.
          </Text>
          <Pressable
            onPress={() => router.replace("/(app)/(manager)/(home)")}
            className="mt-4 rounded-xl bg-accent px-6 py-3"
          >
            <Text className="font-poppins-semibold text-sm text-white">
              Ir para o início
            </Text>
          </Pressable>
        </View>
      )}

      {state === "cancelled" && (
        <View className="items-center" style={{ gap: 16 }}>
          <XCircle size={56} color="#FF453A" />
          <Text className="font-poppins-bold text-xl text-primary">
            Pagamento cancelado
          </Text>
          <Text className="font-poppins text-sm" style={{ color: "#ABABAB" }}>
            Nenhuma cobrança foi realizada.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-4 rounded-xl bg-surface px-6 py-3"
          >
            <Text className="font-poppins-semibold text-sm text-primary">
              Voltar
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/\(manager\)/subscription-result.tsx
git commit -m "feat(mobile): add subscription result intermediate screen with polling"
```

---

### Task 4: Update plan-selection to use Checkout URL

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/plan-selection.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
import { PlanCard } from "@/components/PlanCard";
import { MANAGER_PLANS } from "@/constants/manager-plans";
import {
  useManagerSubscription,
  useProCheckout,
  useSelectFreePlan,
} from "@/lib/hooks/use-manager-subscription";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PlanSelectionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const selectFree = useSelectFreePlan();
  const proCheckout = useProCheckout();
  const { data: currentSub } = useManagerSubscription();

  async function handleSelectFree() {
    try {
      await selectFree.mutateAsync();
      router.replace("/(app)/(manager)/(home)");
    } catch {
      Alert.alert("Erro", "Não foi possível selecionar o plano gratuito.");
    }
  }

  async function handleSelectPro() {
    try {
      const isChangingPlan = currentSub?.plan === "pro" || currentSub?.plan === "free";
      const returnPath = isChangingPlan && currentSub?.status === "active"
        ? "finances"
        : "subscription-result";

      const { checkoutUrl } = await proCheckout.mutateAsync({ returnPath });
      await Linking.openURL(checkoutUrl);
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar a assinatura Pro.");
    }
  }

  const isLoading = selectFree.isPending || proCheckout.isPending;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: 40,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 8 }}>
          <Text className="font-poppins-bold text-2xl text-primary">
            Escolha seu plano
          </Text>
          <Text className="font-poppins text-sm" style={{ color: "#ABABAB" }}>
            Selecione o plano ideal para sua academia e comece agora
          </Text>
        </View>

        {MANAGER_PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            title={plan.title}
            description={plan.description}
            price={plan.price}
            period={plan.period}
            features={plan.features}
            ctaLabel={plan.ctaLabel}
            badgeLabel={plan.badgeLabel}
            variant={plan.id === "pro" ? "accent" : "neutral"}
            disabled={isLoading}
            loading={plan.id === "free" ? selectFree.isPending : proCheckout.isPending}
            onPress={plan.id === "free" ? handleSelectFree : handleSelectPro}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
```

Key changes from original:
- Removed `useStripe`, `useStartProSubscription`, `useCompleteProSubscription` imports
- Removed all `initPaymentSheet`/`presentPaymentSheet` logic
- Added `useProCheckout` hook + `Linking.openURL`
- Added `useManagerSubscription` to detect plan change vs new subscription
- `returnPath` is `"finances"` when changing plan (active sub), `"subscription-result"` for new/reactivation

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(app\)/\(manager\)/plan-selection.tsx
git commit -m "feat(mobile): replace Stripe native payment sheet with Checkout URL redirect"
```

---

### Verification Checklist

After all tasks:

- [ ] `cd apps/api && pnpm test:unit` — all pass
- [ ] `cd apps/api && pnpm test:integration` — all pass
- [ ] No more `useStripe()` / `initPaymentSheet` / `presentPaymentSheet` in plan-selection
- [ ] `plan-selection.tsx` no longer imports from `@stripe/stripe-react-native`
- [ ] Deep link `tatame://subscription-result` routes to new screen
- [ ] Deep link `tatame://finances` routes to existing finances screen
- [ ] Manual test: Pro button opens Safari with Stripe Checkout
