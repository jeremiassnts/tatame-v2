import { BackButton } from "@/components/BackButton";
import { DatePickerField } from "@/components/DatePickerField";
import { FormInput } from "@/components/FormInput";
import { ModalSelect } from "@/components/ModalSelect";
import { PhoneInput } from "@/components/PhoneInput";
import { useAcademyContext } from "@/lib/academy-context";
import { ApiError } from "@/lib/api";
import { useAcademy } from "@/lib/hooks/use-academy";
import {
  useCreatePayoutAccount,
  type CreatePayoutAccountInput,
} from "@/lib/hooks/use-payout-account";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { zodResolver } from "@hookform/resolvers/zod";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { MaskedTextInput } from "react-native-mask-text";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

/**
 * Asaas subaccount registration.
 *
 * Every value here is typed by the manager and sent to Asaas verbatim; nothing
 * on this screen writes back to the academy or the user record. The prefills
 * are only a starting point — the Asaas e-mail becomes the subaccount login
 * and the name is checked against the document at the Receita, so both may
 * legitimately differ from what the academy shows to its students.
 */

const DOCUMENTS_ROUTE =
  "/(app)/(manager)/(finances)/payout-account/documents";

const COMPANY_TYPE_OPTIONS = [
  { value: "MEI", label: "MEI - Microempreendedor Individual" },
  { value: "LIMITED", label: "LTDA - Sociedade Limitada" },
  { value: "INDIVIDUAL", label: "EI - Empresário Individual" },
  { value: "ASSOCIATION", label: "Associação" },
];

const onlyDigits = (value: string) => value.replace(/\D/g, "");

/** CPF while there are 11 digits or fewer, CNPJ from the 12th on. */
function formatCpfCnpj(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

function formatPostalCode(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
}

/** The user row keeps a timestamp; the picker and Asaas both want a date. */
function toDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1]! : "";
}

const schema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome"),
    email: z.string().trim().email("E-mail inválido"),
    cpfCnpj: z.string(),
    mobilePhone: z.string(),
    /** Kept as the raw cents string the currency mask produces. */
    incomeValue: z.string().min(1, "Informe o faturamento mensal"),
    postalCode: z.string(),
    address: z.string().trim().min(1, "Informe a rua"),
    addressNumber: z.string().trim().min(1, "Informe o número"),
    complement: z.string(),
    province: z.string().trim().min(1, "Informe o bairro"),
    birthDate: z.string(),
    companyType: z.string(),
  })
  .superRefine((value, ctx) => {
    const document = onlyDigits(value.cpfCnpj);

    if (document.length !== 11 && document.length !== 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cpfCnpj"],
        message: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)",
      });
    }

    const phone = onlyDigits(value.mobilePhone);
    if (phone.length < 10 || phone.length > 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mobilePhone"],
        message: "Informe o celular com DDD",
      });
    }

    if (onlyDigits(value.postalCode).length !== 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postalCode"],
        message: "CEP deve ter 8 dígitos",
      });
    }

    if (Number(value.incomeValue) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["incomeValue"],
        message: "Informe o faturamento mensal",
      });
    }

    // Asaas splits the registration by person type: a CPF account needs a
    // birth date, a CNPJ account needs the company type.
    if (document.length === 14 && !value.companyType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["companyType"],
        message: "Informe o tipo de empresa",
      });
    }
    if (document.length !== 14 && !value.birthDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["birthDate"],
        message: "Informe a data de nascimento",
      });
    }
  });

type FormData = z.infer<typeof schema>;

type ViaCepResponse = {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  /** ViaCEP answers 200 with this set when the CEP does not exist. */
  erro?: boolean | string;
};

/**
 * A coded rejection puts the identifier in `message` and the sentence in
 * `detail`; an uncoded one repeats the sentence in both. The sentence is what
 * has to reach the manager verbatim — it names the field the Receita refused,
 * in Portuguese, and nothing invented here would be as specific.
 */
