import { Avatar } from "@/components/Avatar";
import { useAcademySubscriptions } from "@/lib/hooks/use-academy-subscriptions";
import {
  useSubscriptionPlan,
  useUpdatePlan,
} from "@/lib/hooks/use-subscription-plans";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Pencil,
  RefreshCw,
  Repeat,
  Users,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";

const RECURRENCE_LABELS: Record<number, string> = {
  1: "/mês",
  3: "/trimestre",
  6: "/semestre",
  12: "/ano",
};

const RECURRENCE_DISPLAY: Record<number, string> = {
  1: "1 mês",
  3: "3 meses",
  6: "6 meses",
  12: "12 meses",
};

function formatCurrency(cents: number): string {
  return `R$${(cents / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function PlanDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();

  const { data: plan, isPending } = useSubscriptionPlan(planId);
  const { data: subscribers } = useAcademySubscriptions({
    planId,
    status: "active",
  });
  const updatePlan = useUpdatePlan(planId!);

  const handleToggleActive = () => {
    if (!plan) return;

    const action = plan.isActive ? "Desativar" : "Ativar";
    Alert.alert(
      `${action} plano`,
      `Deseja realmente ${action.toLowerCase()} o plano "${plan.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: action,
          style: plan.isActive ? "destructive" : "default",
          onPress: () => {
            updatePlan.mutate({ isActive: !plan.isActive });
          },
        },
      ],
    );
  };

  if (isPending || !plan) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const activeSubscribers = (subscribers ?? []).filter(
    (s) => s.effectiveStatus === "active",
  );

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View
        className="flex-1"
        style={{ paddingHorizontal: 24, paddingTop: 8, gap: 24 }}
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">
            Detalhes do plano
          </Text>
          <Pressable
            onPress={() =>
              router.push(`/(app)/(manager)/(finances)/plans/edit/${planId}`)
            }
            className="h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-surface"
          >
            <Pencil size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 24, paddingBottom: 24 }}
        >
          <View
            className="rounded-2xl border border-surface-border bg-surface p-5"
            style={{ gap: 16 }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-poppins-bold text-xl text-primary">
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

            <View className="flex-row items-end" style={{ gap: 4 }}>
              <Text className="font-poppins-bold text-3xl text-primary">
                {formatCurrency(plan.priceCents)}
              </Text>
              <Text
                className="font-poppins text-base"
                style={{ color: TEXT_SECONDARY, marginBottom: 2 }}
              >
                {RECURRENCE_LABELS[plan.recurrenceMonths] ??
                  `/${plan.recurrenceMonths}m`}
              </Text>
            </View>

            <View className="h-px" style={{ backgroundColor: "#2A2A2A" }} />

            <View className="flex-row flex-wrap" style={{ gap: 16 }}>
              <View style={{ gap: 2, minWidth: "40%" }}>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Repeat size={12} color={TEXT_MUTED} />
                  <Text
                    className="font-poppins text-xs"
                    style={{ color: TEXT_MUTED }}
                  >
                    Recorrência
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {RECURRENCE_DISPLAY[plan.recurrenceMonths] ??
                    `${plan.recurrenceMonths} meses`}
                </Text>
              </View>
              <View style={{ gap: 2 }}>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <RefreshCw size={12} color={TEXT_MUTED} />
                  <Text
                    className="font-poppins text-xs"
                    style={{ color: TEXT_MUTED }}
                  >
                    Check-ins/sem
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {plan.weeklyCheckinLimit ?? "Ilimitado"}
                </Text>
              </View>
              <View style={{ gap: 2, minWidth: "40%" }}>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Calendar size={12} color={TEXT_MUTED} />
                  <Text
                    className="font-poppins text-xs"
                    style={{ color: TEXT_MUTED }}
                  >
                    Criado em
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {formatDate(plan.createdAt)}
                </Text>
              </View>
              <View style={{ gap: 2 }}>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Users size={12} color={TEXT_MUTED} />
                  <Text
                    className="font-poppins text-xs"
                    style={{ color: TEXT_MUTED }}
                  >
                    Assinantes
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {activeSubscribers.length} ativos
                </Text>
              </View>
            </View>
          </View>

          <Text
            className="font-poppins-semibold text-sm"
            style={{ color: TEXT_SECONDARY }}
          >
            Assinantes ativos
          </Text>

          <View style={{ gap: 10 }}>
            {activeSubscribers.map((sub) => (
              <Pressable
                key={sub.subscription.id}
                onPress={() =>
                  router.push(
                    `/(app)/(manager)/(finances)/subscriptions/${sub.subscription.id}`,
                  )
                }
                className="flex-row items-center rounded-xl border border-surface-border bg-surface"
                style={{ padding: 12, paddingHorizontal: 14, gap: 12 }}
              >
                <Avatar
                  variant="user"
                  imageUrl={sub.user.profileImageUrl}
                  fallbackLetter={sub.user.name}
                  size={40}
                />
                <View className="flex-1" style={{ gap: 2 }}>
                  <Text className="font-poppins-semibold text-sm text-primary">
                    {sub.user.name}
                  </Text>
                  <Text
                    className="font-poppins text-xs"
                    style={{ color: TEXT_MUTED }}
                  >
                    Expira em {formatDate(sub.subscription.expiresAt)}
                  </Text>
                </View>
                <View
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: "#4ADE80" }}
                />
              </Pressable>
            ))}
            {activeSubscribers.length === 0 && (
              <Text
                className="font-poppins text-sm"
                style={{ color: TEXT_MUTED }}
              >
                Nenhum assinante ativo
              </Text>
            )}
          </View>
        </ScrollView>

        <View style={{ paddingBottom: 24 }}>
          <Pressable
            onPress={handleToggleActive}
            disabled={updatePlan.isPending}
          >
            <View
              className="flex-row items-center justify-center rounded-xl"
              style={{
                height: 52,
                gap: 8,
                ...(updatePlan.isPending
                  ? {
                    backgroundColor: "#3A3A3A",
                    borderWidth: 1,
                    borderColor: "#4A4A4A",
                  }
                  : {
                    backgroundColor: plan.isActive ? "#FF453A15" : "#32D74B15",
                    borderWidth: 1,
                    borderColor: plan.isActive ? "#FF453A40" : "#32D74B40",
                  }),
              }}
            >
              {updatePlan.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  className="font-poppins-semibold text-[15px]"
                  style={{ color: plan.isActive ? "#FF453A" : "#32D74B" }}
                >
                  {plan.isActive ? "Desativar plano" : "Ativar plano"}
                </Text>
              )}
            </View>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
