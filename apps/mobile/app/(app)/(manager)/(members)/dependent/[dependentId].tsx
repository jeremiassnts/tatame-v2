import { BackButton } from "@/components/BackButton";
import { BELT_LABELS_SHORT, BELT_COLORS } from "@/lib/belts";
import type { Belt } from "@/lib/belts";
import { useDependent } from "@/lib/hooks/use-dependents";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowUpRight, User } from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_MUTED = "#525252";
const TEXT_SECONDARY = "#8A8A8A";

function calcAge(birthDate: string): number {
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / 31557600000);
}

export default function ManagerDependentDetailScreen() {
  const { dependentId, guardianName, guardianMembershipId } = useLocalSearchParams<{
    dependentId: string;
    guardianName?: string;
    guardianMembershipId?: string;
  }>();
  const router = useRouter();
  const { data: dependent, isPending } = useDependent(dependentId ?? null);

  if (isPending || !dependent) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const belt = dependent.currentBelt?.belt as Belt | undefined;
  const beltColor = belt ? (BELT_COLORS[belt] ?? TEXT_MUTED) : TEXT_MUTED;
  const beltLabel = belt ? (BELT_LABELS_SHORT[belt] ?? belt) : "—";
  const age = calcAge(dependent.birthDate);

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 16 }}>
        <View className="flex-row items-center justify-between">
          <BackButton />
          <Text className="font-poppins-bold text-lg text-primary">Dependente</Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 18, paddingBottom: 24 }}
        >
          {/* Hero */}
          <View className="items-center" style={{ gap: 8 }}>
            <View
              className="h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "#A078E820" }}
            >
              <Text className="font-poppins-bold text-3xl text-primary">
                {dependent.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text className="text-center font-poppins-bold text-[28px] text-primary">
              {dependent.name}
            </Text>
            <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
              {age} {age === 1 ? "ano" : "anos"}
            </Text>
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <View
                className="rounded-full"
                style={{ width: 10, height: 10, backgroundColor: beltColor }}
              />
              <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
                Faixa {beltLabel}
                {dependent.currentBelt && dependent.currentBelt.stripes > 0
                  ? ` · ${dependent.currentBelt.stripes} ${dependent.currentBelt.stripes === 1 ? "grau" : "graus"}`
                  : ""}
              </Text>
            </View>
          </View>

          {/* Info card */}
          <View className="overflow-hidden rounded-2xl border border-surface-border bg-surface">
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <User size={16} color={TEXT_MUTED} />
              <View style={{ gap: 2 }}>
                <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
                  Responsável
                </Text>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {guardianName || "—"}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Promote button */}
        <View className="mb-6">
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(app)/promote-graduation",
                params: {
                  userId: dependent.guardianId,
                  membershipId: guardianMembershipId,
                  dependentId: dependent.id,
                  dependentName: dependent.name,
                },
              })
            }
            className="flex-row items-center justify-center gap-2 rounded-xl py-3.5"
            style={{ backgroundColor: "#A078E8", height: 48 }}
          >
            <ArrowUpRight size={16} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-sm text-white">
              Promover graduação
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
