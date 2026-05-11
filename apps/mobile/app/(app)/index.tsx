import { ApiError } from "@/lib/api";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

export default function AppHomePlaceholder() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { data: user, isPending, isError, error, refetch } = useCurrentUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/(auth)");
      return;
    }
    if (isPending || !user) return;

    if (!user.activeRole) {
      router.replace("/(onboarding)/user-type");
      return;
    }

    if (user.activeRole === "manager" && !user.activeAcademy) {
      router.replace("/(app)/create-academy");
    } else if (user.activeRole === "manager" && user.activeAcademy) {
      router.replace("/(app)/(manager)/(home)");
    } else if (
      user.activeRole === "instructor" ||
      user.activeRole === "student"
    ) {
      if (!user.activeMembership) {
        router.replace("/(app)/(joining)/search-academy");
      } else if (user.activeMembership.status === "pending") {
        router.replace("/(app)/(joining)/pending-approval");
      } else if (user.activeMembership.status === "active") {
        if (user.activeRole === "instructor") {
          router.replace("/(app)/(instructor)/(home)");
        } else {
          router.replace("/(app)/(student)/(home)");
        }
      }
    }
  }, [isLoaded, isSignedIn, isPending, user, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (isError && error instanceof ApiError && error.status === 401) {
      router.replace("/(auth)");
    }
  }, [error, isError, isLoaded, isSignedIn, router]);

  if (isError && !(error instanceof ApiError && error.status === 401)) {
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

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator color="#A078E8" />
    </View>
  );
}
