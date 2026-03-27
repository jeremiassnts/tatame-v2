import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View } from "react-native";
import { Users } from "lucide-react-native";

export default function StudentMembersScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background pt-6" edges={["top"]}>
      <View className="flex-1 px-6" style={{ gap: 16 }}>
        <Text className="font-poppins-bold text-primary" style={{ fontSize: 24 }}>
          Membros
        </Text>

        <View
          className="items-center rounded-2xl border border-surface-border bg-surface px-6 py-8"
          style={{ gap: 12 }}
        >
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-accent-translucent">
            <Users size={22} color="#A078E8" />
          </View>
          <Text className="text-center font-poppins-semibold text-sm text-primary">
            Em breve
          </Text>
          <Text className="text-center font-poppins text-xs text-muted">
            Esta área mostrará os membros da sua academia.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

