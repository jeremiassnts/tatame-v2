import { AcademyProvider } from "@/lib/academy-context";
import { queryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AcademyProvider value={{ academyId: "", academyName: "", academyLogoUrl: null }}>
        <Stack screenOptions={{ headerShown: false }} />
      </AcademyProvider>
    </QueryClientProvider>
  );
}
