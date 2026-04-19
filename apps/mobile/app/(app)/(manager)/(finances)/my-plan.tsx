import { BackButton } from "@/components/BackButton";
import { useManagerSubscription } from "@/lib/hooks/use-manager-subscription";
import { useRestorePurchases } from "@/lib/hooks/use-revenuecat";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  CreditCard,
  RotateCcw,
  Settings,
  Timer,
} from "lucide-react-native";
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const isExpoGo = Constants.appOwnership === "expo";
const Purchases = isExpoGo
  ? null
  : (require("react-native-purchases").default as typeof import("react-native-purchases").default);

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";
const DIVIDER = "#2A2A2A";
const ANDROID_SKU = "tatame_pro_monthly";

function formatDate(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function openManageSubscription() {
  if (Platform.OS === "ios") {
    if (!Purchases) {
      Alert.alert("Indisponível", "Compras indisponíveis no Expo Go.");
      return;
    }
    await Purchases.showManageSubscriptions();
    return;
  }
  const pkg = Constants.expoConfig?.android?.package ?? "";
  await Linking.openURL(
    `https://play.google.com/store/account/subscriptions?sku=${ANDROID_SKU}&package=${pkg}`,
  );
}

export default function MyPlanScreen() {
  const router = useRouter();
  const { data: sub } = useManagerSubscription();
  const restore = useRestorePurchases();

  const isPro = sub?.plan === "pro";
  const isPastDue = sub?.status === "past_due";
  const isScheduledForCancel =
    sub?.status === "active" && !!sub?.canceledAt;

  const planPrice = isPro ? "R$ 49" : "R$ 0";
  const planName = isPro ? "Pro" : "Gratuito";
  const statusLabel =
    sub?.status === "active"
      ? "ATIVO"
      : sub?.status === "past_due"
        ? "ATRASADO"
        : sub?.status === "canceled"
          ? "CANCELADO"
          : "ATIVO";

  function handleChangePlan() {
    router.push("/(app)/(manager)/plan-selection");
  }

  async function handleManage() {
    try {
      await openManageSubscription();
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o gerenciador de assinaturas.");
    }
  }

  async function handleRestore() {
    try {
      await restore.mutateAsync();
      Alert.alert("Pronto", "Compras restauradas.");
    } catch {
      Alert.alert("Erro", "Não foi possível restaurar compras.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background py-4" edges={["top", "bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 10,
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

        {isPro && isPastDue ? (
          <View
            className="rounded-2xl"
            style={{
              backgroundColor: "rgba(255,69,58,0.12)",
              borderColor: "#FF453A",
              borderWidth: 1,
              padding: 16,
              gap: 8,
            }}
          >
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <AlertTriangle size={16} color="#FF453A" />
              <Text className="font-poppins-semibold text-sm" style={{ color: "#FF453A" }}>
                Problema no pagamento
              </Text>
            </View>
            <Text className="font-poppins text-[13px]" style={{ color: TEXT_SECONDARY }}>
              Atualize sua forma de pagamento para manter o acesso ao plano Pro.
            </Text>
            <Pressable
              onPress={handleManage}
              className="items-center rounded-xl bg-accent"
              style={{ paddingVertical: 10, marginTop: 4 }}
            >
              <Text className="font-poppins-semibold text-sm text-white">
                Atualizar pagamento
              </Text>
            </Pressable>
          </View>
        ) : null}

        {isPro && isScheduledForCancel && sub?.canceledAt ? (
          <View
            className="rounded-2xl"
            style={{
              backgroundColor: "rgba(255,204,0,0.10)",
              borderColor: "#FFCC00",
              borderWidth: 1,
              padding: 16,
              gap: 6,
            }}
          >
            <Text className="font-poppins-semibold text-sm" style={{ color: "#FFCC00" }}>
              Assinatura com cancelamento agendado
            </Text>
            <Text className="font-poppins text-[13px]" style={{ color: TEXT_SECONDARY }}>
              Sua assinatura será encerrada em{" "}
              {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : formatDate(sub.canceledAt)}.
            </Text>
          </View>
        ) : null}

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

        {isPro && (
          <Pressable
            onPress={handleManage}
            className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 16 }}
          >
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <Settings size={18} color="#FFFFFF" />
              <Text className="font-poppins-semibold text-sm text-primary">
                Gerenciar assinatura
              </Text>
            </View>
            <ChevronRight size={18} color={TEXT_SECONDARY} />
          </Pressable>
        )}

        <Pressable
          onPress={handleRestore}
          disabled={restore.isPending}
          className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 16, opacity: restore.isPending ? 0.6 : 1 }}
        >
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <RotateCcw size={18} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-sm text-primary">
              Restaurar compras
            </Text>
          </View>
          <ChevronRight size={18} color={TEXT_SECONDARY} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
