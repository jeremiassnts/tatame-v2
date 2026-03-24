import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0C0C0C" },
        animation: "slide_from_right",
      }}
    />
  );
}
