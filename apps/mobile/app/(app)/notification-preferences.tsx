import { BackButton } from "@/components/BackButton";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/lib/hooks/use-notification-preferences";
import { LinearGradient } from "expo-linear-gradient";
import { Check } from "lucide-react-native";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotificationPreferencesScreen() {
  const { data, isLoading } = useNotificationPreferences();
  const { mutate: updatePreferences, isPending } =
    useUpdateNotificationPreferences();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setPushEnabled(data.pushEnabled);
    }
  }, [data]);

  const handleToggle = (value: boolean) => {
    setPushEnabled(value);
    setDirty(true);
  };

  const handleSave = () => {
    updatePreferences({ pushEnabled }, { onSuccess: () => setDirty(false) });
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#0C0C0C" }}
      className="pt-4"
      edges={["top", "bottom"]}
    >
      {/* Header */}
      <View className="flex-row items-center px-6 pb-4 pt-2">
        <BackButton />
        <Text className="flex-1 text-center font-poppins-bold text-lg text-primary">
          Preferências
        </Text>
        <View className="h-10 w-10" />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#A078E8" />
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            paddingHorizontal: 24,
            paddingTop: 16,
            justifyContent: "space-between",
          }}
        >
          {/* Content */}
          <View style={{ gap: 16 }}>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 13,
                color: "#ABABAB",
              }}
            >
              Notificações Push
            </Text>

            <View
              style={{
                backgroundColor: "#1A1A1A",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#2A2A2A",
                overflow: "hidden",
              }}
            >
              {/* Toggle row */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 16,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 15,
                      color: "#FFFFFF",
                    }}
                  >
                    Ativar notificações
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 13,
                      color: "#ABABAB",
                    }}
                  >
                    Receba alertas da academia
                  </Text>
                </View>
                <Switch
                  value={pushEnabled}
                  onValueChange={handleToggle}
                  trackColor={{ false: "#3A3A3A", true: "#A078E8" }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Description */}
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingBottom: 16,
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 13,
                    color: "#ABABAB",
                    lineHeight: 20,
                  }}
                >
                  Quando ativado, você receberá notificações sobre:
                </Text>
                {[
                  "Atualizações de mensalidade",
                  "Confirmações de presença",
                  "Graduações e eventos",
                  "Avisos do instrutor",
                  "Notificações personalizadas",
                ].map((item) => (
                  <Text
                    key={item}
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 13,
                      color: "#ABABAB",
                      lineHeight: 20,
                      paddingLeft: 8,
                    }}
                  >
                    • {item}
                  </Text>
                ))}
              </View>
            </View>
          </View>

          {/* Save button */}
          <Pressable
            onPress={handleSave}
            disabled={!dirty || isPending}
            style={{ marginBottom: 16, opacity: !dirty || isPending ? 0.5 : 1 }}
          >
            <LinearGradient
              colors={["#A078E8", "#7C5CBF"]}
              style={{
                height: 52,
                borderRadius: 14,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              {isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Check size={18} color="#FFFFFF" />
                  <Text
                    style={{
                      fontFamily: "Inter_700Bold",
                      fontSize: 16,
                      color: "#FFFFFF",
                    }}
                  >
                    Salvar Preferências
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
