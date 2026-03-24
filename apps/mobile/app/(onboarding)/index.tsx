import { View, Text, Image } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { GradientButton } from "@/components/GradientButton";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      {/* Content — centered */}
      <View className="flex-1 items-center justify-center px-10">
        <View className="h-[120px] w-[120px] items-center justify-center rounded-3xl bg-[#242424]">
          <Image
            source={require("@/assets/images/icon.png")}
            className="h-[80px] w-[80px]"
            resizeMode="contain"
          />
        </View>

        <View className="mt-8 items-center gap-3">
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 38, letterSpacing: -1.5 }}
          >
            TATAME
          </Text>
          <Text className="font-poppins text-center text-base leading-6 text-muted">
            Gerencie sua academia de Jiu-Jitsu com simplicidade e eficiência
          </Text>
        </View>
      </View>

      {/* Bottom CTA */}
      <View className="px-6 pb-6">
        <GradientButton
          label="Continuar"
          onPress={() => router.push("/(onboarding)/user-type")}
        />
      </View>
    </SafeAreaView>
  );
}
