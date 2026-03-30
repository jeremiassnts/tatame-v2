import {
  useSelectFreePlan,
  useStartProSubscription,
} from "@/lib/hooks/use-manager-subscription";
import { useQueryClient } from "@tanstack/react-query";
import { useStripe } from "@stripe/stripe-react-native";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function FeatureItem({ text }: { text: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 8 }}>
      <Check size={16} color="#32D74B" />
      <Text className="font-poppins text-sm text-primary">{text}</Text>
    </View>
  );
}

export default function PlanSelectionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const selectFree = useSelectFreePlan();
  const startPro = useStartProSubscription();
  const [loading, setLoading] = useState(false);

  async function handleSelectFree() {
    try {
      await selectFree.mutateAsync();
      router.replace("/(app)/(manager)/(home)");
    } catch {
      Alert.alert("Erro", "Não foi possível selecionar o plano gratuito.");
    }
  }

  async function handleSelectPro() {
    setLoading(true);
    try {
      const { clientSecret } = await startPro.mutateAsync();

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "Tatame",
      });
      if (initError) {
        Alert.alert("Erro", initError.message);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== "Canceled") {
          Alert.alert("Erro", presentError.message);
        }
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      await queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
      await queryClient.invalidateQueries({ queryKey: ["user/me"] });
      router.replace("/(app)/(manager)/(home)");
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar a assinatura Pro.");
    } finally {
      setLoading(false);
    }
  }

  const isLoading = selectFree.isPending || loading;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: 40,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 8 }}>
          <Text className="font-poppins-bold text-2xl text-primary">
            Escolha seu plano
          </Text>
          <Text className="font-poppins text-sm" style={{ color: "#ABABAB" }}>
            Selecione o plano ideal para sua academia e comece agora
          </Text>
        </View>

        <View
          className="rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 20, gap: 16 }}
        >
          <View style={{ gap: 4 }}>
            <Text className="font-poppins-bold text-lg text-primary">
              Gratuito
            </Text>
            <Text className="font-poppins text-xs" style={{ color: "#ABABAB" }}>
              Para academias começando no digital
            </Text>
          </View>
          <View className="flex-row items-baseline" style={{ gap: 4 }}>
            <Text className="font-poppins-bold text-3xl text-primary">
              R$ 0
            </Text>
            <Text className="font-poppins text-sm" style={{ color: "#ABABAB" }}>
              /mês
            </Text>
          </View>
          <View style={{ gap: 10 }}>
            <FeatureItem text="Até 50 alunos" />
            <FeatureItem text="Agenda de aulas" />
            <FeatureItem text="Check-in de alunos" />
            <FeatureItem text="Controle de graduações" />
          </View>
          <Pressable
            onPress={handleSelectFree}
            disabled={isLoading}
            className="items-center rounded-xl bg-white"
            style={{ paddingVertical: 14 }}
          >
            {selectFree.isPending ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="font-poppins-semibold text-sm text-black">
                Começar grátis
              </Text>
            )}
          </Pressable>
        </View>

        <View
          className="rounded-2xl border-2 bg-surface"
          style={{ padding: 20, gap: 16, borderColor: "#A078E8" }}
        >
          <View
            className="self-start rounded-full"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 4,
              backgroundColor: "#A078E8",
            }}
          >
            <Text className="font-poppins-bold text-[10px] text-white">
              MAIS POPULAR
            </Text>
          </View>
          <View style={{ gap: 4 }}>
            <Text className="font-poppins-bold text-lg text-primary">Pro</Text>
            <Text className="font-poppins text-xs" style={{ color: "#ABABAB" }}>
              Para academias que querem crescer
            </Text>
          </View>
          <View className="flex-row items-baseline" style={{ gap: 4 }}>
            <Text className="font-poppins-bold text-3xl text-primary">
              R$ 49
            </Text>
            <Text className="font-poppins text-sm" style={{ color: "#ABABAB" }}>
              /mês
            </Text>
          </View>
          <View style={{ gap: 10 }}>
            <FeatureItem text="Alunos ilimitados" />
            <FeatureItem text="Tudo do plano Gratuito" />
            <FeatureItem text="Dashboard web completo" />
          </View>
          <Pressable
            onPress={handleSelectPro}
            disabled={isLoading}
            className="items-center rounded-xl"
            style={{ paddingVertical: 14, backgroundColor: "#A078E8" }}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text className="font-poppins-semibold text-sm text-white">
                Assinar Pro
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

