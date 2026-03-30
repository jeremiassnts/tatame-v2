import { FormInput } from "@/components/FormInput";
import { ModalSelect } from "@/components/ModalSelect";
import { ApiError } from "@/lib/api";
import { useAcademySubscriptions } from "@/lib/hooks/use-academy-subscriptions";
import { useConfirmPayment, usePaymentHistory } from "@/lib/hooks/use-finances";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

const schema = z.object({
  subscriptionId: z.string().min(1, "Selecione um aluno"),
  amountCents: z.string().min(1, "Valor é obrigatório"),
  referenceMonth: z.string().min(1, "Selecione o mês"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function getRecentMonths(): { value: string; label: string }[] {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const label = d
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      .replace(/^./, (c) => c.toUpperCase());
    months.push({ value, label });
  }
  return months;
}

export default function ConfirmPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subscriptionId?: string }>();
  const confirmPayment = useConfirmPayment();

  const { data: subscriptions } = useAcademySubscriptions({
    status: "active",
  });

  const studentOptions = useMemo(() => {
    return (subscriptions ?? []).map((s) => ({
      value: s.subscription.id,
      label: `${s.user.name} — ${s.plan.name}`,
    }));
  }, [subscriptions]);

  const monthOptions = useMemo(() => getRecentMonths(), []);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      subscriptionId: params.subscriptionId ?? "",
      amountCents: "",
      referenceMonth: getCurrentMonth(),
      notes: "",
    },
  });

  const selectedSubId = watch("subscriptionId");
  const amountText = watch("amountCents");
  const selectedMonth = watch("referenceMonth");

  const { data: existingPayments, isPending: paymentsPending } = usePaymentHistory({
    subscriptionId: selectedSubId,
    enabled: Boolean(selectedSubId?.trim()),
  });

  const hasStudentSelected = Boolean(selectedSubId?.trim());
  const hasAmountFilled = Boolean(amountText?.trim());
  const canSubmit = hasStudentSelected && hasAmountFilled;

  const monthAlreadyPaid = useMemo(() => {
    if (!hasStudentSelected) return false;
    if (!selectedMonth) return false;
    if (!existingPayments) return false;
    return existingPayments.some((p) => p.referenceMonth === selectedMonth);
  }, [existingPayments, hasStudentSelected, selectedMonth]);

  useEffect(() => {
    if (selectedSubId && subscriptions) {
      const match = subscriptions.find(
        (s) => s.subscription.id === selectedSubId,
      );
      if (match) {
        const formatted = (match.plan.priceCents / 100)
          .toFixed(2)
          .replace(".", ",");
        setValue("amountCents", formatted);
      }
    }
  }, [selectedSubId, subscriptions, setValue]);

  const onSubmit = async (data: FormData) => {
    const priceText = data.amountCents.replace(",", ".");
    const cents = Math.round(parseFloat(priceText) * 100);

    if (isNaN(cents) || cents < 0) {
      Alert.alert("Erro", "Valor inválido");
      return;
    }

    try {
      await confirmPayment.mutateAsync({
        subscriptionId: data.subscriptionId,
        amountCents: cents,
        referenceMonth: data.referenceMonth,
        notes: data.notes || null,
      });
      Alert.alert("Sucesso", "Pagamento confirmado com sucesso!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Erro ao confirmar pagamento";
      Alert.alert("Erro", msg);
    }
  };

  const isPreselected = !!params.subscriptionId;
  const submitDisabled =
    !canSubmit || confirmPayment.isPending || paymentsPending || monthAlreadyPaid;

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 24 }}>
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">
            Confirmar pagamento
          </Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 16 }}
        >
          <Controller
            control={control}
            name="subscriptionId"
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 6 }}>
                <Text className="font-poppins-medium text-[13px] text-muted">
                  Aluno
                </Text>
                <ModalSelect
                  value={value}
                  onChange={onChange}
                  options={studentOptions}
                  placeholder="Selecionar aluno"
                  disabled={isPreselected}
                />
                {errors.subscriptionId?.message && (
                  <Text className="font-poppins text-xs text-red-500">
                    {errors.subscriptionId.message}
                  </Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="amountCents"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Valor (R$)"
                placeholder="199,00"
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
                error={errors.amountCents?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="referenceMonth"
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 6 }}>
                <Text className="font-poppins-medium text-[13px] text-muted">
                  Mês de referência
                </Text>
                <ModalSelect
                  value={value}
                  onChange={onChange}
                  options={monthOptions}
                />
              </View>
            )}
          />

          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Observações"
                placeholder="Opcional"
                value={value ?? ""}
                onChangeText={onChange}
                multiline
              />
            )}
          />
        </ScrollView>

        <View style={{ paddingBottom: 24 }}>
          {monthAlreadyPaid ? (
            <Text
              className="mb-3 font-poppins text-[13px]"
              style={{ color: "#FFD60A" }}
            >
              Este mês já está pago para esta assinatura.
            </Text>
          ) : null}
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={submitDisabled}
            className="flex-row items-center justify-center rounded-xl"
            style={{
              backgroundColor: submitDisabled ? "#3A3A3A" : "#A078E8",
              height: 56,
              gap: 8,
            }}
          >
            {confirmPayment.isPending ? (
              <ActivityIndicator
                color={submitDisabled ? "#8A8A8A" : "#FFFFFF"}
              />
            ) : (
              <Check size={20} color={submitDisabled ? "#8A8A8A" : "#FFFFFF"} />
            )}
            <Text
              className="font-poppins-semibold text-base"
              style={{ color: submitDisabled ? "#8A8A8A" : "#FFFFFF" }}
            >
              Confirmar pagamento
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
