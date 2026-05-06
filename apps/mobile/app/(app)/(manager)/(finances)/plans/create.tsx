import { FormInput } from "@/components/FormInput";
import { ModalSelect } from "@/components/ModalSelect";
import { PlanLimitModal, PLAN_LIMIT_MESSAGES } from "@/components/PlanLimitModal";
import { ApiError } from "@/lib/api";
import { useCreatePlan } from "@/lib/hooks/use-subscription-plans";
import { useManagerSubscription } from "@/lib/hooks/use-manager-subscription";
import { zodResolver } from "@hookform/resolvers/zod";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { MaskedTextInput } from "react-native-mask-text";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  priceCents: z.string().min(1, "Valor é obrigatório"),
  recurrenceMonths: z.string(),
  weeklyCheckinLimit: z.string().optional(),
  unlimited: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const RECURRENCE_OPTIONS = [
  { value: "1", label: "1 mês" },
  { value: "3", label: "3 meses" },
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
];

export default function CreatePlanScreen() {
  const router = useRouter();
  const createPlan = useCreatePlan();
  const { data: managerSub } = useManagerSubscription();
  const isFree = managerSub?.plan === "free";
  const [limitModal, setLimitModal] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: "",
  });

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      priceCents: "",
      recurrenceMonths: "1",
      weeklyCheckinLimit: "",
      unlimited: false,
    },
  });

  const isUnlimited = watch("unlimited");

  const onSubmit = async (data: FormData) => {
    const cents = parseInt(data.priceCents, 10);

    if (isNaN(cents) || cents <= 0) {
      Alert.alert("Erro", "Valor inválido");
      return;
    }

    try {
      await createPlan.mutateAsync({
        name: data.name,
        priceCents: cents,
        recurrenceMonths: parseInt(data.recurrenceMonths, 10) as 1 | 3 | 6 | 12,
        weeklyCheckinLimit: data.unlimited
          ? null
          : parseInt(data.weeklyCheckinLimit || "0", 10) || null,
      });
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        const msg = PLAN_LIMIT_MESSAGES[e.message];
        if (msg) {
          setLimitModal({ visible: true, message: msg });
          return;
        }
      }
      const msg = e instanceof ApiError ? e.message : "Erro ao criar plano";
      Alert.alert("Erro", msg);
    }
  };

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
            Novo plano
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
            name="name"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Nome do plano"
                placeholder="Plano Gold"
                value={value}
                onChangeText={onChange}
                error={errors.name?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="priceCents"
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 6 }}>
                <Text className="font-poppins-medium text-[13px] text-muted">
                  Valor (R$)
                </Text>
                <View
                  className={`h-[52px] flex-row items-center rounded-xl border bg-surface px-4 ${
                    errors.priceCents ? "border-red-500" : "border-surface-border"
                  }`}
                >
                  <MaskedTextInput
                    type="currency"
                    options={{
                      prefix: "R$ ",
                      decimalSeparator: ",",
                      groupSeparator: ".",
                      precision: 2,
                    }}
                    keyboardType="numeric"
                    placeholder="R$ 0,00"
                    placeholderTextColor="#525252"
                    value={value}
                    onChangeText={(_formatted, rawValue) => {
                      onChange(rawValue);
                    }}
                    style={{
                      flex: 1,
                      fontFamily: "Poppins_400Regular",
                      fontSize: 15,
                      color: "#FFFFFF",
                    }}
                  />
                </View>
                {errors.priceCents?.message ? (
                  <Text className="font-poppins text-xs text-red-500">
                    {errors.priceCents.message}
                  </Text>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="recurrenceMonths"
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 6 }}>
                <Text className="font-poppins-medium text-[13px] text-muted">
                  Recorrência (meses)
                </Text>
                <ModalSelect
                  value={value}
                  onChange={onChange}
                  options={RECURRENCE_OPTIONS}
                />
              </View>
            )}
          />

          <View style={{ gap: 6 }}>
            <Text className="font-poppins-medium text-[13px] text-muted">
              Check-ins por semana
            </Text>
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="weeklyCheckinLimit"
                  render={({ field: { onChange, value } }) => (
                    <FormInput
                      label=""
                      placeholder="5"
                      value={isUnlimited ? "" : value ?? ""}
                      onChangeText={onChange}
                      keyboardType="number-pad"
                      editable={!isUnlimited}
                    />
                  )}
                />
              </View>
              <Controller
                control={control}
                name="unlimited"
                render={({ field: { onChange, value } }) => (
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <Switch
                      value={value}
                      onValueChange={onChange}
                      trackColor={{ false: "#2A2A2A", true: "#A078E8" }}
                      thumbColor="#FFFFFF"
                    />
                    <Text className="font-poppins text-xs text-muted">
                      Ilimitado
                    </Text>
                  </View>
                )}
              />
            </View>
          </View>
        </ScrollView>

        {!isFree && (
          <View
            className="rounded-xl border border-surface-border bg-surface"
            style={{ padding: 12, gap: 4 }}
          >
            <Text className="font-poppins-medium text-xs text-muted">
              ℹ️ Taxas de pagamento
            </Text>
            <Text className="font-poppins text-[11px] text-muted" style={{ lineHeight: 16 }}>
              Pagamentos via cartão possuem uma taxa de 3,99% + R$0,39 por transação,
              cobrada pela plataforma de pagamento (Stripe). Essa taxa não é do Tatame —
              cobramos apenas a mensalidade da assinatura.
            </Text>
          </View>
        )}

        <View style={{ paddingBottom: 24 }}>
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={createPlan.isPending}
          >
            <View className="overflow-hidden rounded-xl">
              <LinearGradient
                colors={
                  createPlan.isPending
                    ? ["#3A3A3A", "#3A3A3A"]
                    : ["#A078E8", "#7C5CBF"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  height: 40,
                }}
              >
                {createPlan.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={20} color="#FFFFFF" />
                    <Text className="font-poppins-semibold text-base text-white">
                      Salvar plano
                    </Text>
                  </>
                )}
              </LinearGradient>
            </View>
          </Pressable>
        </View>
      </View>
      <PlanLimitModal
        visible={limitModal.visible}
        onClose={() => setLimitModal({ visible: false, message: "" })}
        message={limitModal.message}
      />
    </SafeAreaView>
  );
}
