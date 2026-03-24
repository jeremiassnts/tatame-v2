import { Stack } from "expo-router";

/** Replaced by tab navigator in Task 7; minimal stack so manager redirects work. */
export default function ManagerLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
