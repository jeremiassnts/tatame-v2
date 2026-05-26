import {
  useCreatePixCheckout,
  usePixPaymentStatus,
  type PixQrCodeResponse,
} from "@/lib/hooks/use-subscription";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, ChevronLeft, Copy, RefreshCw, Timer, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function GuardianPixPaymentScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    subscriptionId: string;
    dependentId: string;
    planName: string;
    priceCents: string;
  }>();

  const subscriptionId = params.subscriptionId;
  const dependentId = params.dependentId;
  const planName = params.planName ?? "";
  const priceCents = Number(params.priceCents ?? 0);

  const createPixCheckout = useCreatePixCheckout();
  const [pixData, setPixData] = useState<PixQrCodeResponse | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: paymentStatus } = usePixPaymentStatus(
    pixData?.pixQrCodeId ?? null,
  );

  useEffect(() => {
    if (paymentStatus === "PAID") {
      queryClient.invalidateQueries({ queryKey: ["subscription", dependentId] });
      queryClient.invalidateQueries({ queryKey: ["payments", dependentId] });
      Alert.alert(
        "Pagamento confirmado",
        "O pagamento via Pix foi processado com sucesso.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    }
  }, [paymentStatus, queryClient, router, dependentId]);

  const generateQrCode = useCallback(async () => {
    try {
      const result = await createPixCheckout.mutateAsync({ subscriptionId });
      setPixData(result);
      setCopied(false);

      const expiresAt = new Date(result.expiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setCountdown(remaining);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      Alert.alert("Erro", "Não foi possível gerar o QR Code. Tente novamente.");
    }
  }, [createPixCheckout, subscriptionId]);

  useEffect(() => {
    generateQrCode();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async () => {
    if (!pixData?.brCode) return;
    await Clipboard.setStringAsync(pixData.brCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const isExpired = countdown === 0 && pixData !== null;
  const isLoading = createPixCheckout.isPending && !pixData;

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
      <View
        className="flex-row items-center justify-between"
        style={{ height: 56, paddingHorizontal: 24 }}
      >
        <Pressable onPress={() => router.back()}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text className="font-poppins-semibold text-lg text-white">
          Pagamento Pix
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 24 }}
      >
        <View
          className="items-center rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 20, gap: 8 }}
        >
          <Text className="font-poppins text-sm" style={{ color: "#ABABAB" }}>
            Valor a pagar
          </Text>
          <Text className="font-poppins-bold text-white" style={{ fontSize: 28 }}>
            {formatCurrency(priceCents)}
          </Text>
          <Text className="font-poppins text-[13px]" style={{ color: "#ABABAB" }}>
            {planName} · mensal
          </Text>
        </View>

        <View
          className="items-center rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 24, gap: 20 }}
        >
          {isLoading ? (
            <View style={{ height: 260, justifyContent: "center" }}>
              <ActivityIndicator color="#A078E8" size="large" />
            </View>
          ) : (
            <>
              <Text className="font-poppins-medium text-sm text-white">
                Escaneie o QR Code para pagar
              </Text>

              <View
                className="items-center justify-center rounded-xl bg-white"
                style={{ width: 200, height: 200 }}
              >
                {pixData?.brCodeBase64 ? (
                  <Image
                    source={{ uri: pixData.brCodeBase64 }}
                    style={{ width: 180, height: 180 }}
                    resizeMode="contain"
                  />
                ) : (
                  <ActivityIndicator color="#000000" />
                )}
              </View>

              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Timer size={16} color="#ABABAB" />
                <Text className="font-poppins text-[13px]" style={{ color: "#ABABAB" }}>
                  Expira em
                </Text>
                <Text
                  className="font-poppins-semibold text-sm"
                  style={{ color: isExpired ? "#FF453A" : "#FF9500" }}
                >
                  {isExpired ? "Expirado" : formatCountdown(countdown)}
                </Text>
              </View>

              <View style={{ height: 1, width: "100%", backgroundColor: "#2A2A2A" }} />

              <View
                className="flex-row items-center justify-center"
                style={{ gap: 12, width: "100%" }}
              >
                <Text className="font-poppins text-[13px]" style={{ color: "#ABABAB" }}>
                  Ou copie o código Pix
                </Text>
                <TouchableOpacity
                  onPress={handleCopy}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    gap: 6,
                    backgroundColor: copied ? "#1B8C30" : "#6C63FF",
                  }}
                >
                  {copied ? <Check size={14} color="#FFFFFF" /> : <Copy size={14} color="#FFFFFF" />}
                  <Text className="font-poppins-semibold text-xs text-white">
                    {copied ? "Copiado!" : "Copiar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={{ gap: 12 }}>
          <Pressable
            onPress={generateQrCode}
            disabled={createPixCheckout.isPending}
            className="flex-row items-center justify-center rounded-xl"
            style={{ height: 48, gap: 8, backgroundColor: "#6C63FF" }}
          >
            {createPixCheckout.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <RefreshCw size={18} color="#FFFFFF" />
                <Text className="font-poppins-semibold text-[15px] text-white">
                  Gerar novo QR Code
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center justify-center rounded-xl border border-surface-border bg-surface"
            style={{ height: 48, gap: 8 }}
          >
            <X size={18} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-[15px] text-white">
              Cancelar
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
