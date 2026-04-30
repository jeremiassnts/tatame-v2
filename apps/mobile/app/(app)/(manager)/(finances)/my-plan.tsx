import { BackButton } from "@/components/BackButton";
import { useManagerSubscription } from "@/lib/hooks/use-manager-subscription";
import Constants from "expo-constants";
import {
  Calendar,
  ChevronRight,
  ExternalLink,
  Timer,
} from "lucide-react-native";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PORTAL_URL =
  Constants.expoConfig?.extra?.managerPortalUrl ?? "https://tatame.app/conta";

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

export default function MyPlanScreen() {
  const { data: sub } = useManagerSubscription();

  const isPro = sub?.plan === "pro";
  const planName = isPro ? "Pro" : "Gratuito";
  const statusLabel =
    sub?.status === "active"
      ? "ATIVO"
      : sub?.status === "trialing"
        ? "TRIAL"
        : sub?.status === "past_due"
          ? "ATRASADO"
          : sub?.status === "canceled"
            ? "CANCELADO"
            : "ATIVO";

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
          </View>

          <View className="h-px w-full" style={{ backgroundColor: DIVIDER }} />

          <View style={{ gap: 8 }}>
            {sub?.currentPeriodEnd ? (
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Calendar size={14} color={TEXT_MUTED} />
                <Text className="font-poppins text-[13px]" style={{ color: TEXT_SECONDARY }}>
                  Proxima cobranca em {formatDate(sub.currentPeriodEnd)}
                </Text>
              </View>
            ) : null}
            {sub?.trialEndsAt ? (
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Timer size={14} color={TEXT_MUTED} />
                <Text className="font-poppins text-[13px]" style={{ color: TEXT_SECONDARY }}>
                  Trial termina em {formatDate(sub.trialEndsAt)}
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
          onPress={() => Linking.openURL(PORTAL_URL)}
          className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 16 }}
        >
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <ExternalLink size={18} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-sm text-primary">
              Gerenciar minha conta
            </Text>
          </View>
          <ChevronRight size={18} color={TEXT_SECONDARY} />
        </Pressable>

        <Text className="font-poppins text-xs text-center" style={{ color: TEXT_MUTED }}>
          Alteracoes de plano, pagamento e cancelamento sao feitas pelo portal web.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
