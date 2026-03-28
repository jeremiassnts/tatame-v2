import { BackButton } from "@/components/BackButton";
import { useMySubscription } from "@/lib/hooks/use-subscription";
import { useSubscriptionPlans } from "@/lib/hooks/use-subscription-plans";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";

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
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
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
            <BackButton />
            <Text className="flex-1 text-center font-poppins-semibold text-base text-primary">
              Planos de assinatura
            </Text>
            <View className="h-10 w-10" />
          </View>

          <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
            Escolha o plano ideal para você
          </Text>

          {isLoading ? (
            <ActivityIndicator color="#A078E8" style={{ marginTop: 32 }} />
          ) : (
            <View style={{ gap: 12 }}>
              {activePlans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                return (
                  <Pressable
                    key={plan.id}
                    onPress={() =>
                      router.push(`/(app)/(student)/(subscription)/plans/${plan.id}`)
                    }
                    className="rounded-2xl border bg-surface"
                    style={{
                      padding: 20,
                      gap: 8,
                      borderColor: isCurrent ? "#A078E8" : "#2A2A2A",
                      borderWidth: isCurrent ? 2 : 1,
                    }}
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="font-poppins-semibold text-base text-primary">
                        {plan.name}
                      </Text>
                      {isCurrent && (
                        <View
                          className="rounded-full px-2.5 py-0.5"
                          style={{ backgroundColor: "#A078E820" }}
                        >
                          <Text
                            className="font-poppins-semibold text-[10px]"
                            style={{ color: "#A078E8" }}
                          >
                            Atual
                          </Text>
                        </View>
                      )}
                      <View className="flex-1" />
                      <ChevronRight size={18} color={TEXT_MUTED} />
                    </View>
                    <Text className="font-poppins-bold text-primary" style={{ fontSize: 22 }}>
                      R$ {(plan.priceCents / 100).toFixed(0)} / mês
                    </Text>
                    <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                      {plan.weeklyCheckinLimit
                        ? `${plan.weeklyCheckinLimit} check-ins por semana`
                        : "Ilimitado"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
