import { AcademyProvider, useUpdateAcademyContext } from "@/lib/academy-context";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { queryClient } from "@/lib/query-client";
import { useApi } from "@/lib/api";
import { registerForPushNotificationsAsync, getDeviceId } from "@/lib/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

/** Keeps AcademyContext in sync with the user query. */
function AcademySyncer() {
  const { data: user } = useCurrentUser();
  const update = useUpdateAcademyContext();

  useEffect(() => {
    if (user?.activeRole === "manager" && user.activeAcademy) {
      update({
        academyId: user.activeAcademy.id,
        academyName: user.activeAcademy.name,
        academyLogoUrl: user.activeAcademy.logoUrl,
      });
    } else if (
      (user?.activeRole === "instructor" || user?.activeRole === "student") &&
      user?.activeMembership?.status === "active"
    ) {
      update({
        academyId: user.activeMembership.academyId,
        academyName: user.activeMembership.academyName,
        academyLogoUrl: user.activeMembership.academyLogoUrl,
      });
    }
  }, [user, update]);

  return null;
}

function PushTokenRegistrar() {
  const api = useApi();

  useEffect(() => {
    let mounted = true;

    async function register() {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!token || !mounted) return;

        await api.post("/push-tokens", {
          token,
          platform: Platform.OS as "ios" | "android",
          deviceId: await getDeviceId(),
        });
      } catch {
        // Silent failure — push registration is not critical
      }
    }

    register();

    return () => {
      mounted = false;
    };
  }, []);

  return null;
}

export default function AppLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AcademyProvider>
        <AcademySyncer />
        <PushTokenRegistrar />
        <Stack screenOptions={{ headerShown: false }} />
      </AcademyProvider>
    </QueryClientProvider>
  );
}
