import { View, Text } from "react-native";

/** Default (app) entry when no role-specific redirect applies (e.g. student — Task 7+). */
export default function AppHomePlaceholder() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-center text-muted">
        Área do app em construção.
      </Text>
    </View>
  );
}
