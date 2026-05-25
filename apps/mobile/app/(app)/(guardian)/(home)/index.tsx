import { Avatar } from "@/components/Avatar";
import { AnnouncementFeedCard } from "@/components/announcements/AnnouncementFeedCard";
import { ClassCard } from "@/components/ClassCard";
import { NotificationBell } from "@/components/NotificationBell";
import { localDateStringForAgendaWeekday } from "@/lib/class-session-date";
import { useAcademyContext } from "@/lib/academy-context";
import { useAnnouncements } from "@/lib/hooks/use-announcements";
import { useClasses } from "@/lib/hooks/use-classes";
import { useDependents } from "@/lib/hooks/use-dependents";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ChevronRight, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";
const ACCENT = "#A078E8";

function formatTime(t: string) {
  const parts = t.split(":");
  const h = parts[0] ?? "0";
  const m = parts[1] ?? "00";
  return `${h.padStart(2, "0")}:${m}`;
}

export default function GuardianHome() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { academyName, academyId } = useAcademyContext();
  const { data: me } = useCurrentUser();
  const dayOfWeek = new Date().getDay();
  const { data: classes } = useClasses(dayOfWeek);
  const { data: announcementsData } = useAnnouncements(academyId);
  const { data: dependentsData, isPending: dependentsPending } = useDependents();
  const [refreshing, setRefreshing] = useState(false);

  // Redirect to onboarding if guardian has no dependents yet
  useEffect(() => {
    if (dependentsPending) return;
    const dependents = dependentsData?.items ?? [];
    if (dependents.length === 0) {
      router.replace("/(app)/(guardian)/(onboarding)/register-dependent");
    }
  }, [dependentsPending, dependentsData, router]);

  const latestAnnouncements = announcementsData?.pages[0]?.items.slice(0, 3) ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["classes", dayOfWeek] }),
      queryClient.invalidateQueries({ queryKey: ["announcements", academyId] }),
    ]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 pt-6 bg-background" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A078E8" />
        }
      >
        <View className="pb-8" style={{ paddingTop: 4, paddingHorizontal: 24, gap: 16 }}>
          {/* Academy header */}
          <View className="flex-row items-center justify-between">
            <Text
              className="font-poppins-bold text-primary"
              style={{ fontSize: 20, letterSpacing: -0.5 }}
            >
              {academyName}
            </Text>
            <View className="flex-row items-center gap-3">
              <NotificationBell />
              <Pressable onPress={() => router.push("/(app)/profile")}>
                <Avatar
                  variant="user"
                  imageUrl={me?.profileImageUrl}
                  fallbackLetter={(me?.name?.charAt(0) || "?").toUpperCase()}
                />
              </Pressable>
            </View>
          </View>

          {/* Meus Dependentes card */}
          <Pressable
            onPress={() => router.push("/(app)/(guardian)/(dependents)")}
            className="flex-row items-center gap-3 rounded-2xl border border-surface-border bg-surface p-4"
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-translucent">
              <Users size={18} color={ACCENT} />
            </View>
            <View className="min-w-0 flex-1" style={{ gap: 4 }}>
              <Text className="font-poppins-semibold text-sm text-primary">
                Meus Dependentes
              </Text>
              <Text className="font-poppins text-xs text-muted">
                Gerencie seus dependentes
              </Text>
            </View>
            <ChevronRight size={18} color={TEXT_MUTED} />
          </Pressable>

          {/* Today's classes section */}
          <View className="flex-row items-center justify-between">
            <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
              Aulas de hoje
            </Text>
            <Pressable onPress={() => router.push("/(app)/(guardian)/(classes)")}>
              <Text className="font-poppins-medium text-xs" style={{ color: ACCENT }}>
                Ver todas
              </Text>
            </Pressable>
          </View>

          <View style={{ gap: 10 }}>
            {!classes || classes.length === 0 ? (
              <View className="items-center rounded-[14px] border border-surface-border bg-surface py-8">
                <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                  Nenhuma aula agendada para hoje
                </Text>
              </View>
            ) : (
              classes.map((cls) => (
                <ClassCard
                  key={cls.id}
                  name={cls.name}
                  startTime={formatTime(cls.startTime)}
                  endTime={formatTime(cls.endTime)}
                  instructorName={cls.instructorName ?? undefined}
                  capacity={cls.capacity}
                  onPress={() =>
                    router.push(
                      `/(app)/(guardian)/(classes)/${cls.id}?sessionDate=${localDateStringForAgendaWeekday(dayOfWeek)}`,
                    )
                  }
                />
              ))
            )}
          </View>

          {/* Recent announcements */}
          {latestAnnouncements.length > 0 && (
            <>
              <View className="flex-row items-center justify-between">
                <Text
                  className="font-poppins-semibold text-sm"
                  style={{ color: TEXT_SECONDARY }}
                >
                  Últimos avisos
                </Text>
                <Pressable onPress={() => router.push("/(app)/(guardian)/(announcements)")}>
                  <Text
                    className="font-poppins-medium text-xs"
                    style={{ color: ACCENT }}
                  >
                    Ver mais
                  </Text>
                </Pressable>
              </View>
              <View style={{ gap: 10 }}>
                {latestAnnouncements.map((a) => (
                  <AnnouncementFeedCard
                    key={a.id}
                    title={a.title}
                    body={a.body}
                    createdAt={a.createdAt}
                    onPress={() =>
                      router.push(`/(app)/(guardian)/(announcements)/${a.id}`)
                    }
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
