import { Avatar } from "@/components/Avatar";
import { useAcademySubscription } from "@/lib/hooks/use-academy-subscriptions";
import { usePaymentHistory } from "@/lib/hooks/use-finances";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Check,
  CreditCard,
  Shield,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";

function formatDate(value: string): string {
  const d = new Date(value.includes("T") ? value : value + "T00:00:00");
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(cents: number): string {
  return `R$${(cents / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function formatMonthLabel(referenceMonth: string): string {
  const d = new Date(referenceMonth + "T00:00:00");
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "#1A3A1A", text: "#4ADE80", label: "Ativo" },
  expired: { bg: "#3A3A1A", text: "#FFD60A", label: "Expirado" },
  cancelled: { bg: "#3A1A1A", text: "#F87171", label: "Cancelado" },
};

export default function SubscriptionDetailScreen() {
  const { subscriptionId } = useLocalSearchParams<{
    subscriptionId: string;
  }>();
  const router = useRouter();

  const { data: sub, isPending } = useAcademySubscription(subscriptionId);
  const { data: payments } = usePaymentHistory({
    subscriptionId,
  });

  if (isPending || !sub) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const statusStyle =
    STATUS_COLORS[sub.effectiveStatus] ?? STATUS_COLORS.active;

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 24 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">
            Assinatura do aluno
          </Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 24, paddingBottom: 24 }}
        >
          <View
            className="rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 20, gap: 16 }}
          >
            <View className="flex-row items-center" style={{ gap: 14 }}>
              <Avatar
                variant="user"
                imageUrl={sub.user.profileImageUrl}
                fallbackLetter={sub.user.name}
                size={48}
              />
              <View style={{ gap: 2 }}>
                <Text className="font-poppins-bold text-base text-primary">
                  {sub.user.name}
                </Text>
                <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                  {sub.user.email}
                </Text>
              </View>
            </View>

            <View className="h-px" style={{ backgroundColor: "#2A2A2A" }} />

            <View className="flex-row flex-wrap" style={{ gap: 16 }}>
              <View style={{ gap: 2, minWidth: "40%" }}>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Shield size={12} color={TEXT_MUTED} />
                  <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                    Plano
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {sub.plan.name}
                </Text>
              </View>
              <View style={{ gap: 2 }}>
                <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                  Status
                </Text>
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: statusStyle.bg }}
                >
                  <Text
                    className="font-poppins-medium text-[10px]"
                    style={{ color: statusStyle.text }}
                  >
                    {statusStyle.label}
                  </Text>
                </View>
              </View>
              <View style={{ gap: 2, minWidth: "40%" }}>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Calendar size={12} color={TEXT_MUTED} />
                  <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                    Início
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {formatDate(sub.subscription.startsAt)}
                </Text>
              </View>
              <View style={{ gap: 2 }}>
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Calendar size={12} color={TEXT_MUTED} />
                  <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                    Expiração
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {formatDate(sub.subscription.expiresAt)}
                </Text>
              </View>
            </View>

            {sub.hasPaidCurrentMonth && sub.lastPayment ? (
              <View
                className="flex-row items-center rounded-lg"
                style={{
                  backgroundColor: "#32D74B15",
                  padding: 10,
                  paddingHorizontal: 14,
                  gap: 8,
                }}
              >
                <Check size={14} color="#32D74B" />
                <Text className="font-poppins-medium text-xs" style={{ color: "#32D74B" }}>
                  Pagamento em dia
                </Text>
                <Text className="font-poppins text-[10px]" style={{ color: TEXT_MUTED }}>
                  Último: {formatDate(sub.lastPayment.paidAt)}
                </Text>
              </View>
            ) : (
              <View
                className="flex-row items-center rounded-lg"
                style={{
                  backgroundColor: "#FFD60A15",
                  padding: 10,
                  paddingHorizontal: 14,
                  gap: 8,
                }}
              >
                <CreditCard size={14} color="#FFD60A" />
                <Text className="font-poppins-medium text-xs" style={{ color: "#FFD60A" }}>
                  Pagamento pendente
                </Text>
              </View>
            )}
          </View>

          <Text
            className="font-poppins-semibold text-sm"
            style={{ color: TEXT_SECONDARY }}
          >
            Histórico de pagamentos
          </Text>

          <View style={{ gap: 10 }}>
            {(payments ?? []).map((p) => (
              <View
                key={p.id}
                className="flex-row items-center justify-between rounded-xl border border-surface-border bg-surface"
                style={{ padding: 14, paddingHorizontal: 16 }}
              >
                <View style={{ gap: 2 }}>
                  <Text className="font-poppins-semibold text-sm text-primary">
                    {formatMonthLabel(p.referenceMonth)}
                  </Text>
                  <Text className="font-poppins text-[11px]" style={{ color: TEXT_MUTED }}>
                    Confirmado em {formatDate(p.paidAt)} · Manual
                  </Text>
                </View>
                <Text
                  className="font-poppins-bold text-sm"
                  style={{ color: "#32D74B" }}
                >
                  {formatCurrency(p.amountCents)}
                </Text>
              </View>
            ))}
            {(payments ?? []).length === 0 && (
              <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                Nenhum pagamento registrado
              </Text>
            )}
          </View>
        </ScrollView>

        <View style={{ paddingBottom: 24 }}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(app)/(manager)/(finances)/confirm-payment",
                params: { subscriptionId },
              })
            }
            className="flex-row items-center justify-center rounded-xl"
            style={{ backgroundColor: "#A078E8", height: 56, gap: 8 }}
          >
            <Check size={20} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-base text-white">
              Confirmar pagamento
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
