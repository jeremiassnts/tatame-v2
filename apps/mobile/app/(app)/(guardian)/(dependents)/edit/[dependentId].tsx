import { DatePickerField } from "@/components/DatePickerField";
import { FormInput } from "@/components/FormInput";
import { ModalSelect } from "@/components/ModalSelect";
import { BELT_LABELS_SHORT, BELT_COLORS, KIDS_BELTS } from "@/lib/belts";
import type { Belt } from "@/lib/belts";
import { useDependent, useUpdateDependent } from "@/lib/hooks/use-dependents";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Lock, Save } from "lucide-react-native";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

const BELT_OPTIONS: Array<{ value: Belt; label: string }> = KIDS_BELTS.map(
  (b) => ({ value: b, label: BELT_LABELS_SHORT[b] }),
);

const STRIPES_OPTIONS = [
  { value: "0", label: "0 graus" },
  { value: "1", label: "1 grau" },
  { value: "2", label: "2 graus" },
  { value: "3", label: "3 graus" },
  { value: "4", label: "4 graus" },
];

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  birthDate: z.string().min(1, "Data de nascimento é obrigatória"),
});

type FormData = z.infer<typeof schema>;

export default function EditDependentScreen() {
  const { dependentId } = useLocalSearchParams<{ dependentId: string }>();
  const router = useRouter();
  const { data: dependent, isPending: loadingDependent } = useDependent(dependentId ?? null);
  const updateDependent = useUpdateDependent();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      birthDate: "",
    },
  });

  useEffect(() => {
    if (dependent) {
      reset({
        name: dependent.name,
        birthDate: dependent.birthDate,
      });
    }
  }, [dependent, reset]);

  const onSubmit = async (data: FormData) => {
    if (!dependentId) return;
    try {
      await updateDependent.mutateAsync({
        id: dependentId,
        name: data.name,
        birthDate: data.birthDate,
      });
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar dependente";
      Alert.alert("Erro", msg);
    }
  };

  if (loadingDependent || !dependent) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const belt = dependent.belt as Belt;
  const beltColor = BELT_COLORS[belt] ?? "#525252";
  const beltLabel = BELT_LABELS_SHORT[belt] ?? dependent.belt;
  const stripesLabel = STRIPES_OPTIONS.find(
    (s) => s.value === String(dependent.stripes),
  )?.label ?? `${dependent.stripes} graus`;

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 24 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <ArrowLeft size={18} color="#FFFFFF" />
          </Pressable>
          <Text className="font-poppins-bold text-lg text-primary">Editar Dependente</Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 16 }}
        >
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <FormInput
                label="Nome"
                placeholder="Nome completo"
                value={value}
                onChangeText={onChange}
                error={errors.name?.message}
                autoCapitalize="words"
              />
            )}
          />

          <Controller
            control={control}
            name="birthDate"
            render={({ field: { onChange, value } }) => (
              <DatePickerField
                label="Data de nascimento"
                value={value || null}
                onChange={(v) => onChange(v ?? "")}
                error={errors.birthDate?.message}
              />
            )}
          />

          {/* Belt field — locked, read-only */}
          <View style={{ gap: 6 }}>
            <Text className="font-poppins-medium text-[13px] text-muted">Faixa atual</Text>
            <View
              className="h-[52px] flex-row items-center justify-between rounded-xl border border-surface-border bg-surface px-4 opacity-60"
            >
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <View
                  className="rounded-full"
                  style={{ width: 10, height: 10, backgroundColor: beltColor }}
                />
                <Text className="font-poppins text-[15px] text-primary">
                  {beltLabel}
                  {dependent.stripes > 0 ? ` · ${stripesLabel}` : ""}
                </Text>
              </View>
              <Lock size={16} color="#525252" />
            </View>
            <Text className="font-poppins text-xs text-muted">
              Alterações de faixa são feitas pelo manager
            </Text>
          </View>
        </ScrollView>

        <View style={{ paddingBottom: 24 }}>
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={updateDependent.isPending}
            className="flex-row items-center justify-center gap-2 rounded-xl"
            style={{
              height: 52,
              backgroundColor: updateDependent.isPending ? "#3A3A3A" : "#A078E8",
            }}
          >
            {updateDependent.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Save size={18} color="#FFFFFF" />
                <Text className="font-poppins-semibold text-base text-white">Salvar</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
