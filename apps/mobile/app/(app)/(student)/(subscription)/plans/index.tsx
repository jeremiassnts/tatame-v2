import { BackButton } from "@/components/BackButton";
import { SubscriptionPlanListItem } from "@/components/SubscriptionPlanListItem";
import { useDependentSubscription } from "@/lib/hooks/use-dependents";
import { useMySubscription } from "@/lib/hooks/use-subscription";
import { useSubscriptionPlans } from "@/lib/hooks/use-subscription-plans";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";

export default function SubscriptionPlansScreen() {
  const { dependentId, callerRole } = useLocalSearchParams<{ dependentId?: string; callerRole?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: plans, isLoading } = useSubscriptionPlans();
  const { data: mySubResponse } = useMySubscription();
  const { data: depSubResponse } = useDependentSubscription(dependentId ?? null);
  const [refreshing, setRefreshing] = useState(false);

  // Whose plan is being chosen decides whose current plan is marked. Reading
  // the student's own subscription while picking for a dependent labelled the
  // wrong card "Plano atual".
  const subResponse = dependentId ? depSubResponse : mySubResponse;

  const currentPlanId =
    subResponse?.subscription?.effectiveStatus === "active"
      ? subResponse.subscription.planId
      : null;

  /**
   * Without a plan of their own the student reaches this screen as the gate the
   * app puts in front of everything else, and there is nowhere to go back to.
   * Choosing for a dependent is the opposite: it is always pushed from the
   * dependent's screen, so it must be possible to leave.
   */
  const canGoBack = dependentId != null || currentPlanId != null;

  const activePlans = plans?.filter((p) => p.isActive) ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] }),
      queryClient.invalidateQueries({
        queryKey: dependentId ? ["subscription", dependentId] : ["subscription", "me"],
      }),
    ]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#A078E8"
          />
        }
      >
        <View style={{ gap: 20 }}>
          <View className="flex-row items-center gap-3" style={{ paddingTop: 8 }}>
            {canGoBack && <BackButton />}
            <Text className="flex-1 text-center font-poppins-semibold text-base text-primary">
              Planos de assinatura
            </Text>
            {canGoBack && <View className="h-10 w-10" />}
          </View>

          <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
            {dependentId
              ? "Escolha o plano do seu dependente"
              : "Escolha o plano ideal para você"}
          </Text>

          {isLoading ? (
            <ActivityIndicator color="#A078E8" style={{ marginTop: 32 }} />
          ) : (
            <View style={{ gap: 12 }}>
              {activePlans.map((plan) => (
                <SubscriptionPlanListItem
                  key={plan.id}
                  plan={plan}
                  isCurrent={plan.id === currentPlanId}
                  onPress={() =>
                    router.push({
                      pathname: `/(app)/(student)/(subscription)/plans/${plan.id}`,
                      params: dependentId ? { dependentId, callerRole } : undefined,
                    })
                  }
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
