import { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSignIn } from "@clerk/clerk-expo";
import { BackButton } from "@/components/BackButton";
import { FormInput } from "@/components/FormInput";
import { Divider } from "@/components/Divider";
import { SocialButtons } from "@/components/SocialButtons";
import { useAuthComplete } from "@/lib/hooks/use-auth-complete";
import { useStartSSO } from "@/lib/hooks/use-start-sso";

type ClerkError = {
  errors?: Array<{
    code?: string;
    longMessage?: string;
  }>;
};

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, setActive } = useSignIn();
  const { completeAuth } = useAuthComplete();
  const { handleSSO } = useStartSSO();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!signIn) return;
    setErrors({});
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        try {
          await completeAuth({
            createdSessionId: result.createdSessionId,
            setActive,
          });
        } catch {
          setErrors({ general: "Não foi possível sincronizar. Tente novamente." });
        }
      }
    } catch (error) {
      const err = error as ClerkError;
      if (err.errors?.length) {
        const mapped: Record<string, string> = {};
        for (const e of err.errors) {
          if (
            e.code === "form_identifier_not_found" ||
            e.code === "form_password_incorrect"
          ) {
            mapped.general = "E-mail ou senha incorretos";
          } else {
            mapped.general = e.longMessage ?? "Nao foi possivel entrar.";
          }
        }
        setErrors(mapped);
      } else {
        Alert.alert("Erro", "Nao foi possivel entrar. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-7 px-6 pt-2">
        <BackButton />

        <View className="gap-2">
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 28, letterSpacing: -1 }}
          >
            Bem-vindo de volta
          </Text>
          <Text className="font-poppins text-[15px] text-[#525252]">
            Entre com sua conta para continuar
          </Text>
        </View>

        <View className="gap-4">
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
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
          />
          <View className="flex-row justify-end">
            <Pressable>
              <Text className="font-poppins-medium text-[13px] text-accent">
                Esqueceu a senha?
              </Text>
            </Pressable>
          </View>
        </View>

        {errors.general ? (
          <Text className="font-poppins text-sm text-red-500">{errors.general}</Text>
        ) : null}

        <View className="flex-1" />

        <View className="gap-4 pb-2">
          <Pressable
            onPress={handleSignIn}
            disabled={loading}
            className="h-14 items-center justify-center rounded-xl bg-accent"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-poppins-semibold text-base text-white">Entrar</Text>
            )}
          </Pressable>

          <Divider />

          <SocialButtons
            onGooglePress={() => handleSSO("oauth_google")}
            onApplePress={() => handleSSO("oauth_apple")}
            disabled={loading}
          />

          <View className="flex-row items-center justify-center gap-1 py-2">
            <Text className="font-poppins text-sm text-muted">Nao tem uma conta?</Text>
            <Pressable onPress={() => router.replace("/(auth)/sign-up")}>
              <Text className="font-poppins-semibold text-sm text-accent">Criar conta</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
