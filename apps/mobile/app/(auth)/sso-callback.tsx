import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

export default function SSOCallbackScreen() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/(app)");
      return;
    }
    const timeout = setTimeout(() => {
      router.replace("/(auth)");
    }, 5000);
    return () => clearTimeout(timeout);
  }, [isSignedIn, router]);

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator color="#A078E8" size="large" />
    </View>
  );
}
