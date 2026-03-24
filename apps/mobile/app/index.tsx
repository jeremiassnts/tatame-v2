import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { shouldForceUpdate } from "@/lib/version";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const [userType, setUserType] = useState<string | null | undefined>(
    undefined
  );

  useEffect(() => {
    AsyncStorage.getItem("userType").then(setUserType);
  }, []);

  if (!isLoaded || userType === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  if (shouldForceUpdate()) return <Redirect href="/(system)/force-update" />;
  if (!userType) return <Redirect href="/(onboarding)" />;
  if (!isSignedIn) return <Redirect href="/(auth)" />;
  return <Redirect href="/(app)" />;
}
