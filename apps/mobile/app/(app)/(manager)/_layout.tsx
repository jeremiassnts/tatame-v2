import { Tabs, useRouter } from "expo-router";
import { Calendar, CreditCard, Home, Users } from "lucide-react-native";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useManagerSubscription } from "@/lib/hooks/use-manager-subscription";

export default function ManagerLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: subscription, isPending, isError } = useManagerSubscription();

  useEffect(() => {
    if (isPending) return;
    if (isError || !subscription) {
      router.replace("/(app)/(manager)/plan-selection");
    }
  }, [isPending, isError, subscription, router]);

  if (isPending || isError || !subscription) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: "#0C0C0C",
        },
        tabBarStyle: {
          backgroundColor: "#1A1A1A",
          borderTopColor: "#2A2A2A",
          borderTopWidth: 1,
          height: 56 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
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
          href: "/(app)/(manager)/(members)",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(classes)"
        options={{
          title: "Aulas",
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(finances)"
        options={{
          title: "Finanças",
          href: "/(app)/(manager)/(finances)",
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
    </Tabs>
  );
}
