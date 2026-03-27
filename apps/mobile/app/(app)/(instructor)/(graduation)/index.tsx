import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Placeholder route for tab target; hidden via href: null until Graduação ships. */
export default function InstructorGraduationPlaceholder() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={["top"]}>
      <Text className="font-poppins text-sm text-muted">Em breve</Text>
    </SafeAreaView>
  );
}
