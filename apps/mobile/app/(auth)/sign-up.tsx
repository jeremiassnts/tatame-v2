import { BackButton } from "@/components/BackButton";
import { Divider } from "@/components/Divider";
import { FormInput } from "@/components/FormInput";
import { SocialButtons } from "@/components/SocialButtons";
import { useStartSSO } from "@/lib/hooks/use-start-sso";
import { useSignUp } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ClerkError = {
  errors?: Array<{
    code?: string;
    longMessage?: string;
    meta?: { paramName?: string };
  }>;
};

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useSignUp();
  const { handleSSO } = useStartSSO();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!signUp) return;
    setErrors({});
    setLoading(true);
    try {
      console.log("[sign-up] creating account…", { email, name });
      const result = await signUp.create({
        emailAddress: email,
        password,
        firstName: name,
      });
      console.log("[sign-up] create result:", JSON.stringify(result, null, 2));
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      console.log("[sign-up] verification email sent");
      router.push({ pathname: "/(auth)/verify-email", params: { email } });
    } catch (error) {
      console.log("[sign-up] error:", JSON.stringify(error, null, 2));
      const err = error as ClerkError;
      if (err.errors?.length) {
        const mapped: Record<string, string> = {};
        for (const e of err.errors) {
          console.log("[sign-up] clerk error detail:", JSON.stringify(e, null, 2));
          if (e.meta?.paramName === "email_address") mapped.email = e.longMessage ?? "";
          else if (e.meta?.paramName === "password") mapped.password = e.longMessage ?? "";
          else if (e.meta?.paramName === "first_name") mapped.name = e.longMessage ?? "";
          else if (e.code === "too_many_requests")
            mapped.general = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
          else mapped.general = e.longMessage ?? "Não foi possível criar a conta.";
        }
        setErrors(mapped);
      } else {
        Alert.alert("Erro", "Não foi possível criar a conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top", "bottom"]}>
      <View className="flex-1 gap-7 px-6 pt-2">
        <BackButton />

        <View className="gap-2">
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 28, letterSpacing: -1 }}
          >
            Criar conta
          </Text>
          <Text className="font-poppins text-[15px] text-[#525252]">
            Preencha seus dados para começar
          </Text>
        </View>

        <View className="gap-4">
          <FormInput
            label="Nome completo"
            placeholder="Digite seu nome"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            error={errors.name}
          />
          <FormInput
            label="E-mail"
            placeholder="seu@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <FormInput
            label="Senha"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
          />
        </View>

        {errors.general ? (
          <Text className="font-poppins text-sm text-red-500">{errors.general}</Text>
        ) : null}

        <View className="flex-1" />

        <View className="gap-4 pb-2">
          <Pressable
            onPress={handleSignUp}
            disabled={loading}
            className="h-14 items-center justify-center rounded-xl bg-accent"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-poppins-semibold text-base text-white">Criar conta</Text>
            )}
          </Pressable>

          <Divider />

          <SocialButtons
            onGooglePress={() => handleSSO("oauth_google")}
            onApplePress={() => handleSSO("oauth_apple")}
            disabled={loading}
          />

          <View className="flex-row items-center justify-center gap-1 py-2">
            <Text className="font-poppins text-sm text-muted">Já tem uma conta?</Text>
            <Pressable onPress={() => router.replace("/(auth)/sign-in")}>
              <Text className="font-poppins-semibold text-sm text-accent">Entrar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
