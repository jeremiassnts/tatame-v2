import { BackButton } from "@/components/BackButton";
import { BELT_LABELS_SHORT, BELT_COLORS } from "@/lib/belts";
import type { Belt } from "@/lib/belts";
import { useDependents } from "@/lib/hooks/use-dependents";
import { useRouter } from "expo-router";
import { Plus, Users } from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_MUTED = "#525252";
const TEXT_SECONDARY = "#8A8A8A";
const SEPARATOR = "#2A2A2A";

function calcAge(birthDate: string): number {
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / 31557600000);
}

type SubscriptionStatus = "active" | "expired" | "none";

function SubscriptionBadge({ status }: { status: SubscriptionStatus }) {
  const config: Record<SubscriptionStatus, { bg: string; text: string; label: string }> = {
    active: { bg: "#1A3A1A", text: "#4ADE80", label: "Ativo" },
    expired: { bg: "#3A1A1A", text: "#F87171", label: "Expirado" },
    none: { bg: "#2A2A2A", text: "#8A8A8A", label: "Sem plano" },
  };
  const c = config[status];
  return (
    <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: c.bg }}>
      <Text className="font-poppins-medium text-[10px]" style={{ color: c.text }}>
        {c.label}
      </Text>
    </View>
  );
}

export default function StudentDependentsScreen() {
  const router = useRouter();
  const { data, isPending } = useDependents();
  const dependents = data?.items ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 20 }}>
        {/* Header */}
        <View className="flex-row items-center gap-3">
          <BackButton />
          <Text className="flex-1 text-center font-poppins-semibold text-base text-primary">
            Meus Dependentes
          </Text>
          <Pressable
            onPress={() => router.push("/(app)/(guardian)/(dependents)/create")}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <Plus size={18} color="#A078E8" />
          </Pressable>
        </View>

        {isPending ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#A078E8" />
          </View>
        ) : dependents.length === 0 ? (
          /* Empty state */
          <View className="flex-1 items-center justify-center" style={{ gap: 16 }}>
            <View
              className="h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "#A078E820" }}
            >
              <Users size={32} color="#A078E8" />
            </View>
            <View className="items-center" style={{ gap: 6 }}>
              <Text className="font-poppins-semibold text-base text-primary">
                Nenhum dependente cadastrado
              </Text>
              <Text
                className="text-center font-poppins text-sm"
                style={{ color: TEXT_SECONDARY }}
              >
                Adicione um dependente para gerenciar{"\n"}a assinatura e os treinos dele.
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/(app)/(guardian)/(dependents)/create")}
              className="flex-row items-center justify-center gap-2 rounded-xl px-6"
              style={{ height: 48, backgroundColor: "#A078E8" }}
            >
              <Plus size={18} color="#FFFFFF" />
              <Text className="font-poppins-semibold text-sm text-white">
                Adicionar dependente
              </Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 32 }}
          >
            {dependents.map((dep) => {
              const belt = dep.belt as Belt;
              const beltColor = BELT_COLORS[belt] ?? TEXT_MUTED;
              const beltLabel = BELT_LABELS_SHORT[belt] ?? dep.belt;
              const age = calcAge(dep.birthDate);

              return (
                <Pressable
                  key={dep.id}
                  onPress={() =>
                    router.push(`/(app)/(guardian)/(dependents)/${dep.id}`)
                  }
                  className="rounded-2xl border border-surface-border bg-surface"
                  style={{ padding: 16 }}
                >
                  <View className="flex-row items-center justify-between">
                    <View style={{ gap: 4, flex: 1 }}>
                      <Text className="font-poppins-semibold text-base text-primary">
                        {dep.name}
                      </Text>
                      <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
                        {age} {age === 1 ? "ano" : "anos"}
                      </Text>
                    </View>
                    <SubscriptionBadge status="none" />
                  </View>

                  <View className="mt-3 h-px" style={{ backgroundColor: SEPARATOR }} />

                  <View className="mt-3 flex-row items-center" style={{ gap: 6 }}>
                    <View
                      className="rounded-full"
                      style={{ width: 10, height: 10, backgroundColor: beltColor }}
                    />
                    <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
                      Faixa {beltLabel}
                      {dep.stripes > 0
                        ? ` · ${dep.stripes} ${dep.stripes === 1 ? "grau" : "graus"}`
                        : ""}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
