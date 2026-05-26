import { BackButton } from "@/components/BackButton";
import { useDependent, useDependentPayments } from "@/lib/hooks/use-dependents";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_MUTED = "#525252";

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function formatMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatDate(value: string): string {
  const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DependentPaymentHistoryScreen() {
  const { dependentId } = useLocalSearchParams<{ dependentId: string }>();
  const queryClient = useQueryClient();
  const { data: dependent } = useDependent(dependentId ?? null);
  const { data: payments, isLoading } = useDependentPayments(dependentId ?? null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["payments", dependentId] });
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View
        className="flex-row items-center gap-3"
        style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 }}
      >
        <BackButton />
        <Text className="flex-1 text-center font-poppins-semibold text-base text-primary">
          Pagamentos de {dependent?.name ?? ""}
        </Text>
        <View className="h-10 w-10" />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#A078E8" />
        </View>
      ) : !payments || payments.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
            Nenhum pagamento registrado
          </Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A078E8" />
          }
          renderItem={({ item, index }) => (
            <View
              className="flex-row items-center justify-between"
              style={{
                paddingVertical: 14,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: "#2A2A2A",
              }}
            >
              <View style={{ gap: 2 }}>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {formatMonth(item.referenceMonth)}
                </Text>
                <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                  {formatDate(item.paidAt)} · {item.method === "pix" ? "PIX" : item.method === "stripe" ? "Cartão" : "Manual"}
                </Text>
              </View>
              <Text className="font-poppins-semibold text-sm" style={{ color: "#32D74B" }}>
                {formatCurrency(item.amountCents)}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
