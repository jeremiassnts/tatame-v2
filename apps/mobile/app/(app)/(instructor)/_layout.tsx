import { Tabs } from "expo-router";
import { Award, Calendar, Home, School } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function InstructorLayout() {
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
        name="(classes)"
        options={{
          title: "Aulas",
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="(graduation)"
        options={{
          title: "Graduação",
          tabBarIcon: ({ color, size }) => <Award size={size} color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="(academy)"
        options={{
          title: "Academia",
          tabBarIcon: ({ color, size }) => <School size={size} color={color} />,
          href: null,
        }}
      />
    </Tabs>
  );
}
