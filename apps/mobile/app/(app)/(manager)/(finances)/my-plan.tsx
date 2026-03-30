import { BackButton } from "@/components/BackButton";
import {
  useManagerSubscription,
  useStripePortal,
} from "@/lib/hooks/use-manager-subscription";
import { useRouter } from "expo-router";
import { Calendar, ChevronRight, CreditCard, XCircle } from "lucide-react-native";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";

function formatDate(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function MyPlanScreen() {
  const router = useRouter();
  const { data: sub } = useManagerSubscription();
  const portal = useStripePortal();

  const isPro = sub?.plan === "pro";
  const planPrice = isPro ? "R$ 49" : "R$ 0";

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
            gap: 12,
            borderColor: isPro ? "#A078E8" : "#2A2A2A",
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <Text className="font-poppins-semibold text-base text-primary">
                Plano atual
              </Text>
              <View
                className="rounded-full"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 2,
                  backgroundColor: isPro ? "#A078E8" : "#32D74B",
                }}
              >
                <Text className="font-poppins-bold text-[10px] text-white">
                  {isPro ? "PRO" : "FREE"}
                </Text>
              </View>
            </View>
            <View className="flex-row items-baseline" style={{ gap: 2 }}>
              <Text className="font-poppins-bold text-xl text-primary">
                {planPrice}
              </Text>
              <Text
                className="font-poppins text-xs"
                style={{ color: TEXT_SECONDARY }}
              >
                /mês
              </Text>
            </View>
          </View>

          {isPro && sub?.currentPeriodEnd && (
            <View style={{ gap: 6 }}>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Calendar size={14} color={TEXT_SECONDARY} />
                <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
                  Próxima cobrança em {formatDate(sub.currentPeriodEnd)}
                </Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Calendar size={14} color={TEXT_SECONDARY} />
                <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
                  Assinante desde {formatDate(sub.subscribedAt)}
                </Text>
              </View>
            </View>
          )}
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

        {isPro && (
          <Pressable
            onPress={handleOpenPortal}
            className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 16 }}
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
      </ScrollView>
    </SafeAreaView>
  );
}

