import { DatePickerField } from "@/components/DatePickerField";
import { FormInput } from "@/components/FormInput";
import { ModalSelect } from "@/components/ModalSelect";
import { BELT_LABELS_SHORT, KIDS_BELTS } from "@/lib/belts";
import type { Belt } from "@/lib/belts";
import { useCreateDependent } from "@/lib/hooks/use-dependents";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { ArrowLeft, UserPlus } from "lucide-react-native";
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
  belt: z.string().min(1, "Faixa é obrigatória"),
  stripes: z.string(),
});

type FormData = z.infer<typeof schema>;

export default function CreateDependentScreen() {
  const router = useRouter();
  const createDependent = useCreateDependent();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      birthDate: "",
      belt: "",
      stripes: "0",
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await createDependent.mutateAsync({
        name: data.name,
        birthDate: data.birthDate,
        belt: data.belt,
        stripes: parseInt(data.stripes, 10),
      });
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao cadastrar dependente";
      Alert.alert("Erro", msg);
    }
  };

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
          <Text className="font-poppins-bold text-lg text-primary">Novo Dependente</Text>
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

          <Controller
            control={control}
            name="belt"
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 6 }}>
                <Text className="font-poppins-medium text-[13px] text-muted">Faixa atual</Text>
                <ModalSelect
                  value={value}
                  onChange={onChange}
                  options={BELT_OPTIONS}
                  placeholder="Selecionar faixa"
                />
                {errors.belt?.message ? (
                  <Text className="font-poppins text-xs text-red-500">
                    {errors.belt.message}
                  </Text>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="stripes"
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: 6 }}>
                <Text className="font-poppins-medium text-[13px] text-muted">Graus</Text>
                <ModalSelect
                  value={value}
                  onChange={onChange}
                  options={STRIPES_OPTIONS}
                />
              </View>
            )}
          />
        </ScrollView>

        <View style={{ paddingBottom: 24 }}>
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={createDependent.isPending}
            className="flex-row items-center justify-center gap-2 rounded-xl"
            style={{ height: 52, backgroundColor: createDependent.isPending ? "#3A3A3A" : "#A078E8" }}
          >
            {createDependent.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <UserPlus size={18} color="#FFFFFF" />
                <Text className="font-poppins-semibold text-base text-white">
                  Cadastrar dependente
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
