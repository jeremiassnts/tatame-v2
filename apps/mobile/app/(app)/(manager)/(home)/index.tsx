import { useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Settings,
  Users,
  Clock,
  Calendar,
  CreditCard,
  ChevronRight,
} from "lucide-react-native";
import { useAcademyContext } from "@/lib/academy-context";
import { useAcademyStats } from "@/lib/hooks/use-academy";
import { useApi } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StatCard } from "@/components/StatCard";
import { ClassCard } from "@/components/ClassCard";

export default function ManagerDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { academyId, academyName, academyLogoUrl } = useAcademyContext();
  const { data: stats } = useAcademyStats(academyId);
  const [refreshing, setRefreshing] = useState(false);

  const dayOfWeek = new Date().getDay();
  const api = useApi();
  const { data: classesData } = useQuery({
    queryKey: ["classes", academyId, dayOfWeek],
    queryFn: () =>
      api.get<{ items: Array<{ id: string; name: string; startTime: string; endTime: string }> }>(
        // Academy is the active one from `attachActiveAcademyContext`; query only allows dayOfWeek.
        `/classes?dayOfWeek=${dayOfWeek}`,
      ),
  });

  const todayClasses = classesData?.items?.slice(0, 3) ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["academy-stats", academyId] }),
      queryClient.invalidateQueries({
        queryKey: ["classes", academyId, dayOfWeek],
      }),
    ]);
    setRefreshing(false);
  };

  function formatTime(t: string) {
    const parts = t.split(":");
    const h = parts[0] ?? "0";
    const m = parts[1] ?? "00";
    return `${h.padStart(2, "0")}:${m}`;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#A078E8"
          />
        }
      >
        <View className="px-6 pb-8 pt-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              {academyLogoUrl ? (
                <Image
                  source={{ uri: academyLogoUrl }}
                  className="h-10 w-10 rounded-full"
                />
              ) : (
                <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                  <Text className="font-poppins-bold text-sm text-accent">
                    {academyName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text className="font-poppins-semibold text-base text-primary">
                  {academyName}
                </Text>
                <Text className="font-poppins text-xs text-muted">
                  Manager Dashboard
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push("/(app)/(manager)/(home)/settings")}
              className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
            >
              <Settings size={20} color="#ABABAB" />
            </Pressable>
          </View>

          <View className="mt-6 gap-3">
            <View className="flex-row gap-3">
              <StatCard
                icon={Users}
                count={stats?.activeMembers ?? 0}
                label="Active Members"
              />
              <StatCard
                icon={Clock}
                count={stats?.pendingRequests ?? 0}
                label="Pending Requests"
              />
            </View>
            <View className="flex-row gap-3">
              <StatCard
                icon={Calendar}
                count={stats?.classesToday ?? 0}
                label="Classes Today"
              />
              <StatCard
                icon={CreditCard}
                count={stats?.activePlans ?? 0}
                label="Active Plans"
              />
            </View>
          </View>

          <View className="mt-6 gap-3">
            <Text className="font-poppins-semibold text-base text-primary">
              Quick Actions
            </Text>
            <View className="flex-row gap-3">
              <Pressable className="flex-1 flex-row items-center gap-2 rounded-xl border border-surface-border bg-surface p-3">
                <Clock size={18} color="#A078E8" />
                <Text className="font-poppins-medium text-sm text-primary">
                  Pending Requests
                </Text>
              </Pressable>
              <Pressable className="flex-1 flex-row items-center gap-2 rounded-xl border border-surface-border bg-surface p-3">
                <Calendar size={18} color="#A078E8" />
                <Text className="font-poppins-medium text-sm text-primary">
                  {"Today's Schedule"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-6 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-poppins-semibold text-base text-primary">
                {"Today's Classes"}
              </Text>
              {todayClasses.length > 0 ? (
                <Pressable className="flex-row items-center gap-1">
                  <Text className="font-poppins-medium text-sm text-accent">
                    See all
                  </Text>
                  <ChevronRight size={16} color="#A078E8" />
                </Pressable>
              ) : null}
            </View>
            {todayClasses.length === 0 ? (
              <View className="items-center rounded-2xl border border-surface-border bg-surface py-8">
                <Text className="font-poppins text-sm text-muted">
                  No classes scheduled for today
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {todayClasses.map((cls) => (
                  <ClassCard
                    key={cls.id}
                    name={cls.name}
                    startTime={formatTime(cls.startTime)}
                    endTime={formatTime(cls.endTime)}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
