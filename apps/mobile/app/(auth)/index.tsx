import { View, Text, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { Divider } from "@/components/Divider";
import { SocialButtons } from "@/components/SocialButtons";

WebBrowser.maybeCompleteAuthSession();

export default function AuthWelcomeScreen() {
  const router = useRouter();
  const { startOAuthFlow: startGoogle } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startApple } = useOAuth({ strategy: "oauth_apple" });

  const handleOAuth = async (start: typeof startGoogle) => {
    try {
      const { createdSessionId, setActive } = await start();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(app)");
      }
    } catch {
      // user cancelled or provider failed
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <View className="flex-1 items-center justify-center px-10">
        <View className="h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-[22px] bg-[#242424]">
          <Image
            source={require("@/assets/images/icon.png")}
            className="h-[60px] w-[60px]"
            resizeMode="contain"
          />
        </View>

        <View className="mt-6 items-center gap-2">
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 32, letterSpacing: -1 }}
          >
            TATAME
          </Text>
          <Text className="font-poppins text-center text-[15px] text-[#525252]">
            Sua academia na palma da mao
          </Text>
        </View>
      </View>

      <View className="gap-4 px-6 pb-4">
        <Pressable
          onPress={() => router.push("/(auth)/sign-in")}
          className="h-14 items-center justify-center rounded-xl bg-accent"
        >
          <Text className="font-poppins-semibold text-base text-white">Entrar</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(auth)/sign-up")}
          className="h-14 items-center justify-center rounded-xl border border-[#3A3A3A] bg-surface"
        >
          <Text className="font-poppins-semibold text-base text-primary">Criar conta</Text>
        </Pressable>

        <Divider text="ou continue com" />

        <SocialButtons
          onGooglePress={() => handleOAuth(startGoogle)}
          onApplePress={() => handleOAuth(startApple)}
        />
      </View>
    </SafeAreaView>
  );
}
