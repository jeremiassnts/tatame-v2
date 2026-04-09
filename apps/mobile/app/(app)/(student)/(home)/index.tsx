import { Avatar } from "@/components/Avatar";
import { GraduationCard } from "@/components/GraduationCard";
import { TodayClassCard } from "@/components/TodayClassCard";
import { useAcademyContext } from "@/lib/academy-context";
import { useCheckin, useWeeklyCheckinCount } from "@/lib/hooks/use-checkin";
import { useClasses } from "@/lib/hooks/use-classes";
import { useMyGraduation } from "@/lib/hooks/use-graduation";
import { useMyPayments, useMySubscription } from "@/lib/hooks/use-subscription";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ChevronRight, CreditCard, TriangleAlert } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";

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

export default function StudentHome() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { academyName } = useAcademyContext();
  const { data: me } = useCurrentUser();
  const dayOfWeek = new Date().getDay();
  const { data: classes } = useClasses(dayOfWeek);
  const { data: subResponse } = useMySubscription();
  const subscription = subResponse?.subscription;
  const plan = subResponse?.plan;
  const { data: payments } = useMyPayments();
  const { data: graduation } = useMyGraduation();
  const checkin = useCheckin();
  const { data: weeklyCount } = useWeeklyCheckinCount();
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const hasSubscription =
    subscription != null && subscription.effectiveStatus === "active";
  const today = todayDateString();
  const currentMonth = today.slice(0, 7) + "-01";
  const hasPendingPayment =
    hasSubscription && payments != null && !payments.some((p) => p.referenceMonth === currentMonth);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["classes", dayOfWeek] }),
      queryClient.invalidateQueries({ queryKey: ["subscription", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["graduation", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["checkins", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["checkins"] }),
    ]);
    setRefreshing(false);
  };

  const handleCheckin = (classId: string) => {
    if (!hasSubscription) {
      Alert.alert(
        "Plano necessário",
        "Assine um plano para fazer check-in nas aulas.",
      );
      return;
    }
    checkin.mutate({ classId, date: today });
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
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => router.push("/(app)/(student)/(home)/academy-info")}
              style={{ gap: 2 }}
            >
              <Text
                className="font-poppins-bold text-primary"
                style={{ fontSize: 20, letterSpacing: -0.5 }}
              >
                {academyName}
              </Text>
            </Pressable>
            <View className="flex-row items-center gap-2">
              <Pressable onPress={() => router.push("/(app)/profile")}>
                <Avatar
                  variant="user"
                  imageUrl={me?.profileImageUrl}
                  fallbackLetter={(me?.name?.charAt(0) || "?").toUpperCase()}
                />
              </Pressable>
            </View>
          </View>

          {hasPendingPayment && (
            <Pressable
              onPress={() => router.push("/(app)/(student)/(subscription)")}
              className="flex-row items-center rounded-2xl border border-surface-border bg-surface"
              style={{ padding: 14, gap: 12 }}
            >
              <View
                className="items-center justify-center rounded-lg"
                style={{ width: 36, height: 36, backgroundColor: "#FF950020" }}
              >
                <TriangleAlert size={18} color="#FF9500" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text className="font-poppins-semibold text-[13px] text-primary">
                  Pagamento pendente
                </Text>
                <Text className="font-poppins text-[11px]" style={{ color: TEXT_SECONDARY }}>
                  Toque aqui para realizar o pagamento
                </Text>
              </View>
              <ChevronRight size={16} color={TEXT_MUTED} />
            </Pressable>
          )}

          {!hasSubscription ? (
            <View
              className="flex-row items-center gap-2.5 rounded-xl px-4 py-3"
              style={{ backgroundColor: "#FF9F0A20" }}
            >
              <TriangleAlert size={18} color="#FF9F0A" />
              <Text className="flex-1 font-poppins text-[13px] text-primary">
                Você precisa assinar um plano para treinar.
              </Text>
            </View>
          ) : null}

          <View className="flex-row" style={{ gap: 12 }}>
            <GraduationCard
              graduation={graduation}
              variant="compact"
              onRegisterPress={() => router.push("/(app)/(student)/register-belt")}
            />
            <View
              className="flex-1 rounded-2xl border border-surface-border bg-surface"
              style={{ padding: 16, gap: 4 }}
            >
              <Text className="font-poppins-semibold text-xs text-muted">Check-ins</Text>
              <Text className="font-poppins-bold text-primary" style={{ fontSize: 28 }}>
                {weeklyCount?.count ?? 0}
              </Text>
              <Text className="font-poppins text-xs text-muted">esta semana</Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.push("/(app)/(student)/(subscription)")}
            className="flex-row items-center gap-3 rounded-2xl border border-surface-border bg-surface p-4"
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-translucent">
              <CreditCard size={18} color="#A078E8" />
            </View>
            <View className="min-w-0 flex-1" style={{ gap: 4 }}>
              {plan && subscription ? (
                <>
                  <Text className="font-poppins-semibold text-sm text-primary">{plan.name}</Text>
                  <Text className="font-poppins text-xs text-muted">
                    Válido até{" "}
                    {subscription.expiresAt.slice(0, 10).split("-").reverse().join("/")}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="font-poppins-semibold text-sm text-primary">
                    Nenhum plano ativo
                  </Text>
                  <Text className="font-poppins text-xs text-muted">
                    Assine um plano para treinar
                  </Text>
                </>
              )}
            </View>
            <ChevronRight size={18} color={TEXT_MUTED} />
          </Pressable>

          <View className="flex-row items-center justify-between">
            <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
              Aulas de hoje
            </Text>
            <Pressable onPress={() => router.push("/(app)/(student)/(classes)")}>
              <Text className="font-poppins-medium text-xs" style={{ color: "#A078E8" }}>
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
                <TodayClassCard
                  key={cls.id}
                  classId={cls.id}
                  name={cls.name}
                  startTime={formatTime(cls.startTime)}
                  endTime={formatTime(cls.endTime)}
                  instructorName={cls.instructorName ?? undefined}
                  capacity={cls.capacity}
                  userId={me?.id}
                  hasSubscription={hasSubscription}
                  checkinPending={checkin.isPending}
                  sessionDate={today}
                  now={now}
                  onCheckin={() => handleCheckin(cls.id)}
                  onPress={() => router.push(`/(app)/(student)/(classes)/${cls.id}`)}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
