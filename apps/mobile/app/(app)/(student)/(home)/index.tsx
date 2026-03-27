import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell, ChevronRight, CreditCard, TriangleAlert } from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { ClassCard } from "@/components/ClassCard";
import { useAcademyContext } from "@/lib/academy-context";
import { useClasses } from "@/lib/hooks/use-classes";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useMySubscription } from "@/lib/hooks/use-subscription";
import { useMyGraduation } from "@/lib/hooks/use-graduation";
import { useCheckin } from "@/lib/hooks/use-checkin";
import { useQueryClient } from "@tanstack/react-query";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";

const BELT_COLORS: Record<string, string> = {
  white: "#E0E0E0",
  blue: "#2196F3",
  purple: "#9C27B0",
  brown: "#795548",
  black: "#212121",
};

const BELT_LABELS: Record<string, string> = {
  white: "Branca",
  blue: "Azul",
  purple: "Roxa",
  brown: "Marrom",
  black: "Preta",
};

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
  const { data: graduation } = useMyGraduation();
  const checkin = useCheckin();
  const [refreshing, setRefreshing] = useState(false);

  const hasSubscription =
    subscription != null && subscription.effectiveStatus === "active";
  const today = todayDateString();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["classes", dayOfWeek] }),
      queryClient.invalidateQueries({ queryKey: ["subscription", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["graduation", "me"] }),
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
            <View style={{ gap: 2 }}>
              <Text
                className="font-poppins-bold text-primary"
                style={{ fontSize: 20, letterSpacing: -0.5 }}
              >
                {academyName}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface">
                <Bell size={18} color="#FFFFFF" />
              </Pressable>
              <Pressable onPress={() => router.push("/(app)/profile")}>
                <Avatar
                  variant="user"
                  imageUrl={me?.profileImageUrl}
                  fallbackLetter={(me?.name?.charAt(0) || "?").toUpperCase()}
                />
              </Pressable>
            </View>
          </View>

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
            <View
              className="flex-1 rounded-2xl border border-surface-border bg-surface"
              style={{ padding: 16, gap: 12 }}
            >
              <Text className="font-poppins-semibold text-xs text-muted">Faixa atual</Text>
              {graduation ? (
                <View className="flex-row items-center gap-2">
                  <View
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: BELT_COLORS[graduation.belt] ?? "#666" }}
                  />
                  <Text className="font-poppins-semibold text-sm text-primary">
                    {BELT_LABELS[graduation.belt] ?? graduation.belt}
                  </Text>
                  <Text className="font-poppins text-xs text-muted">
                    {graduation.stripes} graus
                  </Text>
                </View>
              ) : (
                <Text className="font-poppins text-sm text-muted">Não registrada</Text>
              )}
            </View>
            <View
              className="flex-1 rounded-2xl border border-surface-border bg-surface"
              style={{ padding: 16, gap: 4 }}
            >
              <Text className="font-poppins-semibold text-xs text-muted">Check-ins</Text>
              <Text className="font-poppins-bold text-primary" style={{ fontSize: 28 }}>
                0
              </Text>
              <Text className="font-poppins text-xs text-muted">esta semana</Text>
            </View>
          </View>

          <Pressable className="flex-row items-center gap-3 rounded-2xl border border-surface-border bg-surface p-4">
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
                <ClassCard
                  key={cls.id}
                  name={cls.name}
                  startTime={formatTime(cls.startTime)}
                  endTime={formatTime(cls.endTime)}
                  instructorName={cls.instructorName ?? undefined}
                  capacity={cls.capacity}
                  showCheckinButton
                  onCheckin={() => handleCheckin(cls.id)}
                  checkinDisabled={!hasSubscription || checkin.isPending}
                  checkinLabel="Check-in"
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
