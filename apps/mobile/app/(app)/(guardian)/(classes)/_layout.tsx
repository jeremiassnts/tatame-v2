import { Stack } from "expo-router";

export default function GuardianClassesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[classId]" />
    </Stack>
  );
}
