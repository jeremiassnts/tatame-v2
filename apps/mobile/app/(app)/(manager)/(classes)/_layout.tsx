import { Stack } from "expo-router";

export default function ClassesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0C0C0C" },
      }}
    />
  );
}
