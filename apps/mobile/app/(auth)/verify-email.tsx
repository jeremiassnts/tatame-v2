import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSignUp } from "@clerk/clerk-expo";
import { Timer } from "lucide-react-native";
import { BackButton } from "@/components/BackButton";
import { useAuthComplete } from "@/lib/hooks/use-auth-complete";

const CODE_LENGTH = 6;
const EXPIRY_SECONDS = 5 * 60;

type ClerkError = {
  errors?: Array<{ longMessage?: string }>;
};

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { signUp, setActive } = useSignUp();
  const { completeAuth } = useAuthComplete();

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(EXPIRY_SECONDS);
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const interval = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, [seconds]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const handleChange = (text: string, index: number) => {
    const value = text.slice(-1);
    const next = [...code];
    next[index] = value;
    setCode(next);
    setError("");
    if (value && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (!signUp) return;
    const codeStr = code.join("");
    if (codeStr.length < CODE_LENGTH) {
      setError("Digite o codigo completo");
      return;
    }
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: codeStr });
      if (result.status === "complete") {
        try {
          await completeAuth({
            createdSessionId: result.createdSessionId,
            setActive,
          });
        } catch {
          setError("Não foi possível sincronizar. Tente novamente.");
        }
      }
    } catch (errorObj) {
      const err = errorObj as ClerkError;
      if (err.errors?.[0]) {
        setError(err.errors[0].longMessage ?? "Codigo invalido");
      } else {
        Alert.alert("Erro", "Nao foi possivel verificar. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!signUp) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setSeconds(EXPIRY_SECONDS);
      setCode(Array(CODE_LENGTH).fill(""));
      setError("");
      inputs.current[0]?.focus();
    } catch {
      Alert.alert("Erro", "Nao foi possivel reenviar o codigo.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-7 px-6 pt-2">
        <BackButton />

        <View className="gap-4">
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 28, letterSpacing: -1 }}
          >
            Verificar e-mail
          </Text>
          <View className="gap-1">
            <Text className="font-poppins text-[15px] text-[#525252]">
              Enviamos um codigo de 6 digitos para
            </Text>
            <Text className="font-poppins-semibold text-[15px] text-primary">
              {email ?? "seu@email.com"}
            </Text>
          </View>
        </View>

        <View className="items-center gap-6">
          <View className="flex-row justify-center gap-3">
            {code.map((digit, i) => {
              const activeIndex = code.findIndex((d) => !d);
              const isActive = activeIndex === -1 ? i === CODE_LENGTH - 1 : i === activeIndex;
              return (
                <TextInput
                  key={i}
                  ref={(ref) => {
                    inputs.current[i] = ref;
                  }}
                  value={digit}
                  onChangeText={(t) => handleChange(t, i)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  className={`h-14 w-12 rounded-xl border bg-surface text-center font-poppins-semibold text-2xl text-primary ${
                    isActive ? "border-2 border-accent" : "border-surface-border"
                  }`}
                />
              );
            })}
          </View>

          {error ? <Text className="font-poppins text-sm text-red-500">{error}</Text> : null}

          <View className="flex-row items-center justify-center gap-1.5">
            <Timer size={14} color="#525252" />
            <Text className="font-poppins text-[13px] text-[#525252]">
              Codigo expira em {formatTime(seconds)}
            </Text>
          </View>

          <View className="flex-row items-center gap-1">
            <Text className="font-poppins text-sm text-muted">Nao recebeu o codigo?</Text>
            <Pressable onPress={handleResend}>
              <Text className="font-poppins-semibold text-sm text-accent">Reenviar</Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-1" />

        <View className="pb-2">
          <Pressable
            onPress={handleVerify}
            disabled={loading}
            className="h-14 items-center justify-center rounded-xl bg-accent"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-poppins-semibold text-base text-white">Verificar</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