function toDisplayError(error: unknown): { message: string; code?: string } {
  if (!(error instanceof ApiError)) {
    return {
      message:
        "Não foi possível criar a conta de recebimento. Verifique sua conexão e tente novamente.",
    };
  }

  if (error.detail && error.detail !== error.message) {
    return { message: error.detail, code: error.message };
  }
  return { message: error.detail ?? error.message };
}

export default function PayoutAccountOnboardingScreen() {
  const { academyId } = useAcademyContext();
  const academyQuery = useAcademy(academyId);
  const userQuery = useCurrentUser();

  // The defaults are only read once, when the form mounts, so the form waits
  // for both sources instead of resetting over what the manager already typed.
  if (academyQuery.isPending || userQuery.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
        <View className="flex-row items-center px-6" style={{ paddingTop: 8 }}>
          <BackButton />
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#A078E8" />
        </View>
      </SafeAreaView>
    );
  }

  const academy = academyQuery.data;
  const user = userQuery.data;

  return (
    <PayoutAccountOnboardingForm
      defaults={{
        name: academy?.name ?? user?.name ?? "",
        email: academy?.contactEmail ?? user?.email ?? "",
        mobilePhone: onlyDigits(academy?.contactPhone ?? user?.phone ?? ""),
        birthDate: toDateOnly(user?.birthDate),
      }}
    />
  );
}

type Defaults = {
  name: string;
  email: string;
  mobilePhone: string;
  birthDate: string;
};

