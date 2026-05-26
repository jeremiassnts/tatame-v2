import { Avatar } from "@/components/Avatar";
import {
  useAcademySubscriptions,
  type AcademySubscriptionItem,
} from "@/lib/hooks/use-academy-subscriptions";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ChevronRight, Search } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";

type FilterKey = "all" | "active" | "expired" | "pending";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativos" },
  { key: "expired", label: "Expirados" },
  { key: "pending", label: "Pgto. pendente" },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "#1A3A1A", text: "#4ADE80", label: "Ativo" },
  expired: { bg: "#3A3A1A", text: "#FFD60A", label: "Expirado" },
  cancelled: { bg: "#3A1A1A", text: "#F87171", label: "Cancelado" },
  pending: { bg: "#3A3A1A", text: "#FFD60A", label: "Pgto. pendente" },
};

function formatDate(value: string): string {
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getDisplayStatus(item: AcademySubscriptionItem): string {
  if (item.effectiveStatus === "active" && !item.hasPaidCurrentMonth) {
    return "pending";
  }
  return item.effectiveStatus;
}

function parseFilterParam(v: unknown): FilterKey {
  const raw = Array.isArray(v) ? v[0] : v;
  if (
    raw === "all" ||
    raw === "active" ||
    raw === "expired" ||
    raw === "pending"
  ) {
    return raw;
  }
  return "all";
}

export default function SubscriptionsListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<FilterKey>(() =>
    parseFilterParam(params.filter),
  );

  useEffect(() => {
    setFilter(parseFilterParam(params.filter));
  }, [params.filter]);
  const [search, setSearch] = useState("");

  const { data: subscriptions, isPending } = useAcademySubscriptions();

  const filtered = useMemo(() => {
    let items = subscriptions ?? [];

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (s) =>
          (s.dependentName ?? s.user.name).toLowerCase().includes(q),
      );
    }

    switch (filter) {
      case "active":
        return items.filter((s) => s.effectiveStatus === "active");
      case "expired":
        return items.filter((s) => s.effectiveStatus === "expired");
      case "pending":
        return items.filter(
          (s) => s.effectiveStatus === "active" && !s.hasPaidCurrentMonth,
        );
      default:
        return items;
    }
  }, [subscriptions, filter, search]);

  if (isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 20 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">
            Assinaturas
          </Text>
          <View className="h-10 w-10" />
        </View>

        <View
          className="flex-row items-center rounded-lg border border-surface-border bg-surface"
          style={{ height: 48, paddingHorizontal: 16, gap: 10 }}
        >
          <Search size={18} color={TEXT_MUTED} />
          <TextInput
            className="flex-1 font-poppins text-sm text-primary"
            placeholder="Buscar aluno..."
            placeholderTextColor={TEXT_MUTED}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                className="items-center justify-center rounded-full"
                style={{
                  height: 36,
                  paddingHorizontal: 14,
                  backgroundColor: active ? "#A078E8" : "#1A1A1A",
                  borderWidth: active ? 0 : 1,
                  borderColor: "#2A2A2A",
                }}
              >
                <Text
                  className="font-poppins-medium text-xs"
                  style={{ color: active ? "#FFFFFF" : TEXT_SECONDARY }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        >
          {filtered.map((sub) => {
            const status = getDisplayStatus(sub);
            const style = STATUS_STYLES[status] ?? STATUS_STYLES.active;

            return (
              <Pressable
                key={sub.subscription.id}
                onPress={() =>
                  router.push(
                    `/(app)/(manager)/(finances)/subscriptions/${sub.subscription.id}`,
                  )
                }
                className="flex-row items-center rounded-2xl border border-surface-border bg-surface"
                style={{ padding: 14, gap: 14 }}
              >
                <Avatar
                  variant="user"
                  imageUrl={sub.dependentName ? null : sub.user.profileImageUrl}
                  fallbackLetter={sub.dependentName ?? sub.user.name}
                  size={44}
                />
                <View className="flex-1" style={{ gap: 4 }}>
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <Text className="font-poppins-semibold text-sm text-primary">
                      {sub.dependentName ?? sub.user.name}
                    </Text>
                    <View
                      className="rounded-full px-2 py-0.5"
                      style={{ backgroundColor: "#A078E820" }}
                    >
                      <Text
                        className="font-poppins-medium text-[10px]"
                        style={{ color: "#A078E8" }}
                      >
                        {sub.plan.name}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <View
                      className="rounded-full px-2 py-0.5"
                      style={{ backgroundColor: style.bg }}
                    >
                      <Text
                        className="font-poppins-medium text-[10px]"
                        style={{ color: style.text }}
                      >
                        {style.label}
                      </Text>
                    </View>
                    <Text
                      className="font-poppins text-[11px]"
                      style={{ color: TEXT_MUTED }}
                    >
                      Exp. {formatDate(sub.subscription.expiresAt)}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={16} color={TEXT_MUTED} />
              </Pressable>
            );
          })}
          {filtered.length === 0 && (
            <Text
              className="font-poppins text-sm text-center"
              style={{ color: TEXT_MUTED, marginTop: 32 }}
            >
              Nenhuma assinatura encontrada
            </Text>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
