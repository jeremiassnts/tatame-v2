import { shouldForceUpdate } from "@/lib/version";
import { useAuth } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const [userType, setUserType] = useState<string | null | undefined>(
    undefined
  );
  const [needsUpdate, setNeedsUpdate] = useState<boolean | undefined>(
    undefined
  );

  useEffect(() => {
    AsyncStorage.getItem("userType").then(setUserType);
    shouldForceUpdate().then(setNeedsUpdate);
  }, []);

  if (!isLoaded || userType === undefined || needsUpdate === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  if (needsUpdate) return <Redirect href="/(system)/force-update" />;
  if (!userType) return <Redirect href="/(onboarding)" />;
  if (!isSignedIn) return <Redirect href="/(auth)" />;
  return <Redirect href="/(app)" />;
}
