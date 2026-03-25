import { useAcademyContext } from "@/lib/academy-context";
import { useApi } from "@/lib/api";
import { useAcademy, useAcademyStats } from "@/lib/hooks/use-academy";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Calendar,
  ChevronRight,
  CreditCard,
  Grid3x3,
  UserPlus
} from "lucide-react-native";
import { useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";
const BORDER_STRONG = "#3A3A3A";
const WARNING = "#FFD60A";

type ClassItem = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
};

function greetingPrefix(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia,";
  if (h < 18) return "Boa tarde,";
  return "Boa noite,";
}

function firstName(fullName: string): string {
  const t = fullName.trim();
  if (!t) return "";
  return t.split(/\s+/)[0] ?? t;
}

function formatTime(t: string) {
  const parts = t.split(":");
  const h = parts[0] ?? "0";
  const m = parts[1] ?? "00";
  return `${h.padStart(2, "0")}:${m}`;
}

function DashboardClassRow({
  name,
  startTime,
  endTime,
}: {
  name: string;
  startTime: string;
  endTime: string;
}) {
  return (
    <Pressable className="flex-row items-center gap-3.5 rounded-[14px] border border-surface-border bg-surface p-3.5">
      <View className="w-[52px] items-center" style={{ gap: 2 }}>
        <Text
          className="font-poppins-semibold text-primary"
          style={{ fontSize: 14 }}
        >
          {startTime}
        </Text>
        <Text className="font-poppins text-[11px]" style={{ color: TEXT_MUTED }}>
          {endTime}
        </Text>
      </View>
      <View
        className="h-9 w-px"
        style={{ backgroundColor: BORDER_STRONG }}
      />
      <View className="min-w-0 flex-1" style={{ gap: 3 }}>
        <Text className="font-poppins-semibold text-sm text-primary">
          {name}
        </Text>
      </View>
      <ChevronRight size={18} color={TEXT_MUTED} />
    </Pressable>
  );
}

