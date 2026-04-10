import { BackButton } from "@/components/BackButton";
import { SubscriptionPlanListItem } from "@/components/SubscriptionPlanListItem";
import { useMySubscription } from "@/lib/hooks/use-subscription";
import { useSubscriptionPlans } from "@/lib/hooks/use-subscription-plans";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: plans, isLoading } = useSubscriptionPlans();
  const { data: subResponse } = useMySubscription();
  const [refreshing, setRefreshing] = useState(false);

  const currentPlanId =
    subResponse?.subscription?.effectiveStatus === "active"
      ? subResponse.subscription.planId
      : null;

  const activePlans = plans?.filter((p) => p.isActive) ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] }),
      queryClient.invalidateQueries({ queryKey: ["subscription", "me"] }),
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
            {currentPlanId && <BackButton />}
            <Text className="flex-1 text-center font-poppins-semibold text-base text-primary">
              Planos de assinatura
            </Text>
            {currentPlanId && <View className="h-10 w-10" />}
          </View>

          <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
            Escolha o plano ideal para você
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
                    router.push(`/(app)/(student)/(subscription)/plans/${plan.id}`)
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
