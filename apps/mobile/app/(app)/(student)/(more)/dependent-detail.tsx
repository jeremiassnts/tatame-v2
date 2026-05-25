import { BackButton } from "@/components/BackButton";
import { BELT_LABELS_SHORT, BELT_COLORS } from "@/lib/belts";
import type { Belt } from "@/lib/belts";
import { useDeleteDependent, useDependent } from "@/lib/hooks/use-dependents";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CalendarDays,
  ChevronRight,
  CreditCard,
  History,
  Pencil,
  Trash2,
} from "lucide-react-native";

const TEXT_MUTED = "#525252";
const TEXT_SECONDARY = "#8A8A8A";
const SEPARATOR = "#2A2A2A";

function calcAge(birthDate: string): number {
  return Math.floor((Date.now() - new Date(birthDate).getTime()) / 31557600000);
}

type QuickAction = {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
};

function QuickActionButton({ icon, label, onPress }: QuickAction) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center justify-center rounded-2xl border border-surface-border bg-surface"
      style={{ paddingVertical: 18, gap: 8 }}
    >
      {icon}
      <Text
        className="text-center font-poppins-medium text-xs text-primary"
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function DependentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: dependent, isPending } = useDependent(id ?? null);
  const deleteDependent = useDeleteDependent();

  const handleDelete = () => {
    if (!id) return;
    Alert.alert(
      "Excluir dependente",
      `Deseja realmente excluir ${dependent?.name ?? "este dependente"}? Esta ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            deleteDependent.mutate(id, {
              onSuccess: () => router.back(),
              onError: (err) => {
                const msg = err instanceof Error ? err.message : "Erro ao excluir dependente";
                Alert.alert("Erro", msg);
              },
            });
          },
        },
      ],
    );
  };

  if (isPending || !dependent) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const belt = dependent.belt as Belt;
  const beltColor = BELT_COLORS[belt] ?? TEXT_MUTED;
  const beltLabel = BELT_LABELS_SHORT[belt] ?? dependent.belt;
  const age = calcAge(dependent.birthDate);

  const quickActions: QuickAction[] = [
    {
      icon: <CalendarDays size={22} color="#A078E8" />,
      label: "Histórico de check-ins",
      onPress: () => {
        // TODO: navigate to dependent checkin history
      },
    },
    {
      icon: <CreditCard size={22} color="#A078E8" />,
      label: "Assinatura",
      onPress: () => {
        // TODO: navigate to dependent subscription
      },
    },
    {
      icon: <History size={22} color="#A078E8" />,
      label: "Histórico de pagamentos",
      onPress: () => {
        // TODO: navigate to dependent payment history
      },
    },
    {
      icon: <Pencil size={22} color="#A078E8" />,
      label: "Editar",
      onPress: () =>
        router.push(`/(app)/(student)/(more)/edit-dependent?id=${id}`),
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 16 }}>
        {/* Header */}
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
          {/* Hero: name, age, belt */}
          <View className="items-center" style={{ gap: 8 }}>
            <View
              className="h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: "#A078E820" }}
            >
              <Text className="font-poppins-bold text-3xl text-primary">
                {dependent.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text className="font-poppins-bold text-[28px] text-primary">
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
                {dependent.stripes > 0
                  ? ` · ${dependent.stripes} ${dependent.stripes === 1 ? "grau" : "graus"}`
                  : ""}
              </Text>
            </View>
          </View>

          {/* Quick info section */}
          <View className="overflow-hidden rounded-2xl border border-surface-border bg-surface">
            <View className="flex-row items-center justify-between px-4 py-3.5">
              <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
                Plano / Assinatura
              </Text>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Text className="font-poppins-semibold text-sm text-primary">
                  Sem plano
                </Text>
                <ChevronRight size={14} color={TEXT_MUTED} />
              </View>
            </View>

            <View className="h-px" style={{ backgroundColor: SEPARATOR }} />

            <View className="flex-row items-center justify-between px-4 py-3.5">
              <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
                Check-ins este mês
              </Text>
              <Text className="font-poppins-semibold text-sm text-primary">—</Text>
            </View>

            <View className="h-px" style={{ backgroundColor: SEPARATOR }} />

            <View className="flex-row items-center justify-between px-4 py-3.5">
              <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
                Último check-in
              </Text>
              <Text className="font-poppins-semibold text-sm text-primary">—</Text>
            </View>
          </View>

          {/* Quick actions 2x2 grid */}
          <View style={{ gap: 10 }}>
            <View className="flex-row" style={{ gap: 10 }}>
              <QuickActionButton {...quickActions[0]!} />
              <QuickActionButton {...quickActions[1]!} />
            </View>
            <View className="flex-row" style={{ gap: 10 }}>
              <QuickActionButton {...quickActions[2]!} />
              <QuickActionButton {...quickActions[3]!} />
            </View>
          </View>
        </ScrollView>

        {/* Destructive action */}
        <View className="mb-6">
          <Pressable
            onPress={handleDelete}
            disabled={deleteDependent.isPending}
            className="flex-row items-center justify-center gap-2 rounded-xl border"
            style={{ height: 48, backgroundColor: "#1A0A0A", borderColor: "#FF453A40" }}
          >
            {deleteDependent.isPending ? (
              <ActivityIndicator color="#FF453A" size="small" />
            ) : (
              <>
                <Trash2 size={16} color="#FF453A" />
                <Text className="font-poppins-semibold text-sm" style={{ color: "#FF453A" }}>
                  Excluir dependente
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
