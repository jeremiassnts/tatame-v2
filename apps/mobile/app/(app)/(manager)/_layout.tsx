import { useManagerSubscription } from "@/lib/hooks/use-manager-subscription";
import { Tabs } from "expo-router";
import Constants from "expo-constants";
import { Calendar, CreditCard, Home, Users } from "lucide-react-native";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PORTAL_URL =
  Constants.expoConfig?.extra?.managerPortalUrl ?? "https://tatame.app/conta";

function BlockedScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center px-6" style={{ gap: 16 }}>
        <Text className="font-poppins-bold text-xl text-primary text-center">
          Assinatura inativa
        </Text>
        <Text className="font-poppins text-sm text-muted text-center">
          Sua assinatura precisa estar ativa para acessar o painel de gestor.
          Gerencie sua conta pelo portal web.
        </Text>
        <Pressable
          onPress={() => Linking.openURL(PORTAL_URL)}
          className="items-center rounded-xl bg-accent"
          style={{ paddingVertical: 14, paddingHorizontal: 24, marginTop: 8 }}
        >
          <Text className="font-poppins-semibold text-sm text-white">
            Gerenciar minha conta
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function ManagerLayout() {
  const insets = useSafeAreaInsets();
  const { data: subscription, isPending } = useManagerSubscription();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  const isActive =
    subscription?.status === "active" || subscription?.status === "trialing";

  if (!isActive) {
    return <BlockedScreen />;
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
          title: "Inicio",
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
          tabBarIcon: ({ color, size }) => (
            <CreditCard size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
