import { BackButton } from "@/components/BackButton";
import { describeApiError } from "@/lib/api-error-message";
import { useDependentSubscription } from "@/lib/hooks/use-dependents";
import { useMySubscription, useSelectPlan } from "@/lib/hooks/use-subscription";
import { useSubscriptionPlan } from "@/lib/hooks/use-subscription-plans";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, CheckCircle, Clock, RefreshCw } from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";

export default function PlanDetailScreen() {
  const { planId, dependentId, callerRole } = useLocalSearchParams<{ planId: string; dependentId?: string; callerRole?: string }>();
  const router = useRouter();
  const { data: plan, isLoading } = useSubscriptionPlan(planId);
  const { data: mySubResponse } = useMySubscription();
  const { data: depSubResponse } = useDependentSubscription(dependentId ?? null);
  const subResponse = dependentId ? depSubResponse : mySubResponse;
  const selectPlan = useSelectPlan();
  const queryClient = useQueryClient();

  const currentPlanId =
    subResponse?.subscription?.effectiveStatus === "active"
      ? subResponse.subscription.planId
      : null;
  const isCurrentPlan = plan?.id === currentPlanId;
  const hasActiveSubscription = currentPlanId != null;

  function formatRecurrenceMonths(months: number): string {
    if (months === 1) return "mês";
    if (months === 3) return "trimestre";
    if (months === 6) return "semestre";
    return "ano";
  }

  const handleSelectPlan = () => {
    if (!plan) return;

    const runSelectPlan = async () => {
      try {
        await selectPlan.mutateAsync({ planId: plan.id, dependentId });
        if (dependentId) {
          await queryClient.refetchQueries({ queryKey: ["subscription", dependentId] });
        } else {
          await queryClient.refetchQueries({ queryKey: ["subscription", "me"] });
        }
        Alert.alert(
          hasActiveSubscription ? "Plano atualizado" : "Assinatura ativada",
          hasActiveSubscription
            ? "A assinatura foi atualizada com sucesso."
            : "A assinatura foi ativada com sucesso.",
        );
        if (dependentId && callerRole === "guardian") {
          router.replace(`/(app)/(guardian)/(dependents)/subscription?dependentId=${dependentId}`);
        } else if (dependentId) {
          router.replace(`/(app)/(student)/(more)/dependent-subscription?dependentId=${dependentId}`);
        } else {
          router.replace("/(app)/(student)/(subscription)");
        }
      } catch (e) {
        Alert.alert(
          "Erro",
          describeApiError(
            e,
            hasActiveSubscription
              ? "Não foi possível trocar de plano. Tente novamente."
              : "Não foi possível concluir a assinatura. Tente novamente.",
          ),
        );
      }
    };

    if (hasActiveSubscription) {
      Alert.alert(
        "Confirmar troca de plano",
        `Deseja trocar para o plano ${plan.name}? Sua assinatura será atualizada imediatamente.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Confirmar", onPress: runSelectPlan },
        ],
      );
    } else {
      Alert.alert(
        "Confirmar assinatura",
        `Deseja assinar o plano ${plan.name}? Sua assinatura será ativada imediatamente.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Confirmar", onPress: runSelectPlan },
        ],
      );
    }
  };

  if (isLoading || !plan) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-background"
        edges={["top"]}
      >
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const features = [
    {
      icon: RefreshCw,
      text: "Renovação automática",
    },
    {
      icon: CheckCircle,
      text: plan.weeklyCheckinLimit
        ? `${plan.weeklyCheckinLimit} check-ins por semana`
        : "Check-ins ilimitados",
    },
    {
      icon: Calendar,
      text: `Expira ${plan.recurrenceMonths * 30} dias após ativação`,
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: 32,
          }}
        >
          <View style={{ gap: 24 }}>
            <View className="flex-row items-center gap-3" style={{ paddingTop: 8 }}>
              <BackButton />
              <Text className="flex-1 text-center font-poppins-semibold text-base text-primary">
                Detalhes do plano
              </Text>
              <View className="h-10 w-10" />
            </View>

            <View style={{ gap: 8 }}>
              <Text
                className="font-poppins-bold text-primary"
                style={{ fontSize: 26, letterSpacing: -0.5 }}
              >
                {plan.name}
              </Text>
              <View className="flex-row items-baseline">
                <Text className="font-poppins-bold" style={{ fontSize: 36, color: "#A078E8" }}>
                  R$ {(plan.priceCents / 100).toFixed(0)}
                </Text>
                <Text className="font-poppins text-base" style={{ color: TEXT_SECONDARY }}>
                  {" "}
                  / {formatRecurrenceMonths(plan.recurrenceMonths)}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-2">
              <Clock size={16} color={TEXT_SECONDARY} />
              <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
                {plan.weeklyCheckinLimit
                  ? `${plan.weeklyCheckinLimit} check-ins por semana`
                  : "Check-ins ilimitados"}
              </Text>
            </View>

            <View
              className="rounded-2xl border border-surface-border bg-surface"
              style={{ overflow: "hidden" }}
            >
              {features.map((feature, i) => (
                <View
                  key={i}
                  className="flex-row items-center gap-3"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: "#2A2A2A",
                  }}
                >
                  <feature.icon size={18} color={TEXT_SECONDARY} />
                  <Text className="font-poppins text-sm text-primary">{feature.text}</Text>
                </View>
              ))}
            </View>

            {hasActiveSubscription && !isCurrentPlan && subResponse?.plan && (
              <View
                className="flex-row items-start gap-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: "#A078E810" }}
              >
                <View
                  className="mt-0.5 h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: "#A078E830" }}
                >
                  <Text className="font-poppins-bold text-[10px]" style={{ color: "#A078E8" }}>
                    i
                  </Text>
                </View>
                <Text className="flex-1 font-poppins text-[13px] text-primary">
                  Você está no {subResponse.plan.name}. Ao selecionar este plano, sua assinatura
                  será atualizada imediatamente.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {!isCurrentPlan && (
          <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
            <Pressable
              onPress={handleSelectPlan}
              disabled={selectPlan.isPending}
              className="items-center rounded-2xl py-4"
              style={{
                backgroundColor: selectPlan.isPending ? "#A078E880" : "#A078E8",
              }}
            >
              {selectPlan.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-poppins-semibold text-base text-white">
                  Selecionar este plano
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
