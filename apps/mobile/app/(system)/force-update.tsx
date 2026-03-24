import { View, Text, Pressable, Linking, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Download, ExternalLink, ArrowRight } from "lucide-react-native";
import Constants from "expo-constants";

function getStoreUrl() {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  if (Platform.OS === "ios") {
    return env?.EXPO_PUBLIC_IOS_STORE_URL ?? "";
  }
  return env?.EXPO_PUBLIC_ANDROID_STORE_URL ?? "";
}

export default function ForceUpdateScreen() {
  const currentVersion = Constants.expoConfig?.version ?? "1.0.0";
  const minVersion =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.EXPO_PUBLIC_MIN_APP_VERSION ?? "2.0.0";

  const handleUpdateNow = async () => {
    const storeUrl = getStoreUrl();
    if (!storeUrl) {
      Alert.alert("Atualizacao pendente", "Link da loja ainda nao configurado.");
      return;
    }

    const canOpen = await Linking.canOpenURL(storeUrl);
    if (!canOpen) {
      Alert.alert("Erro", "Nao foi possivel abrir o link da loja.");
      return;
    }

    await Linking.openURL(storeUrl);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 bg-background">
        <View className="h-[62px] px-6" />

        <View className="flex-1 items-center justify-center gap-8 px-10">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-accent-translucent">
            <Download size={40} color="#A078E8" />
          </View>

          <View className="w-full items-center gap-3">
            <Text
              className="font-poppins-bold text-center text-primary"
              style={{ fontSize: 32, letterSpacing: -1 }}
            >
              Atualizacao disponivel
            </Text>
            <Text className="font-poppins text-center text-[15px] leading-6 text-muted">
              Uma nova versao do Tatame esta disponivel. Atualize o app para continuar
              usando.
            </Text>
          </View>

          <View className="flex-row items-center gap-1 rounded-[20px] border border-surface-border bg-surface px-4 py-2">
            <Text className="font-poppins-medium text-[13px] text-muted">v{currentVersion}</Text>
            <ArrowRight size={14} color="#525252" />
            <Text className="font-poppins-semibold text-[13px] text-accent">v{minVersion}</Text>
          </View>
        </View>

        <View className="gap-4 px-6 pb-12">
          <Pressable
            onPress={handleUpdateNow}
            className="h-14 flex-row items-center justify-center gap-2 rounded-xl bg-accent"
          >
            <ExternalLink size={20} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-base text-white">Atualizar agora</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
