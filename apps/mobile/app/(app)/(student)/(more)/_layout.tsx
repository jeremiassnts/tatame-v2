import { Stack } from "expo-router";

export default function StudentMoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="dependents" />
      <Stack.Screen name="create-dependent" />
      <Stack.Screen name="dependent-detail" />
    </Stack>
  );
}
