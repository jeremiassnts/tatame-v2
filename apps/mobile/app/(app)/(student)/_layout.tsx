import { Tabs } from "expo-router";
import { Calendar, CreditCard, Home, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function StudentLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#0C0C0C" },
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
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(classes)"
        options={{
          title: "Agenda",
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(subscription)"
        options={{
          title: "Assinatura",
          tabBarIcon: ({ color, size }) => (
            <CreditCard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="register-belt" options={{ href: null }} />
    </Tabs>
  );
}
