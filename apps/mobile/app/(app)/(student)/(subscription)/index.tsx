import { BackButton } from "@/components/BackButton";
import { useWeeklyCheckinCount } from "@/lib/hooks/use-checkin";
import { useMyPayments, useMySubscription } from "@/lib/hooks/use-subscription";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Calendar, ChevronRight } from "lucide-react-native";
import { useEffect, useState } from "react";
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

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function formatDate(value: string): string {
  const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function MySubscriptionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: subResponse, isLoading: subLoading } = useMySubscription();
  const { data: weeklyCount } = useWeeklyCheckinCount();
  const { data: payments } = useMyPayments();
  const [refreshing, setRefreshing] = useState(false);

  const subscription = subResponse?.subscription;
  const plan = subResponse?.plan;
  const hasActive =
    subscription != null && subscription.effectiveStatus === "active";

  useEffect(() => {
    if (!subLoading && !hasActive) {
      router.replace("/(app)/(student)/(subscription)/plans");
    }
  }, [subLoading, hasActive, router]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["subscription", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["checkins", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["payments", "me"] }),
    ]);
    setRefreshing(false);
  };

  if (subLoading) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-background"
        edges={["top"]}
      >
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  if (!hasActive || !plan || !subscription) return null;

  const checkinLimit = plan.weeklyCheckinLimit;
  const checkinLabel = checkinLimit
    ? `${weeklyCount?.count ?? 0} / ${checkinLimit}`
    : `${weeklyCount?.count ?? 0}`;

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
              Minha assinatura
            </Text>
            <View className="h-10 w-10" />
          </View>

          <Pressable
            onPress={() => router.push("/(app)/(student)/(subscription)/plans")}
            className="rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 20, gap: 12 }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-poppins-semibold text-base text-primary">
                {plan.name}
              </Text>
              <View
                className="rounded-full px-3 py-1"
                style={{ backgroundColor: "#32D74B20" }}
              >
                <Text
                  className="font-poppins-semibold text-xs"
                  style={{ color: "#32D74B" }}
                >
                  Ativa
                </Text>
              </View>
            </View>
            <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
              R$ {(plan.priceCents / 100).toFixed(0)} / mês
            </Text>
            <View className="flex-row" style={{ gap: 24 }}>
              <View style={{ gap: 2 }}>
                <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                  Início
                </Text>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {formatDate(subscription.startsAt)}
                </Text>
              </View>
              <View style={{ gap: 2 }}>
                <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                  Expira em
                </Text>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {formatDate(subscription.expiresAt)}
                </Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push("/(app)/(student)/(subscription)/checkin-history")
            }
            className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 16 }}
          >
            <Text className="font-poppins-semibold text-sm text-primary">
              Check-ins esta semana
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="font-poppins-bold text-base" style={{ color: "#A078E8" }}>
                {checkinLabel}
              </Text>
              <ChevronRight size={16} color={TEXT_MUTED} />
            </View>
          </Pressable>

          <View style={{ gap: 12 }}>
            <Text className="font-poppins-semibold text-base text-primary">
              Pagamentos
            </Text>
            {payments && payments.length > 0 ? (
              <View
                className="rounded-2xl border border-surface-border bg-surface"
                style={{ overflow: "hidden" }}
              >
                {payments.slice(0, 5).map((p, i) => (
                  <View
                    key={p.id}
                    className="flex-row items-center justify-between"
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: "#2A2A2A",
                    }}
                  >
                    <View style={{ gap: 2 }}>
                      <Text className="font-poppins-semibold text-sm text-primary">
                        {formatDate(p.paidAt)}
                      </Text>
                      <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                        {plan.name} · mensal
                      </Text>
                    </View>
                    <Text
                      className="font-poppins-semibold text-sm"
                      style={{ color: "#FF453A" }}
                    >
                      {formatCurrency(p.amountCents)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className="items-center rounded-2xl border border-surface-border bg-surface py-6">
                <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                  Nenhum pagamento registrado
                </Text>
              </View>
            )}
          </View>

          {payments && payments.length > 0 && (
            <View className="flex-row items-center gap-2" style={{ paddingHorizontal: 4 }}>
              <Calendar size={14} color={TEXT_MUTED} />
              <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                Próximo pagamento: {formatDate(subscription.expiresAt)} ·{" "}
                {formatCurrency(plan.priceCents)}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
