import { resolveGatekeeperRoute } from "@/lib/gatekeeper";
import { usePendingInvite } from "@/lib/hooks/use-pending-invite";
import { ApiError } from "@/lib/api";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { clearPendingInvite } from "@/lib/pending-invite";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

export default function AppHomePlaceholder() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { data: user, isPending, isError, error, refetch } = useCurrentUser();
  const { invite, hydrated } = usePendingInvite();

  /**
   * One navigation per mount. Clearing the invite emits a new snapshot
   * synchronously, so without this the effect would re-run with `invite: null`
   * and bounce the person straight off the screen it had just chosen.
   */
  const navigated = useRef(false);

  useEffect(() => {
    if (navigated.current) return;
    // `hydrated` is not cosmetic: deciding before the persisted invite has been
    // read sends someone who tapped an invite to `search-academy`, which is the
    // screen this whole feature removes.
    if (!isLoaded || !hydrated) return;

    const { route, clearInvite } = resolveGatekeeperRoute({
      isSignedIn: Boolean(isSignedIn),
      // Still loading, or the query failed: the resolver is told nothing is
      // known rather than being handed a half-truth. It answers `null` and the
      // error UI below takes over.
      user: isSignedIn && !isPending ? (user ?? null) : null,
      invite,
    });

    if (!route) return;

    navigated.current = true;
    if (clearInvite) void clearPendingInvite();
    router.replace(route as Parameters<typeof router.replace>[0]);
  }, [isLoaded, isSignedIn, isPending, user, invite, hydrated, router]);

  useEffect(() => {
    if (navigated.current) return;
    if (!isLoaded || !isSignedIn) return;
    if (isError && error instanceof ApiError && error.status === 401) {
      navigated.current = true;
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
