import { useStartSSO } from "@/lib/hooks/use-start-sso";
import GoogleIcon from "@/assets/icons/google.svg";
import AppleIcon from "@/assets/icons/apple.svg";
import { Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AuthWelcomeScreen() {
  const { handleSSO } = useStartSSO();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <View className="flex-1 items-center justify-center gap-10 px-6">
        <View className="items-center gap-2">
          <View className="h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-[22px] bg-[#242424]">
            <Image
              source={require("@/assets/images/icon.png")}
              className="h-[60px] w-[60px]"
              resizeMode="contain"
            />
          </View>

          <View className="mt-4 items-center gap-2">
            <Text
              className="font-poppins-bold text-primary"
              style={{ fontSize: 32, letterSpacing: -1 }}
            >
              TATAME
            </Text>
            <Text className="font-poppins text-center text-[15px] text-[#525252]">
              Sua academia na palma da mão
            </Text>
          </View>
        </View>

        <View className="w-full gap-3">
          <Pressable
            onPress={() => handleSSO("oauth_google")}
            className="h-14 flex-row items-center justify-center gap-3 rounded-xl border border-surface-border bg-surface"
          >
            <GoogleIcon width={20} height={20} />
            <Text className="font-poppins-semibold text-base text-primary">
              Entrar com Google
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSSO("oauth_apple")}
            className="h-14 flex-row items-center justify-center gap-3 rounded-xl border border-surface-border bg-surface"
          >
            <AppleIcon width={20} height={20} />
            <Text className="font-poppins-semibold text-base text-primary">
              Entrar com Apple
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
