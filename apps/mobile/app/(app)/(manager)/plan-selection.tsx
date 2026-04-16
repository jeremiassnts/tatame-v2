import { PlanCard } from "@/components/PlanCard";
import { MANAGER_PLANS } from "@/constants/manager-plans";
import { useSelectFreePlan } from "@/lib/hooks/use-manager-subscription";
import {
  mapPurchaseError,
  useMonthlyPackage,
  usePurchaseSubscription,
  useRestorePurchases,
} from "@/lib/hooks/use-revenuecat";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PlanSelectionScreen() {
  const router = useRouter();
  const selectFree = useSelectFreePlan();
  const { data: monthlyPackage } = useMonthlyPackage();
  const purchase = usePurchaseSubscription();
  const restore = useRestorePurchases();

  async function handleSelectFree() {
    try {
      await selectFree.mutateAsync();
      router.replace("/(app)/(manager)/(home)");
    } catch {
      Alert.alert("Erro", "Não foi possível selecionar o plano gratuito.");
    }
  }

  async function handleSelectPro() {
    if (!monthlyPackage) {
      Alert.alert("Erro", "Plano indisponível no momento.");
      return;
    }
    try {
      await purchase.mutateAsync(monthlyPackage);
      router.push("/(app)/(manager)/subscription-result");
    } catch (err) {
      const message = mapPurchaseError(err);
      if (message) Alert.alert("Erro", message);
    }
  }

  async function handleRestore() {
    try {
      const info = await restore.mutateAsync();
      const active = info.entitlements?.active?.["pro"];
      if (active) {
        router.replace("/(app)/(manager)/subscription-result");
      } else {
        Alert.alert(
          "Nenhuma compra encontrada",
          "Não encontramos uma assinatura ativa vinculada à sua conta.",
        );
      }
    } catch {
      Alert.alert("Erro", "Não foi possível restaurar compras.");
    }
  }

  const isLoading =
    selectFree.isPending || purchase.isPending || restore.isPending;

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
            loading={plan.id === "free" ? selectFree.isPending : purchase.isPending}
            onPress={plan.id === "free" ? handleSelectFree : handleSelectPro}
          />
        ))}

        <Pressable
          onPress={handleRestore}
          disabled={isLoading}
          className="items-center rounded-xl bg-surface px-5 py-3"
          style={{ opacity: isLoading ? 0.5 : 1 }}
        >
          <Text className="font-poppins-semibold text-sm" style={{ color: "#A078E8" }}>
            Restaurar compras
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
