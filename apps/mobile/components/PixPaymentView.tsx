import { FormInput } from "@/components/FormInput";
import { describeApiError } from "@/lib/api-error-message";
import { CPF_DIGITS, formatCpf, onlyDigits } from "@/lib/format/document";
import {
  currentReferenceMonth,
  parseAsaasDate,
  usePaidForMonth,
  useCreatePixCharge,
  type PixChargeResponse,
} from "@/lib/hooks/use-subscription";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { Check, ChevronLeft, Copy, RefreshCw, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
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

/**
 * The Pix screen for both rails that use it: a student paying their own plan,
 * and a guardian paying a dependent's. The two were byte-for-byte copies apart
 * from which id they passed and which cache key they invalidated, so every fix
 * had to be made twice; they are route shells around this now.
 *
 * The charge comes from `POST /payments/pix` (Asaas), which differs from the
 * AbacatePay one it replaced in three ways that are all visible here:
 * `encodedImage` is raw base64 rather than a data URI, `expirationDate` is not
 * ISO, and the QR is valid for about a year rather than minutes — so there is a
 * date to show, not a countdown to run.
 */

type Props = {
  title: string;
  subscriptionId: string;
  planName: string;
  priceCents: number;
  /** Set when a guardian is paying for a dependent. */
  dependentId?: string;
};

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function formatExpiry(raw: string): string | null {
  const date = parseAsaasDate(raw);
  if (!date) return null;
  return date.toLocaleDateString("pt-BR");
}

export function PixPaymentView({
  title,
  subscriptionId,
  planName,
  priceCents,
  dependentId,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const createCharge = useCreatePixCharge();
  const [charge, setCharge] = useState<PixChargeResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [document, setDocument] = useState("");
  const [documentError, setDocumentError] = useState<string | null>(null);

  const { data: me } = useCurrentUser();
  // Asked up front rather than after a `CPF_REQUIRED` 400, and only of a
  // student who has no Asaas customer yet — `ensureCustomer` returns early once
  // there is one and discards whatever was sent, so asking every month would be
  // friction for a value nobody reads.
  const needsDocument = me?.documentRequired ?? false;

  const referenceMonth = currentReferenceMonth();
  const paid = usePaidForMonth(subscriptionId, referenceMonth, {
    dependentId,
    enabled: charge !== null,
  });

  useEffect(() => {
    if (!paid) return;
    queryClient.invalidateQueries({
      queryKey: dependentId ? ["subscription", dependentId] : ["subscription", "me"],
    });
    queryClient.invalidateQueries({
      queryKey: dependentId ? ["payments", dependentId] : ["payments", "me"],
    });
    Alert.alert(
      "Pagamento confirmado",
      "Seu pagamento via Pix foi processado com sucesso.",
      [{ text: "OK", onPress: () => router.back() }],
    );
  }, [paid, queryClient, router, dependentId]);

  const generate = useCallback(async () => {
    const digits = onlyDigits(document);
    if (needsDocument && digits.length !== CPF_DIGITS) {
      setDocumentError("Informe um CPF (11 dígitos)");
      return;
    }
    setDocumentError(null);

    try {
      const result = await createCharge.mutateAsync({
        subscriptionId,
        cpfCnpj: digits || undefined,
      });
      setCharge(result);
      setCopied(false);
      // The customer now exists at Asaas, so the field must not come back on
      // the next charge.
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    } catch (error) {
      Alert.alert(
        "Erro",
        describeApiError(
          error,
          "Não foi possível gerar o QR Code. Tente novamente.",
        ),
      );
    }
  }, [createCharge, subscriptionId, document, needsDocument, queryClient]);

  // The student who already has a customer never sees a form, so the charge is
  // opened straight away. The one who does not has to type a CPF first.
  useEffect(() => {
    if (me === undefined || charge || createCharge.isPending) return;
    if (needsDocument) return;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const handleCopy = async () => {
    if (!charge?.payload) return;
    await Clipboard.setStringAsync(charge.payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const expiry = charge ? formatExpiry(charge.expirationDate) : null;

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
      <View
        className="flex-row items-center justify-between"
        style={{ height: 56, paddingHorizontal: 24 }}
      >
        <Pressable onPress={() => router.back()}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text className="font-poppins-semibold text-lg text-white">{title}</Text>
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

        {needsDocument && !charge ? (
          <View
            className="rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 20, gap: 12 }}
          >
            <Text className="font-poppins text-[13px]" style={{ color: "#ABABAB" }}>
              O banco exige seu CPF para emitir a cobrança. Pedimos só desta vez.
            </Text>
            <FormInput
              label="CPF"
              placeholder="000.000.000-00"
              value={formatCpf(onlyDigits(document))}
              onChangeText={(text) =>
                setDocument(onlyDigits(text).slice(0, CPF_DIGITS))
              }
              keyboardType="number-pad"
              error={documentError ?? undefined}
            />
          </View>
        ) : null}

        {charge || createCharge.isPending ? (
          <View
            className="items-center rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 24, gap: 20 }}
          >
            {!charge ? (
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
                  <Image
                    // Asaas sends the PNG bytes, not a data URI. Without the
                    // prefix the QR simply does not render.
                    source={{ uri: `data:image/png;base64,${charge.encodedImage}` }}
                    style={{ width: 180, height: 180 }}
                    resizeMode="contain"
                  />
                </View>

                {expiry ? (
                  <Text
                    className="font-poppins text-[13px]"
                    style={{ color: "#ABABAB" }}
                  >
                    Válido até {expiry}
                  </Text>
                ) : null}

                <View
                  style={{ height: 1, width: "100%", backgroundColor: "#2A2A2A" }}
                />

                <View
                  className="flex-row items-center justify-center"
                  style={{ gap: 12, width: "100%" }}
                >
                  <Text
                    className="font-poppins text-[13px]"
                    style={{ color: "#ABABAB" }}
                  >
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
                    {copied ? (
                      <Check size={14} color="#FFFFFF" />
                    ) : (
                      <Copy size={14} color="#FFFFFF" />
                    )}
                    <Text className="font-poppins-semibold text-xs text-white">
                      {copied ? "Copiado!" : "Copiar"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          <Pressable
            onPress={generate}
            disabled={createCharge.isPending}
            className="flex-row items-center justify-center rounded-xl"
            style={{ height: 48, gap: 8, backgroundColor: "#6C63FF" }}
          >
            {createCharge.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <RefreshCw size={18} color="#FFFFFF" />
                <Text className="font-poppins-semibold text-[15px] text-white">
                  {charge ? "Gerar novo QR Code" : "Gerar QR Code"}
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
