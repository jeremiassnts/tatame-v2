import { GradientButton } from "@/components/GradientButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { GraduationCap, User } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ROLES = [
  {
    key: "instructor",
    label: "Instrutor",
    description: "Ensine aulas e acompanhe o progresso dos alunos",
    Icon: GraduationCap,
  },
  {
    key: "student",
    label: "Aluno",
    description: "Treine, registre presença e acompanhe sua graduação",
    Icon: User,
  },
] as const;

type UserType = (typeof ROLES)[number]["key"];

export default function UserTypeScreen() {
  const [selected, setSelected] = useState<UserType>("student");
  const router = useRouter();

  const handleContinue = async () => {
    await AsyncStorage.setItem("userType", selected);
    router.replace("/(auth)");
  };

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top", "bottom"]}>
      <View className="flex-1 gap-8 p-6 pt-4">
        {/* Header */}
        <View className="gap-2">
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 28, letterSpacing: -1 }}
          >
            Qual é o seu perfil?
          </Text>
          <Text className="font-poppins text-[15px] leading-5 text-muted">
            Selecione o que melhor descreve você para personalizar sua
            experiência.
          </Text>
        </View>

        {/* Role Cards */}
        <View className="gap-3">
          {ROLES.map(({ key, label, description, Icon }) => {
            const isSelected = selected === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSelected(key)}
                className={`flex-row items-center gap-4 rounded-2xl p-5 ${isSelected
                  ? "border-[1.5px] border-accent bg-accent-translucent"
                  : "border border-surface-border bg-surface"
                  }`}
              >
                {isSelected ? (
                  <View className="h-12 w-12 overflow-hidden rounded-xl">
                    <LinearGradient
                      colors={["#A078E8", "#7C5CBF"]}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={24} color="#FFFFFF" />
                    </LinearGradient>
                  </View>
                ) : (
                  <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#242424]">
                    <Icon size={24} color="#ABABAB" />
                  </View>
                )}
                <View className="flex-1 gap-1">
                  <Text className="font-poppins-semibold text-base text-primary">
                    {label}
                  </Text>
                  <Text className="font-poppins text-[13px] leading-4 text-muted">
                    {description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Spacer */}
        <View className="flex-1" />

        {/* CTA */}
        <GradientButton label="Continuar" onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}
