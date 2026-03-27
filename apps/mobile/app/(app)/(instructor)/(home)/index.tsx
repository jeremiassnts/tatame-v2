import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/Avatar";
import { ClassCard } from "@/components/ClassCard";
import { GraduationCard } from "@/components/GraduationCard";
import { useApi } from "@/lib/api";
import { useAcademyContext } from "@/lib/academy-context";
import { useMyGraduation } from "@/lib/hooks/use-graduation";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useClasses } from "@/lib/hooks/use-classes";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";

type ClassItem = {
  id: string;
  name: string;
  instructorId: string;
  instructorName?: string | null;
  startTime: string;
  endTime: string;
};

type ClassListResponse = { items: ClassItem[] };

type CheckinListResponse = { items: unknown[] };

function greetingPrefix(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia,";
  if (h < 18) return "Boa tarde,";
  return "Boa noite,";
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function formatTime(t: string) {
  const parts = t.split(":");
  const h = parts[0] ?? "0";
  const m = parts[1] ?? "00";
  return `${h.padStart(2, "0")}:${m}`;
}

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export default function InstructorHome() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApi();
  const { academyName, academyLogoUrl } = useAcademyContext();
  const { data: me } = useCurrentUser();
  const { data: graduation } = useMyGraduation();
  const dayOfWeek = new Date().getDay();
  const todayStr = todayDateString();
  const instructorId = me?.id;

  const { data: classesTodayList } = useClasses(dayOfWeek);
  const [refreshing, setRefreshing] = useState(false);

  const weekClassQueries = useQueries({
    queries: WEEK_DAYS.map((d) => ({
      queryKey: ["classes", d] as const,
      queryFn: () => api.get<ClassListResponse>(`/classes?dayOfWeek=${d}`),
      select: (data: ClassListResponse) => data.items,
      enabled: Boolean(instructorId),
    })),
  });

  const myClassesToday = useMemo(() => {
    if (!instructorId || !classesTodayList) return [];
    return classesTodayList.filter((c) => c.instructorId === instructorId);
  }, [classesTodayList, instructorId]);

  const classesThisWeek = useMemo(() => {
    if (!instructorId) return 0;
    return weekClassQueries.reduce((sum, q) => {
      const items = q.data ?? [];
      return sum + items.filter((c) => c.instructorId === instructorId).length;
    }, 0);
  }, [weekClassQueries, instructorId]);

  const classesTodayCount = myClassesToday.length;

  const checkinQueries = useQueries({
    queries: myClassesToday.map((cls) => ({
      queryKey: ["checkins", cls.id, todayStr] as const,
      queryFn: () =>
        api.get<CheckinListResponse>(
          `/classes/${cls.id}/checkins?date=${encodeURIComponent(todayStr)}`,
        ),
      select: (data: CheckinListResponse) => data.items.length,
      enabled: Boolean(instructorId),
    })),
  });

  const checkinsToday = useMemo(
    () => checkinQueries.reduce((sum, q) => sum + (q.data ?? 0), 0),
    [checkinQueries],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["classes"] }),
      queryClient.invalidateQueries({ queryKey: ["checkins"] }),
    ]);
    setRefreshing(false);
  };

  const instructorFirst = firstName(me?.name ?? "");
  const avatarLetter = (instructorFirst || "?").charAt(0).toUpperCase();

  return (
    <SafeAreaView className="flex-1 pt-6 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A078E8" />
        }
      >
        <View className="pb-8" style={{ paddingTop: 4, paddingHorizontal: 24, gap: 24 }}>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
                {greetingPrefix()}
              </Text>
              <Text
                className="font-poppins-bold text-primary"
                style={{ fontSize: 22, letterSpacing: -0.5 }}
              >
                {instructorFirst || "Instrutor"}
              </Text>
            </View>
            <Pressable onPress={() => router.push("/(app)/profile")}>
              <Avatar
                variant="user"
                imageUrl={me?.profileImageUrl}
                fallbackLetter={avatarLetter}
              />
            </Pressable>
          </View>

          <View
            className="rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 20, gap: 16 }}
          >
            <View className="flex-row items-center gap-3">
              <Avatar variant="brand" imageUrl={academyLogoUrl} />
              <View className="min-w-0 flex-1" style={{ gap: 2 }}>
                <Text className="font-poppins-semibold text-base text-primary">{academyName}</Text>
              </View>
            </View>
            <View className="h-px w-full bg-surface-border" />
            <View className="flex-row">
              <View className="flex-1 items-center" style={{ gap: 4 }}>
                <Text className="font-poppins-bold text-primary" style={{ fontSize: 22 }}>
                  {classesThisWeek}
                </Text>
                <Text className="font-poppins text-center text-[11px]" style={{ color: TEXT_SECONDARY }}>
                  Aulas{"\n"}esta semana
                </Text>
              </View>
              <View className="flex-1 items-center" style={{ gap: 4 }}>
                <Text className="font-poppins-bold text-primary" style={{ fontSize: 22 }}>
                  {checkinsToday}
                </Text>
                <Text className="font-poppins text-center text-[11px]" style={{ color: TEXT_SECONDARY }}>
                  Check-ins{"\n"}hoje
                </Text>
              </View>
              <View className="flex-1 items-center" style={{ gap: 4 }}>
                <Text className="font-poppins-bold text-primary" style={{ fontSize: 22 }}>
                  {classesTodayCount}
                </Text>
                <Text className="font-poppins text-center text-[11px]" style={{ color: TEXT_SECONDARY }}>
                  Aulas{"\n"}hoje
                </Text>
              </View>
            </View>
          </View>

          <GraduationCard
            graduation={graduation}
            variant="full"
            onRegisterPress={() =>
              router.push({
                pathname: "/(app)/(student)/register-belt",
                params: { returnTo: "instructor" },
              })
            }
          />

          <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
            Aulas de hoje
          </Text>
          <View style={{ gap: 10 }}>
            {myClassesToday.length === 0 ? (
              <View className="items-center rounded-[14px] border border-surface-border bg-surface py-8">
                <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                  Nenhuma aula agendada para hoje
                </Text>
              </View>
            ) : (
              myClassesToday.map((cls) => (
                <ClassCard
                  key={cls.id}
                  name={cls.name}
                  startTime={formatTime(cls.startTime)}
                  endTime={formatTime(cls.endTime)}
                  instructorName={cls.instructorName ?? undefined}
                  onPress={() => router.push(`/(app)/(instructor)/(classes)/${cls.id}`)}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
