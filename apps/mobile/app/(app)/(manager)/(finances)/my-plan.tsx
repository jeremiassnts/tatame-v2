import { BackButton } from "@/components/BackButton";
import {
  useManagerSubscription,
  useManagerInvoices,
  useStripePortal,
} from "@/lib/hooks/use-manager-subscription";
import { useRouter } from "expo-router";
import { Calendar, ChevronRight, CreditCard, Timer, XCircle } from "lucide-react-native";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";
const DIVIDER = "#2A2A2A";

function formatDate(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(0)}`;
}

function formatMonthLabel(referenceMonth: string): string {
  const d = new Date(referenceMonth + "T00:00:00");
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function MyPlanScreen() {
  const router = useRouter();
  const { data: sub } = useManagerSubscription();
  const { data: invoices } = useManagerInvoices({ enabled: sub?.plan === "pro" });
  const portal = useStripePortal();

  const isPro = sub?.plan === "pro";
  const isScheduledForCancel =
    sub?.status === "active" &&
    !!sub?.canceledAt &&
    new Date(sub.canceledAt).getTime() > Date.now();
  const planPrice = isPro ? "R$ 49" : "R$ 0";
  const planName = isPro ? "Pro" : "Gratuito";
  const statusLabel =
    sub?.status === "active"
      ? "ATIVO"
      : sub?.status === "incomplete"
        ? "PENDENTE"
        : sub?.status === "past_due"
          ? "ATRASADO"
          : sub?.status === "canceled"
            ? "CANCELADO"
            : "ATIVO";

  async function handleOpenPortal() {
    try {
      const { url } = await portal.mutateAsync();
      await Linking.openURL(url);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o portal de pagamento.");
    }
  }

  function handleChangePlan() {
    router.push("/(app)/(manager)/plan-selection");
  }

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 40,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3" style={{ minHeight: 62, paddingTop: 8 }}>
          <BackButton />
          <Text className="flex-1 text-center font-poppins-bold text-lg text-primary">
            Meu Plano
          </Text>
          <View className="h-10 w-10" />
        </View>

        <View
          className="rounded-2xl border bg-surface"
          style={{
            padding: 20,
            gap: 16,
            borderColor: isPro ? "#A078E8" : "#2A2A2A",
          }}
        >
          <View className="flex-row items-center justify-between">
            <View style={{ gap: 4 }}>
              <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
                Plano atual
              </Text>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Text className="font-poppins-bold text-[22px] text-primary">
                  {planName}
                </Text>
                <View
                  className="rounded-full"
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    backgroundColor: isPro ? "#A078E8" : "#2A2A2A",
                  }}
                >
                  <Text className="font-poppins-bold text-[10px] text-white">
                    {statusLabel}
                  </Text>
                </View>
              </View>
            </View>
            <View className="flex-row items-baseline" style={{ gap: 2 }}>
              <Text className="font-poppins-bold text-[28px] text-primary" style={{ letterSpacing: -1 }}>
                {planPrice}
              </Text>
              <Text
                className="font-poppins text-xs"
                style={{ color: TEXT_MUTED }}
              >
                /mês
              </Text>
            </View>
          </View>

          <View className="h-px w-full" style={{ backgroundColor: DIVIDER }} />

          <View style={{ gap: 8 }}>
            {sub?.currentPeriodEnd ? (
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Calendar size={14} color={TEXT_MUTED} />
                <Text className="font-poppins text-[13px]" style={{ color: TEXT_SECONDARY }}>
                  Próxima cobrança em {formatDate(sub.currentPeriodEnd)}
                </Text>
              </View>
            ) : null}
            {sub?.subscribedAt ? (
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Timer size={14} color={TEXT_MUTED} />
                <Text className="font-poppins text-[13px]" style={{ color: TEXT_SECONDARY }}>
                  Assinante desde {formatDate(sub.subscribedAt)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={handleChangePlan}
          className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 16 }}
        >
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <CreditCard size={18} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-sm text-primary">
              Alterar plano
            </Text>
          </View>
          <ChevronRight size={18} color={TEXT_SECONDARY} />
        </Pressable>

        {isPro ? (
          <>
            <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
              Histórico de pagamentos
            </Text>

            <View style={{ gap: 8 }}>
              {(invoices ?? []).map((inv) => {
                const month =
                  inv.referenceMonth ? formatMonthLabel(inv.referenceMonth) : "";
                const last4 = inv.paymentMethodLast4
                  ? `···· ${inv.paymentMethodLast4}`
                  : "····";

                return (
                  <View
                    key={inv.id}
                    className="rounded-xl border border-surface-border bg-surface"
                    style={{ paddingVertical: 12, paddingHorizontal: 14, gap: 4 }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="font-poppins-semibold text-sm text-primary">
                        Plano Pro — {month}
                      </Text>
                      <Text className="font-poppins-semibold text-sm" style={{ color: "#32D74B" }}>
                        {formatCurrency(inv.amountCents)}
                      </Text>
                    </View>
                    <Text className="font-poppins text-[11px]" style={{ color: TEXT_SECONDARY }}>
                      {formatDate(inv.createdAt)} · Cartão {last4}
                    </Text>
                  </View>
                );
              })}

              {(invoices ?? []).length === 0 ? (
                <View
                  className="rounded-xl border border-surface-border bg-surface"
                  style={{ paddingVertical: 12, paddingHorizontal: 14 }}
                >
                  <Text className="font-poppins text-[11px]" style={{ color: TEXT_SECONDARY }}>
                    Nenhum pagamento encontrado ainda.
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {isPro && (
          <Pressable
            onPress={isScheduledForCancel ? undefined : handleOpenPortal}
            disabled={isScheduledForCancel}
            className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
            style={{
              padding: 16,
              opacity: isScheduledForCancel ? 0.6 : 1,
            }}
          >
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <XCircle size={18} color="#FF453A" />
              <Text
                className="font-poppins-semibold text-sm"
                style={{ color: "#FF453A" }}
              >
                Cancelar assinatura
              </Text>
            </View>
            <ChevronRight size={18} color={TEXT_SECONDARY} />
          </Pressable>
        )}

        {isPro && isScheduledForCancel && sub?.canceledAt ? (
          <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
            Seu cancelamento já foi agendado e o plano ficará ativo até{" "}
            {formatDate(sub.canceledAt)}.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

