import { PlanCard } from "@/components/PlanCard";
import { MANAGER_PLANS } from "@/constants/manager-plans";
import {
  useSelectFreePlan,
  useCompleteProSubscription,
  useStartProSubscription,
} from "@/lib/hooks/use-manager-subscription";
import { useStripe } from "@stripe/stripe-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PlanSelectionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const selectFree = useSelectFreePlan();
  const startPro = useStartProSubscription();
  const completePro = useCompleteProSubscription();
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
      const start = await startPro.mutateAsync();
      const setupClientSecret = start.clientSecret;

      const { error: initError } = await initPaymentSheet({
        setupIntentClientSecret: setupClientSecret,
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

      // SetupIntent succeeded. Now create the subscription and (if needed) complete payment.
      const setupIntentId = setupClientSecret.split("_secret_")[0];
      const complete = await completePro.mutateAsync({ setupIntentId });

      if (complete.intentType === "payment") {
        const { error: initPayError } = await initPaymentSheet({
          paymentIntentClientSecret: complete.clientSecret,
          merchantDisplayName: "Tatame",
        });
        if (initPayError) {
          Alert.alert("Erro", initPayError.message);
          return;
        }

        const { error: presentPayError } = await presentPaymentSheet();
        if (presentPayError) {
          if (presentPayError.code !== "Canceled") {
            Alert.alert("Erro", presentPayError.message);
          }
          return;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      await queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
      await queryClient.invalidateQueries({ queryKey: ["user/me"] });
      router.replace("/(app)/(manager)/(home)");
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível iniciar a assinatura Pro.");
    } finally {
      setLoading(false);
    }
  }

  const isLoading = selectFree.isPending || loading;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
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

        {MANAGER_PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            title={plan.title}
            description={plan.description}
            price={plan.price}
            period={plan.period}
            features={plan.features}
            ctaLabel={plan.ctaLabel}
            badgeLabel={plan.badgeLabel}
            variant={plan.id === "pro" ? "accent" : "neutral"}
            disabled={isLoading}
            loading={plan.id === "free" ? selectFree.isPending : loading}
            onPress={plan.id === "free" ? handleSelectFree : handleSelectPro}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

