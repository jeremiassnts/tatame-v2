import { shouldForceUpdate } from "@/lib/version";
import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const [needsUpdate, setNeedsUpdate] = useState<boolean | undefined>(
    undefined
  );

  useEffect(() => {
    shouldForceUpdate().then(setNeedsUpdate);
  }, []);

  if (!isLoaded || needsUpdate === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  if (needsUpdate) return <Redirect href="/(system)/force-update" />;
  if (!isSignedIn) return <Redirect href="/(auth)" />;
  return <Redirect href="/(app)" />;
}
