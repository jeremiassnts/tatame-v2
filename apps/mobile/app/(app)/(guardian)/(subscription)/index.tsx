import { BackButton } from "@/components/BackButton";
import { useDependents } from "@/lib/hooks/use-dependents";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CreditCard } from "lucide-react-native";
import { useState } from "react";
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
const ACCENT = "#A078E8";

type StatusBadgeProps = {
  status: "active" | "expired" | "grace" | "none";
};

function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    active: { label: "Ativa", color: "#32D74B", bg: "#32D74B20" },
    expired: { label: "Expirada", color: "#FF453A", bg: "#FF453A20" },
    grace: { label: "Carência", color: "#FF9F0A", bg: "#FF9F0A20" },
    none: { label: "Sem plano", color: TEXT_MUTED, bg: "#2A2A2A" },
  }[status];

  return (
    <View
      className="rounded-full px-3 py-1"
      style={{ backgroundColor: config.bg }}
    >
      <Text
        className="font-poppins-semibold text-xs"
        style={{ color: config.color }}
      >
        {config.label}
      </Text>
    </View>
  );
}

type DependentSubscriptionCardProps = {
  name: string;
  dependentId: string;
  onChoosePlan: () => void;
  onChangePlan: () => void;
};

function DependentSubscriptionCard({
  name,
  dependentId: _dependentId,
  onChoosePlan,
  onChangePlan,
}: DependentSubscriptionCardProps) {
  // Placeholder card — no subscription data available yet for dependents.
  // Once the API supports GET /subscriptions/dependent/:id, replace with real data.
  return (
    <View
      className="rounded-2xl border border-surface-border bg-surface"
      style={{ padding: 20, gap: 16 }}
    >
      {/* Header row */}
      <View className="flex-row items-center justify-between">
        <Text className="font-poppins-semibold text-base text-primary">
          {name}
        </Text>
        <StatusBadge status="none" />
      </View>

      {/* Plan info placeholder */}
      <View style={{ gap: 4 }}>
        <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
          Nenhuma assinatura ativa
        </Text>
        <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
          Escolha um plano para este dependente
        </Text>
      </View>

      {/* CTA button */}
      <Pressable
        onPress={onChoosePlan}
        className="flex-row items-center justify-center rounded-xl"
        style={{ height: 44, gap: 8, backgroundColor: ACCENT }}
        android_ripple={{ color: "#ffffff30" }}
      >
        <CreditCard size={16} color="#FFFFFF" />
        <Text className="font-poppins-semibold text-sm text-white">
          Escolher plano
        </Text>
      </Pressable>

      {/* Secondary: change plan (hidden until plan is active, kept for future use) */}
      {false && (
        <Pressable
          onPress={onChangePlan}
          className="items-center justify-center rounded-xl border border-surface-border"
          style={{ height: 44 }}
        >
          <Text
            className="font-poppins-semibold text-sm"
            style={{ color: TEXT_SECONDARY }}
          >
            Alterar plano
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default function GuardianSubscriptionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: dependentsResponse, isLoading } = useDependents();
  const [refreshing, setRefreshing] = useState(false);

  const dependents = dependentsResponse?.items ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["dependents", "me"] });
    setRefreshing(false);
  };

  const navigateToPlans = (dependentId: string) => {
    router.push({
      pathname: "/(app)/(student)/(subscription)/plans",
      params: { dependentId },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
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
            tintColor={ACCENT}
          />
        }
      >
        <View style={{ gap: 20 }}>
          {/* Header */}
          <View className="flex-row items-center gap-3" style={{ paddingTop: 8 }}>
            <BackButton />
            <Text className="flex-1 text-center font-poppins-semibold text-base text-primary">
              Assinaturas
            </Text>
            <View className="h-10 w-10" />
          </View>

          {isLoading ? (
            <ActivityIndicator color={ACCENT} style={{ marginTop: 32 }} />
          ) : dependents.length === 0 ? (
            <View
              className="items-center rounded-2xl border border-surface-border bg-surface py-10"
              style={{ gap: 8 }}
            >
              <CreditCard size={32} color={TEXT_MUTED} />
              <Text
                className="font-poppins-semibold text-sm text-primary"
                style={{ marginTop: 4 }}
              >
                Nenhum dependente cadastrado
              </Text>
              <Text
                className="font-poppins text-xs text-center"
                style={{ color: TEXT_SECONDARY, paddingHorizontal: 24 }}
              >
                Adicione dependentes para gerenciar as assinaturas deles.
              </Text>
              <Pressable
                onPress={() =>
                  router.push("/(app)/(guardian)/(dependents)/create")
                }
                className="mt-2 rounded-xl px-5 py-2"
                style={{ backgroundColor: ACCENT }}
              >
                <Text className="font-poppins-semibold text-sm text-white">
                  Adicionar dependente
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <Text
                className="font-poppins text-sm"
                style={{ color: TEXT_SECONDARY }}
              >
                Gerencie as assinaturas dos seus dependentes.
              </Text>
              {dependents.map((dep) => (
                <DependentSubscriptionCard
                  key={dep.id}
                  name={dep.name}
                  dependentId={dep.id}
                  onChoosePlan={() => navigateToPlans(dep.id)}
                  onChangePlan={() => navigateToPlans(dep.id)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
