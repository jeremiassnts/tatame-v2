import { Tabs } from "expo-router";
import { Calendar, Home, Megaphone, Menu } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function GuardianLayout() {
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
        name="(classes)"
        options={{
          title: "Aulas",
          href: "/(app)/(guardian)/(classes)",
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(announcements)"
        options={{
          title: "Avisos",
          href: "/(app)/(guardian)/(announcements)",
          tabBarIcon: ({ color, size }) => <Megaphone size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(more)"
        options={{
          title: "Mais",
          href: "/(app)/(guardian)/(more)",
          tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="(onboarding)" options={{ href: null }} />
    </Tabs>
  );
}
