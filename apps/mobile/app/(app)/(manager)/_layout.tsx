import { ApiError } from "@/lib/api";
import { useManagerSubscription } from "@/lib/hooks/use-manager-subscription";
import { Tabs } from "expo-router";
import Constants from "expo-constants";
import { Calendar, CreditCard, Home, Menu, Users } from "lucide-react-native";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PORTAL_URL =
  Constants.expoConfig?.extra?.managerPortalUrl ?? "https://tatame.app/conta";
const SIGNUP_URL =
  Constants.expoConfig?.extra?.managerSignupUrl ?? "https://tatame.app/cadastro";

function GateScreen({
  title,
  message,
  ctaLabel,
  onPress,
}: {
  title: string;
  message: string;
  ctaLabel: string;
  onPress: () => void;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center px-6" style={{ gap: 16 }}>
        <Text className="font-poppins-bold text-xl text-primary text-center">
          {title}
        </Text>
        <Text className="font-poppins text-sm text-muted text-center">
          {message}
        </Text>
        <Pressable
          onPress={onPress}
          className="items-center rounded-xl bg-accent"
          style={{ paddingVertical: 14, paddingHorizontal: 24, marginTop: 8 }}
        >
          <Text className="font-poppins-semibold text-sm text-white">
            {ctaLabel}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function ManagerLayout() {
  const insets = useSafeAreaInsets();
  const {
    data: subscription,
    isPending,
    error,
    refetch,
  } = useManagerSubscription();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  if (error) {
    // Only a 404 means "no subscription row". The query does not retry, so
    // treating every failure as unsubscribed would tell a paying manager on a
    // flaky connection to go buy the plan again.
    if (error instanceof ApiError && error.status === 404) {
      return (
        <GateScreen
          title="Falta ativar sua assinatura"
          message="Sua conta foi criada, mas o pagamento não foi concluído. Finalize a assinatura para liberar o painel de gestor."
          ctaLabel="Ativar assinatura"
          onPress={() => Linking.openURL(SIGNUP_URL)}
        />
      );
    }

    return (
      <GateScreen
        title="Não foi possível carregar sua conta"
        message="Verifique sua conexão e tente novamente."
        ctaLabel="Tentar novamente"
        onPress={() => void refetch()}
      />
    );
  }

  // `incomplete` means the card was declined at Stripe; `past_due` a failed
  // renewal; `canceled` speaks for itself. None of them get the panel.
  const status = subscription?.status;
  if (
    status === "canceled" ||
    status === "past_due" ||
    status === "incomplete"
  ) {
    return (
      <GateScreen
        title="Acesso indisponível"
        message="Sua conta não tem acesso ao painel de gestor no momento. Verifique seus dados de pagamento para reativar."
        ctaLabel="Acessar minha conta"
        onPress={() => Linking.openURL(PORTAL_URL)}
      />
    );
  }

  // active or trialing -> show tabs
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
        listeners={({ navigation }) => ({
          tabPress: () => navigation.navigate("(home)", { screen: "index" }),
        })}
      />
      <Tabs.Screen
        name="(members)"
        options={{
          title: "Membros",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => navigation.navigate("(members)", { screen: "index" }),
        })}
      />
      <Tabs.Screen
        name="(classes)"
        options={{
          title: "Aulas",
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => navigation.navigate("(classes)", { screen: "index" }),
        })}
      />
      <Tabs.Screen
        name="(finances)"
        options={{
          title: "Finanças",
          tabBarIcon: ({ color, size }) => (
            <CreditCard size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => navigation.navigate("(finances)", { screen: "index" }),
        })}
      />
      <Tabs.Screen
        name="(more)"
        options={{
          title: "Mais",
          tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => navigation.navigate("(more)", { screen: "index" }),
        })}
      />
      <Tabs.Screen
        name="create-notification"
        options={{ href: null }}
      />
    </Tabs>
  );
}
