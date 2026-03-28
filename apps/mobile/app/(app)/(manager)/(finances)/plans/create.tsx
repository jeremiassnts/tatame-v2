import { FormInput } from "@/components/FormInput";
import { ModalSelect } from "@/components/ModalSelect";
import { ApiError } from "@/lib/api";
import { useCreatePlan } from "@/lib/hooks/use-subscription-plans";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import {
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
    const priceText = data.priceCents.replace(",", ".");
    const cents = Math.round(parseFloat(priceText) * 100);

    if (isNaN(cents) || cents < 0) {
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
      const msg = e instanceof ApiError ? e.message : "Erro ao criar plano";
      Alert.alert("Erro", msg);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
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
              <FormInput
                label="Valor (R$)"
                placeholder="199,00"
                value={value}
                onChangeText={onChange}
                keyboardType="decimal-pad"
                error={errors.priceCents?.message}
              />
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

        <View style={{ paddingBottom: 24 }}>
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={createPlan.isPending}
            className="flex-row items-center justify-center rounded-xl"
            style={{ backgroundColor: "#A078E8", height: 56, gap: 8 }}
          >
            <Check size={20} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-base text-white">
              Salvar plano
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