function PayoutAccountOnboardingForm({ defaults }: { defaults: Defaults }) {
  const router = useRouter();
  const createAccount = useCreatePayoutAccount();
  const [submitError, setSubmitError] = useState<{
    message: string;
    code?: string;
  } | null>(null);
  const [cepState, setCepState] = useState<{
    status: "idle" | "loading" | "error";
    city: string;
  }>({ status: "idle", city: "" });

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaults.name,
      email: defaults.email,
      cpfCnpj: "",
      mobilePhone: defaults.mobilePhone,
      incomeValue: "",
      postalCode: "",
      address: "",
      addressNumber: "",
      complement: "",
      province: "",
      birthDate: defaults.birthDate,
      companyType: "",
    },
  });

  const document = onlyDigits(watch("cpfCnpj"));
  const isCompany = document.length === 14;

  const lastLookup = useRef("");

  /**
   * ViaCEP fills street and neighbourhood — `academies.address` is free text
   * and cannot be split reliably, so it is never used as a source. The fields
   * stay editable: the lookup is a shortcut, not an authority.
   */
  const lookupPostalCode = useCallback(
    async (digits: string) => {
      if (digits.length !== 8 || lastLookup.current === digits) return;
      lastLookup.current = digits;
      setCepState({ status: "loading", city: "" });

      try {
        const response = await fetch(
          `https://viacep.com.br/ws/${digits}/json/`,
        );
        const data = (await response.json()) as ViaCepResponse;

        // ViaCEP answers 200 with `{ erro: true }` for an unknown CEP.
        if (!response.ok || data.erro === true || data.erro === "true") {
          setCepState({ status: "error", city: "" });
          return;
        }

        setCepState({
          status: "idle",
          city: [data.localidade, data.uf].filter(Boolean).join(" - "),
        });
        if (data.logradouro) {
          setValue("address", data.logradouro, { shouldValidate: true });
        }
        if (data.bairro) {
          setValue("province", data.bairro, { shouldValidate: true });
        }
      } catch {
        setCepState({ status: "error", city: "" });
      }
    },
    [setValue],
  );

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);

    const cpfCnpj = onlyDigits(data.cpfCnpj);
    const company = cpfCnpj.length === 14;
    const complement = data.complement.trim();

    const body: CreatePayoutAccountInput = {
      name: data.name.trim(),
      email: data.email.trim(),
      cpfCnpj,
      mobilePhone: onlyDigits(data.mobilePhone),
      // The currency mask yields cents; Asaas wants the monthly revenue in
      // reais, unlike every other amount in this codebase.
      incomeValue: Number(data.incomeValue) / 100,
      address: data.address.trim(),
      addressNumber: data.addressNumber.trim(),
      province: data.province.trim(),
      postalCode: onlyDigits(data.postalCode),
      ...(complement ? { complement } : {}),
      ...(company
        ? {
            companyType: data.companyType as NonNullable<
              CreatePayoutAccountInput["companyType"]
            >,
          }
        : { birthDate: data.birthDate }),
    };

    try {
      await createAccount.mutateAsync(body);
      router.replace(DOCUMENTS_ROUTE);
    } catch (error) {
      // 409 is not a failure the manager can fix by editing the form: the
      // academy already has an account, so the only useful move is forward.
      if (error instanceof ApiError && error.status === 409) {
        Alert.alert(
          "Conta já cadastrada",
          "Esta academia já possui uma conta de recebimento.",
          [{ text: "Continuar", onPress: () => router.replace(DOCUMENTS_ROUTE) }],
        );
        return;
      }
      // Everything typed stays where it is; only the banner changes.
      setSubmitError(toDisplayError(error));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-1" style={{ paddingHorizontal: 24, paddingTop: 8, gap: 24 }}>
        <View className="flex-row items-center justify-between">
          <BackButton />
          <Text className="font-poppins-bold text-lg text-primary">
            Conta de recebimento
          </Text>
          <View className="h-10 w-10" />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
          >
            <Text className="font-poppins text-xs text-muted" style={{ lineHeight: 18 }}>
              Estes dados abrem a conta que recebe os pagamentos dos alunos.
              Eles vão apenas para o processador de pagamento e não alteram o
              cadastro da academia.
            </Text>

            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={{ gap: 6 }}>
                  <FormInput
                    label="Nome ou razão social"
                    placeholder="Nome registrado na Receita Federal"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    error={errors.name?.message}
                  />
                  <Text
                    className="font-poppins text-[11px] text-muted"
                    style={{ lineHeight: 16 }}
                  >
                    O nome é conferido na Receita Federal junto com o CPF/CNPJ.
                    Se a academia usa nome fantasia, informe aqui a razão
                    social, senão o cadastro é recusado.
                  </Text>
                </View>
              )}
            />

            <Controller
              control={control}
              name="cpfCnpj"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormInput
                  label="CPF ou CNPJ"
                  placeholder="000.000.000-00"
                  value={formatCpfCnpj(value)}
                  onChangeText={(text) => onChange(onlyDigits(text).slice(0, 14))}
                  onBlur={onBlur}
                  keyboardType="number-pad"
                  maxLength={18}
                  error={errors.cpfCnpj?.message}
                />
              )}
            />

            {isCompany ? (
              <Controller
                control={control}
                name="companyType"
                render={({ field: { onChange, value } }) => (
                  <View style={{ gap: 6 }}>
                    <Text className="font-poppins-medium text-[13px] text-muted">
                      Tipo de empresa
                    </Text>
                    <ModalSelect
                      value={value}
                      onChange={onChange}
                      options={COMPANY_TYPE_OPTIONS}
                      placeholder="Selecionar tipo"
                    />
                    {errors.companyType?.message ? (
                      <Text className="font-poppins text-xs text-red-500">
                        {errors.companyType.message}
                      </Text>
                    ) : null}
                  </View>
                )}
              />
            ) : (
              <Controller
                control={control}
                name="birthDate"
                render={({ field: { onChange, value } }) => (
                  <DatePickerField
                    label="Data de nascimento"
                    value={value || null}
                    onChange={(date) => onChange(date ?? "")}
                    iconTrailing
                    error={errors.birthDate?.message}
                  />
                )}
              />
            )}

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={{ gap: 6 }}>
                  <FormInput
                    label="E-mail"
                    placeholder="financeiro@academia.com"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={errors.email?.message}
                  />
                  <Text
                    className="font-poppins text-[11px] text-muted"
                    style={{ lineHeight: 16 }}
                  >
                    Este e-mail será o acesso da conta de recebimento. Ele não
                    substitui o e-mail de contato que os alunos veem.
                  </Text>
                </View>
              )}
            />

            <Controller
              control={control}
              name="mobilePhone"
              render={({ field: { onChange, onBlur, value } }) => (
                <PhoneInput
                  label="Celular"
                  value={value}
                  onChangePhone={onChange}
                  onBlur={onBlur}
                  error={errors.mobilePhone?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="incomeValue"
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: 6 }}>
                  <Text className="font-poppins-medium text-[13px] text-muted">
                    Faturamento mensal (R$)
                  </Text>
                  <View
                    className={`h-[52px] flex-row items-center rounded-xl border bg-surface px-4 ${
                      errors.incomeValue ? "border-red-500" : "border-surface-border"
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
                  {errors.incomeValue?.message ? (
                    <Text className="font-poppins text-xs text-red-500">
                      {errors.incomeValue.message}
                    </Text>
                  ) : (
                    <Text className="font-poppins text-[11px] text-muted">
                      Faturamento médio da academia por mês.
                    </Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="postalCode"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={{ gap: 6 }}>
                  <FormInput
                    label="CEP"
                    placeholder="00000-000"
                    value={formatPostalCode(value)}
                    onChangeText={(text) => {
                      const digits = onlyDigits(text).slice(0, 8);
                      onChange(digits);
                      if (digits.length === 8) {
                        void lookupPostalCode(digits);
                      } else {
                        lastLookup.current = "";
                        setCepState({ status: "idle", city: "" });
                      }
                    }}
                    onBlur={onBlur}
                    keyboardType="number-pad"
                    maxLength={9}
                    error={errors.postalCode?.message}
                  />
                  {cepState.status === "loading" ? (
                    <Text className="font-poppins text-[11px] text-muted">
                      Buscando endereço...
                    </Text>
                  ) : null}
                  {cepState.status === "error" ? (
                    <Text className="font-poppins text-[11px] text-red-500">
                      CEP não encontrado. Preencha o endereço manualmente.
                    </Text>
                  ) : null}
                  {cepState.status === "idle" && cepState.city ? (
                    <Text className="font-poppins text-[11px] text-muted">
                      {cepState.city}
                    </Text>
                  ) : null}
                </View>
              )}
            />

            <Controller
              control={control}
              name="address"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormInput
                  label="Rua"
                  placeholder="Av. Paulista"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.address?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="addressNumber"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormInput
                  label="Número"
                  placeholder="123"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.addressNumber?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="complement"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormInput
                  label="Complemento (opcional)"
                  placeholder="Sala 2"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.complement?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="province"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormInput
                  label="Bairro"
                  placeholder="Bela Vista"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.province?.message}
                />
              )}
            />
          </ScrollView>
        </KeyboardAvoidingView>

        {submitError ? (
          <View
            className="rounded-xl border border-red-500 bg-surface"
            style={{ padding: 12, gap: 4 }}
          >
            <Text className="font-poppins text-xs text-red-500" style={{ lineHeight: 18 }}>
              {submitError.message}
            </Text>
            {submitError.code ? (
              <Text className="font-poppins text-[11px] text-muted">
                Código: {submitError.code}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ paddingBottom: 24 }}>
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={createAccount.isPending}
          >
            <View className="overflow-hidden rounded-xl">
              <LinearGradient
                colors={
                  createAccount.isPending
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
                {createAccount.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={20} color="#FFFFFF" />
                    <Text className="font-poppins-semibold text-base text-white">
                      Criar conta de recebimento
                    </Text>
                  </>
                )}
              </LinearGradient>
            </View>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
