import { Alert, ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { ClassDetailView } from "@/components/ClassDetailView";
import { useClass } from "@/lib/hooks/use-classes";
import { useCheckin, useClassCheckins } from "@/lib/hooks/use-checkin";
import { useMySubscription } from "@/lib/hooks/use-subscription";
import { useCurrentUser } from "@/lib/hooks/use-user";

const DAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

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

function paramToId(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].length > 0)
    return value[0];
  return undefined;
}

export default function StudentClassDetail() {
  const { classId: rawClassId } = useLocalSearchParams<{ classId: string }>();
  const classId = paramToId(rawClassId);
  const today = todayDateString();
  const { data: me } = useCurrentUser();
  const { data: cls, isLoading, isError } = useClass(classId ?? "");
  const { data: subResponse } = useMySubscription();
  const subscription = subResponse?.subscription;
  const hasSubscription =
    subscription != null && subscription.effectiveStatus === "active";
  const { data: checkins } = useClassCheckins(classId ?? "", today);
  const checkinMutation = useCheckin();

  const checkinCount = checkins?.length ?? 0;
  const checkinDone =
    me?.id != null && checkins?.some((c) => c.userId === me.id) === true;

  if (!classId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="font-poppins text-sm text-muted">Aula não encontrada</Text>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  if (isError || !cls) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="font-poppins text-sm text-muted">
          Não foi possível carregar esta aula
        </Text>
      </SafeAreaView>
    );
  }

  const handleCheckin = () => {
    if (!hasSubscription) {
      Alert.alert("Plano necessário", "Assine um plano para fazer check-in nas aulas.");
      return;
    }
    checkinMutation.mutate({ classId, date: today });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ClassDetailView
        classData={{
          id: cls.id,
          name: cls.name,
          description: cls.description,
          instructorName: cls.instructorName ?? undefined,
          dayOfWeekLabel: DAY_NAMES[cls.dayOfWeek] ?? "",
          startTime: formatTime(cls.startTime),
          endTime: formatTime(cls.endTime),
          capacity: cls.capacity,
          checkinCount,
        }}
        canCheckin
        checkinDone={checkinDone}
        checkinDisabled={!hasSubscription || checkinMutation.isPending}
        checkinDisabledReason={
          !hasSubscription ? "Assine um plano para fazer check-in nas aulas." : undefined
        }
        showCheckins={false}
        onCheckin={handleCheckin}
      />
    </SafeAreaView>
  );
}