export default function ManagerDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { academyId, academyName, academyLogoUrl } = useAcademyContext();
  const { data: me } = useCurrentUser();
  const { data: academy } = useAcademy(academyId);
  const { data: stats } = useAcademyStats(academyId);
  const [refreshing, setRefreshing] = useState(false);

  const dayOfWeek = new Date().getDay();
  const api = useApi();
  const { data: classesData } = useQuery({
    queryKey: ["classes", academyId, dayOfWeek],
    queryFn: () =>
      api.get<{ items: ClassItem[] }>(`/classes?dayOfWeek=${dayOfWeek}`),
  });

  const todayClasses = classesData?.items?.slice(0, 3) ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["academy-stats", academyId] }),
      queryClient.invalidateQueries({ queryKey: ["academy", academyId] }),
      queryClient.invalidateQueries({
        queryKey: ["classes", academyId, dayOfWeek],
      }),
    ]);
    setRefreshing(false);
  };

  const managerFirst = firstName(me?.name ?? "");
  const avatarLetter = (managerFirst || me?.name || "?").charAt(0).toUpperCase();
  const addressLine =
    academy?.address?.trim() || "Endereço não informado";

  return (
    <SafeAreaView className="flex-1 pt-6 bg-background" edges={["top"]}>
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
        <View
          className="pb-8"
          style={{ paddingTop: 4, paddingHorizontal: 24, gap: 24 }}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
                {greetingPrefix()}
              </Text>
              <Text
                className="font-poppins-bold text-primary"
                style={{ fontSize: 22, letterSpacing: -0.5 }}
              >
                {managerFirst || "Gestor"}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <LinearGradient
                colors={["#A078E8", "#7C5CBF"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text className="font-poppins-semibold text-lg text-white">
                  {avatarLetter}
                </Text>
              </LinearGradient>
            </View>
          </View>

          <View
            className="rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 20, gap: 16 }}
          >
            <View className="flex-row items-center gap-3">
              {academyLogoUrl ? (
                <Image
                  source={{ uri: academyLogoUrl }}
                  className="h-11 w-11"
                  style={{ borderRadius: 12 }}
                />
              ) : (
                <LinearGradient
                  colors={["#A078E8", "#7C5CBF"]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Grid3x3 size={22} color="#FFFFFF" />
                </LinearGradient>
              )}
              <View className="min-w-0 flex-1" style={{ gap: 2 }}>
                <Text className="font-poppins-semibold text-base text-primary">
                  {academyName}
                </Text>
                <Text
                  className="font-poppins text-xs"
                  style={{ color: TEXT_SECONDARY }}
                  numberOfLines={2}
                >
                  {addressLine}
                </Text>
              </View>
            </View>

            <View className="h-px w-full bg-surface-border" />

            <View className="flex-row">
              <View className="flex-1 items-center" style={{ gap: 4 }}>
                <Text
                  className="font-poppins-bold text-primary"
                  style={{ fontSize: 22 }}
                >
                  {stats?.activeMembers ?? 0}
                </Text>
                <Text
                  className="font-poppins text-center text-[11px]"
                  style={{ color: TEXT_SECONDARY }}
                >
                  Membros
                </Text>
              </View>
              <View className="flex-1 items-center" style={{ gap: 4 }}>
                <Text className="font-poppins-bold text-[22px]" style={{ color: WARNING }}>
                  {stats?.pendingRequests ?? 0}
                </Text>
                <Text
                  className="font-poppins text-center text-[11px]"
                  style={{ color: TEXT_SECONDARY }}
                >
                  Pendentes
                </Text>
              </View>
              <View className="flex-1 items-center" style={{ gap: 4 }}>
                <Text
                  className="font-poppins-bold text-primary"
                  style={{ fontSize: 22 }}
                >
                  {stats?.classesToday ?? 0}
                </Text>
                <Text
                  className="font-poppins text-center text-[11px]"
                  style={{ color: TEXT_SECONDARY }}
                >
                  Aulas hoje
                </Text>
              </View>
              <View className="flex-1 items-center" style={{ gap: 4 }}>
                <Text
                  className="font-poppins-bold text-primary"
                  style={{ fontSize: 22 }}
                >
                  {stats?.activePlans ?? 0}
                </Text>
                <Text
                  className="font-poppins text-center text-[11px]"
                  style={{ color: TEXT_SECONDARY }}
                >
                  Planos
                </Text>
              </View>
            </View>
          </View>

          <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
            Ações rápidas
          </Text>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => router.push("/(app)/(manager)/(members)")}
              className="min-w-0 flex-1 rounded-[14px] border border-surface-border bg-surface"
              style={{ padding: 16, gap: 10 }}
            >
              <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-accent-translucent">
                <UserPlus size={18} color="#A078E8" />
              </View>
              <Text
                className="font-poppins-medium text-xs text-primary"
                style={{ lineHeight: 16 }}
              >
                {"Solicitações\npendentes"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(app)/(manager)/(classes)")}
              className="min-w-0 flex-1 rounded-[14px] border border-surface-border bg-surface"
              style={{ padding: 16, gap: 10 }}
            >
              <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-accent-translucent">
                <Calendar size={18} color="#A078E8" />
              </View>
              <Text
                className="font-poppins-medium text-xs text-primary"
                style={{ lineHeight: 16 }}
              >
                {"Agenda\nde hoje"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(app)/(manager)/(more)")}
              className="min-w-0 flex-1 rounded-[14px] border border-surface-border bg-surface"
              style={{ padding: 16, gap: 10 }}
            >
              <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-accent-translucent">
                <CreditCard size={18} color="#A078E8" />
              </View>
              <Text
                className="font-poppins-medium text-xs text-primary"
                style={{ lineHeight: 16 }}
              >
                {"Pagamentos\npendentes"}
              </Text>
            </Pressable>
          </View>

          <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
            Aulas de hoje
          </Text>

          <View style={{ gap: 10 }}>
            {todayClasses.length === 0 ? (
              <View className="items-center rounded-[14px] border border-surface-border bg-surface py-8">
                <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                  Nenhuma aula agendada para hoje
                </Text>
              </View>
            ) : (
              todayClasses.map((cls) => (
                <DashboardClassRow
                  key={cls.id}
                  name={cls.name}
                  startTime={formatTime(cls.startTime)}
                  endTime={formatTime(cls.endTime)}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
