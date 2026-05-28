import { Stack } from "expo-router";

export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="announcements" />
      <Stack.Screen name="create-announcement" />
      <Stack.Screen name="announcement/[id]" />
      <Stack.Screen name="tutorials" />
    </Stack>
  );
}
