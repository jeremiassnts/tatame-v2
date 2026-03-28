import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FinancialDashboard() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1 items-center justify-center">
        <Text className="text-primary">Financeiro</Text>
      </View>
    </SafeAreaView>
  );
}
