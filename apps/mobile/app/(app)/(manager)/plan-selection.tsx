import { PlanCard } from "@/components/PlanCard";
import { MANAGER_PLANS } from "@/constants/manager-plans";
import {
  useManagerSubscription,
  useProCheckout,
  useSelectFreePlan,
} from "@/lib/hooks/use-manager-subscription";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PlanSelectionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const selectFree = useSelectFreePlan();
  const proCheckout = useProCheckout();
  const { data: currentSub } = useManagerSubscription();

  async function handleSelectFree() {
    try {
      await selectFree.mutateAsync();
      router.replace("/(app)/(manager)/(home)");
    } catch {
      Alert.alert("Erro", "Não foi possível selecionar o plano gratuito.");
    }
  }

  async function handleSelectPro() {
    try {
      const isChangingPlan = currentSub?.status === "active";
      const returnPath = isChangingPlan ? "finances" : "subscription-result";

      const { checkoutUrl } = await proCheckout.mutateAsync({ returnPath });
      await Linking.openURL(checkoutUrl);
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar a assinatura Pro.");
    }
  }

  const isLoading = selectFree.isPending || proCheckout.isPending;

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
            loading={plan.id === "free" ? selectFree.isPending : proCheckout.isPending}
            onPress={plan.id === "free" ? handleSelectFree : handleSelectPro}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
