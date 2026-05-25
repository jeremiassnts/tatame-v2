import { DatePickerField } from "@/components/DatePickerField";
import { FormInput } from "@/components/FormInput";
import { GradientButton } from "@/components/GradientButton";
import { ModalSelect } from "@/components/ModalSelect";
import { useCreateDependent } from "@/lib/hooks/use-dependents";
import { useRouter } from "expo-router";
import { Check, Users } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Belt = "white" | "blue" | "purple" | "brown" | "black";

const BELT_OPTIONS: { value: Belt; label: string }[] = [
  { value: "white", label: "Branca" },
  { value: "blue", label: "Azul" },
  { value: "purple", label: "Roxa" },
  { value: "brown", label: "Marrom" },
  { value: "black", label: "Preta" },
];

type FormState = {
  name: string;
  birthDate: string | null;
  belt: string;
};

type FormErrors = {
  name?: string;
  birthDate?: string;
  belt?: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  birthDate: null,
  belt: "",
};

export default function RegisterDependentScreen() {
  const router = useRouter();
  const createDependent = useCreateDependent();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [succeeded, setSucceeded] = useState(false);

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = "Nome é obrigatório";
    if (!form.birthDate) next.birthDate = "Data de nascimento é obrigatória";
    if (!form.belt) next.belt = "Faixa é obrigatória";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    createDependent.mutate(
      {
        name: form.name.trim(),
        birthDate: form.birthDate!,
        belt: form.belt,
        stripes: 0,
      },
      {
        onSuccess: () => {
          setSucceeded(true);
        },
        onError: () => {
          Alert.alert("Erro", "Não foi possível cadastrar o dependente. Tente novamente.");
        },
      },
    );
  };

  const handleAddAnother = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setSucceeded(false);
  };

  const handleContinue = () => {
    router.replace("/(app)/(guardian)/(home)");
  };

  if (succeeded) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center px-6 gap-6">
          {/* Success icon */}
          <View className="h-20 w-20 items-center justify-center rounded-full bg-accent-translucent">
            <Check size={36} color="#A078E8" />
          </View>

          <View className="items-center gap-2">
            <Text
              className="font-poppins-bold text-primary text-center"
              style={{ fontSize: 22, letterSpacing: -0.5 }}
            >
              Dependente cadastrado!
            </Text>
            <Text className="font-poppins text-[15px] leading-5 text-muted text-center">
              {form.name.trim() || "Dependente"} foi adicionado com sucesso.
            </Text>
          </View>
        </View>

        <View className="px-6 pb-6 gap-3">
          <GradientButton
            label="Continuar"
            onPress={handleContinue}
          />
          <Pressable
            onPress={handleAddAnother}
            className="h-[40px] items-center justify-center rounded-xl border border-surface-border"
          >
            <Text className="font-poppins-semibold text-[15px] text-primary">
              Adicionar outro
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center pt-10 pb-8 gap-4">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-accent-translucent">
            <Users size={36} color="#A078E8" />
          </View>
          <View className="items-center gap-2">
            <Text
              className="font-poppins-bold text-primary text-center"
              style={{ fontSize: 26, letterSpacing: -0.8 }}
            >
              Cadastre seu dependente
            </Text>
            <Text className="font-poppins text-[15px] leading-5 text-muted text-center">
              Para continuar, cadastre pelo menos um dependente
            </Text>
          </View>
        </View>

        {/* Form */}
        <View className="gap-4">
          <FormInput
            label="Nome"
            placeholder="Nome do dependente"
            value={form.name}
            onChangeText={(text) => {
              setForm((f) => ({ ...f, name: text }));
              if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
            }}
            error={errors.name}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <View className="gap-1.5">
            <Text className="font-poppins-medium text-[13px] text-muted">
              Data de nascimento
            </Text>
            <DatePickerField
              label=""
              value={form.birthDate}
              onChange={(date) => {
                setForm((f) => ({ ...f, birthDate: date }));
                if (errors.birthDate) setErrors((e) => ({ ...e, birthDate: undefined }));
              }}
              error={errors.birthDate}
            />
          </View>

          <View className="gap-1.5">
            <Text className="font-poppins-medium text-[13px] text-muted">
              Faixa atual
            </Text>
            <ModalSelect
              value={form.belt}
              onChange={(value) => {
                setForm((f) => ({ ...f, belt: value }));
                if (errors.belt) setErrors((e) => ({ ...e, belt: undefined }));
              }}
              options={BELT_OPTIONS}
              placeholder="Selecione a faixa"
            />
            {errors.belt ? (
              <Text className="font-poppins text-xs text-red-500">{errors.belt}</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* CTA */}
      <View className="px-6 pb-6">
        <GradientButton
          label="Cadastrar dependente"
          onPress={handleSubmit}
          loading={createDependent.isPending}
          disabled={createDependent.isPending}
        />
      </View>
    </SafeAreaView>
  );
}
