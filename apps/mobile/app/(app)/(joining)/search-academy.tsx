import { AcademySearchCard } from "@/components/AcademySearchCard";
import { useSearchAcademies } from "@/lib/hooks/use-membership";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";
const SEARCH_DEBOUNCE_MS = 400;

const ROLE_COPY: Record<string, { title: string; subtitle: string }> = {
  instructor: {
    title: "Buscar academia",
    subtitle: "Encontre uma academia para enviar sua solicitação de entrada",
  },
  student: {
    title: "Buscar academia",
    subtitle: "Encontre uma academia para solicitar sua entrada como aluno",
  },
};

export default function SearchAcademyScreen() {
  const { data: user } = useCurrentUser();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const router = useRouter();

  const copy = useMemo(() => {
    const role = user?.activeRole ?? "student";
    return ROLE_COPY[role] ?? ROLE_COPY.student;
  }, [user?.activeRole]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const { data: results, isPending, isFetching } =
    useSearchAcademies(debouncedQuery);
  const shouldShowResults = query.trim().length >= 2;
  const isDebouncing = query !== debouncedQuery;

  return (
    <SafeAreaView className="flex-1 bg-background pt-6" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 20 }}>
        <View>
          <Text className="font-poppins-bold text-primary"
            style={{ fontSize: 28, letterSpacing: -1 }}>
            {copy.title}
          </Text>
          <Text
            className="font-poppins text-sm"
            style={{ color: TEXT_SECONDARY, lineHeight: 22 }}
          >
            {copy.subtitle}
          </Text>
        </View>

        <View className="flex-row items-center gap-2.5 rounded-xl border border-surface-border bg-surface px-4">
          <Search size={18} color={TEXT_MUTED} />
          <TextInput
            className="min-w-0 flex-1 font-poppins text-sm text-primary"
            placeholder="Buscar por nome da academia..."
            placeholderTextColor={TEXT_MUTED}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ height: 52 }}
          />
        </View>

        {shouldShowResults ? (
          <>
            <Text className="font-poppins-semibold text-xs" style={{ color: TEXT_SECONDARY }}>
              Resultados
            </Text>

            {isDebouncing || isPending || isFetching ? (
              <View className="items-center py-8">
                <ActivityIndicator color="#A078E8" />
              </View>
            ) : (
              <FlatList
                data={results ?? []}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <AcademySearchCard
                    name={item.name}
                    address={item.address}
                    logoUrl={item.logoUrl}
                    onPress={() => router.push(`/(app)/(joining)/academy/${item.id}`)}
                  />
                )}
                ListEmptyComponent={
                  <View className="items-center py-8">
                    <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                      Nenhuma academia encontrada
                    </Text>
                  </View>
                }
              />
            )}
          </>
        ) : (
          <View className="flex-1" />
        )}
      </View>
    </SafeAreaView>
  );
}
