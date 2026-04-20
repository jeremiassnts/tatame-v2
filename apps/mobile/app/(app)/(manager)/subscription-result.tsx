import { useApi } from "@/lib/api";
import {
  useManagerSubscription,
  type ManagerSubscription,
} from "@/lib/hooks/use-manager-subscription";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CheckCircle, RefreshCw } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const POLL_INTERVAL = 3000;
const MAX_POLL_TIME = 30000;

export default function SubscriptionResultScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApi();

  const { data: sub, refetch } = useManagerSubscription();
  const [state, setState] = useState<"polling" | "success" | "timeout">("polling");
  const startTime = useRef(Date.now());
  const refreshedOnce = useRef(false);

  const checkSubscription = useCallback(async () => {
    const { data } = await refetch();
    if (data?.plan === "pro" && data?.status === "active") {
      setState("success");
      await queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      await queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
      await queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      return;
    }

    if (Date.now() - startTime.current > MAX_POLL_TIME) {
      if (!refreshedOnce.current) {
        refreshedOnce.current = true;
        try {
          await api.post<ManagerSubscription>("/manager-subscriptions/refresh");
          const refreshed = await refetch();
          if (
            refreshed.data?.plan === "pro" &&
            refreshed.data?.status === "active"
          ) {
            setState("success");
            await queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
            await queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
            await queryClient.invalidateQueries({ queryKey: ["user", "me"] });
            return;
          }
        } catch {}
      }
      setState("timeout");
    }
  }, [refetch, queryClient, api]);

  useEffect(() => {
    if (state !== "polling") return;
    checkSubscription();
    const interval = setInterval(checkSubscription, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [state, checkSubscription]);

  useEffect(() => {
    if (state === "success") {
      const timer = setTimeout(() => {
        router.replace("/(app)/(manager)/(home)");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state, router]);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={["top"]}>
      {state === "polling" && (
        <View className="items-center" style={{ gap: 16 }}>
          <ActivityIndicator size="large" color="#A078E8" />
          <Text className="font-poppins-semibold text-lg text-primary">
            Aguardando confirmação...
          </Text>
          <Text
            className="font-poppins text-sm text-center px-10"
            style={{ color: "#ABABAB" }}
          >
            Estamos processando seu pagamento. Isso pode levar alguns segundos.
          </Text>
          <Pressable
            onPress={checkSubscription}
            className="mt-4 flex-row items-center rounded-xl bg-surface px-5 py-3"
            style={{ gap: 8 }}
          >
            <RefreshCw size={16} color="#A078E8" />
            <Text className="font-poppins-semibold text-sm" style={{ color: "#A078E8" }}>
              Verificar novamente
            </Text>
          </Pressable>
        </View>
      )}

      {state === "success" && (
        <View className="items-center" style={{ gap: 16 }}>
          <CheckCircle size={56} color="#32D74B" />
          <Text className="font-poppins-bold text-xl text-primary">
            Assinatura ativada!
          </Text>
          <Text className="font-poppins text-sm" style={{ color: "#ABABAB" }}>
            Redirecionando...
          </Text>
        </View>
      )}

      {state === "timeout" && (
        <View className="items-center" style={{ gap: 16 }}>
          <ActivityIndicator size="large" color="#A078E8" />
          <Text className="font-poppins-semibold text-lg text-primary text-center px-10">
            Pagamento sendo processado
          </Text>
          <Text
            className="font-poppins text-sm text-center px-10"
            style={{ color: "#ABABAB" }}
          >
            Pode levar alguns minutos. Você pode voltar e verificar depois.
          </Text>
          <Pressable
            onPress={() => router.replace("/(app)/(manager)/(home)")}
            className="mt-4 rounded-xl bg-accent px-6 py-3"
          >
            <Text className="font-poppins-semibold text-sm text-white">
              Ir para o início
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
