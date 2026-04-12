import { useManagerSubscription } from "@/lib/hooks/use-manager-subscription";
import { Tabs, useRouter, useSegments } from "expo-router";
import { Calendar, CreditCard, Home, Users } from "lucide-react-native";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ManagerLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const { data: subscription, isPending, isError } = useManagerSubscription();

  const last = segments[segments.length - 1];
  const isOnGatedScreen =
    last === "plan-selection" || last === "subscription-result";

  useEffect(() => {
    if (isPending) return;
    if (!isOnGatedScreen && (isError || !subscription)) {
      router.replace("/(app)/(manager)/plan-selection");
    }
  }, [isPending, isError, subscription, router, isOnGatedScreen]);

  const gated = isPending || isError || !subscription;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: "#0C0C0C",
        },
        tabBarStyle: gated
          ? { display: "none" as const }
          : {
              backgroundColor: "#1A1A1A",
              borderTopColor: "#2A2A2A",
              borderTopWidth: 1,
              height: 56 + Math.max(insets.bottom, 8),
            },
        tabBarActiveTintColor: "#A078E8",
        tabBarInactiveTintColor: "#ABABAB",
        tabBarLabelStyle: {
          fontFamily: "Poppins_500Medium",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(members)"
        options={{
          title: "Membros",
          href: gated ? null : "/(app)/(manager)/(members)",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(classes)"
        options={{
          title: "Aulas",
          href: gated ? null : "/(app)/(manager)/(classes)",
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(finances)"
        options={{
          title: "Finanças",
          href: gated ? null : "/(app)/(manager)/(finances)",
          tabBarIcon: ({ color, size }) => (
            <CreditCard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan-selection"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="subscription-result"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
