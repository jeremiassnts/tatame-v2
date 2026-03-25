import { AcademyProvider } from "@/lib/academy-context";
import { ApiError } from "@/lib/api";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { queryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

export default function AppLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  );
}

function AppRouter() {
  const router = useRouter();
  const { data: user, isPending, isError, error, refetch } = useCurrentUser();

  useEffect(() => {
    if (isPending || !user) return;

    if (user.activeRole === "manager" && !user.activeAcademy) {
      router.replace("/(app)/create-academy");
    } else if (user.activeRole === "manager" && user.activeAcademy) {
      router.replace("/(app)/(manager)/(home)");
    }
    // Future: instructor/student redirects
  }, [isPending, user, router]);

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  if (isError) {
    const message =
      error instanceof ApiError ? error.message : "Não foi possível carregar seu perfil";
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Text className="mb-4 text-center text-white">{message}</Text>
        <Pressable
          onPress={() => void refetch()}
          className="rounded-lg bg-accent px-4 py-2"
        >
          <Text className="font-medium text-white">Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  const academyContext =
    user.activeRole === "manager" && user.activeAcademy
      ? {
        academyId: user.activeAcademy.id,
        academyName: user.activeAcademy.name,
        academyLogoUrl: user.activeAcademy.logoUrl,
      }
      : null;

  if (academyContext) {
    return (
      <AcademyProvider value={academyContext}>
        <Stack screenOptions={{ headerShown: false }} />
      </AcademyProvider>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
