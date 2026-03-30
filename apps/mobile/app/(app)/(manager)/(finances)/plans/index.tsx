import { useSubscriptionPlans } from "@/lib/hooks/use-subscription-plans";
import { useRouter } from "expo-router";
import { ArrowLeft, Plus } from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const RECURRENCE_LABELS: Record<number, string> = {
  1: "mês",
  3: "trimestre",
  6: "semestre",
  12: "ano",
};

const RECURRENCE_BADGE: Record<number, string> = {
  1: "1 mês",
  3: "3 meses",
  6: "6 meses",
  12: "12 meses",
};

const TEXT_MUTED = "#525252";

function formatPrice(cents: number, recurrenceMonths: number): string {
  const reais = (cents / 100).toFixed(2).replace(".", ",");
  const suffix = RECURRENCE_LABELS[recurrenceMonths] ?? `${recurrenceMonths}m`;
  return `R$${reais}/${suffix}`;
}

export default function PlansListScreen() {
  const router = useRouter();
  const { data: plans, isPending } = useSubscriptionPlans();

  const activePlans = plans?.filter((p) => p.isActive) ?? [];

  if (isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">Planos</Text>
          <Pressable
            onPress={() =>
              router.push("/(app)/(manager)/(finances)/plans/create")
            }
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "#A078E8" }}
          >
            <Plus size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {activePlans.length > 0 && <Text
          className="font-poppins-medium text-[13px]"
          style={{ color: "#ABABAB", marginTop: 20 }}
        >
          {activePlans.length} planos ativos
        </Text>}

        {activePlans.length === 0 && <Text className="font-poppins text-sm text-center pt-10" style={{ color: TEXT_MUTED }}>
          Nenhum plano ativo
        </Text>}

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingTop: 12, paddingBottom: 100 }}
        >
          {(plans ?? []).map((plan) => (
            <Pressable
              key={plan.id}
              onPress={() =>
                router.push(`/(app)/(manager)/(finances)/plans/${plan.id}`)
              }
              className="rounded-2xl border border-surface-border bg-surface"
              style={{ padding: 16, gap: 10 }}
            >
              <View className="flex-row items-center justify-between">
                <Text className="font-poppins-semibold text-base text-primary">
                  {plan.name}
                </Text>
                <View
                  className="rounded-full px-2.5 py-0.5"
                  style={{
                    backgroundColor: plan.isActive ? "#1A3A1A" : "#3A1A1A",
                  }}
                >
                  <Text
                    className="font-poppins-medium text-[10px]"
                    style={{
                      color: plan.isActive ? "#4ADE80" : "#F87171",
                    }}
                  >
                    {plan.isActive ? "Ativo" : "Inativo"}
                  </Text>
                </View>
              </View>

              <Text className="font-poppins-bold text-2xl text-primary">
                {formatPrice(plan.priceCents, plan.recurrenceMonths)}
              </Text>

              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                <View className="rounded-full bg-background px-2.5 py-1">
                  <Text className="font-poppins text-[11px] text-muted">
                    {RECURRENCE_BADGE[plan.recurrenceMonths] ??
                      `${plan.recurrenceMonths} meses`}
                  </Text>
                </View>
                <View className="rounded-full bg-background px-2.5 py-1">
                  <Text className="font-poppins text-[11px] text-muted">
                    {plan.weeklyCheckinLimit
                      ? `${plan.weeklyCheckinLimit} check-ins/sem`
                      : "Ilimitado"}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
