import { ClassDetailView } from "@/components/ClassDetailView";
import { useCheckin, useClassCheckins } from "@/lib/hooks/use-checkin";
import { useClass } from "@/lib/hooks/use-classes";
import { useMySubscription } from "@/lib/hooks/use-subscription";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { isWithinCheckinWindow } from "@/lib/checkin-window";
import {
  parseSessionDateParam,
  resolveClassSessionDate,
} from "@/lib/class-session-date";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

function paramToId(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].length > 0)
    return value[0];
  return undefined;
}

export default function StudentClassDetail() {
  const { classId: rawClassId, sessionDate: rawSessionDate } =
    useLocalSearchParams<{ classId: string; sessionDate?: string }>();
  const classId = paramToId(rawClassId);
  const sessionDateFromParam = parseSessionDateParam(rawSessionDate);
  const { data: me } = useCurrentUser();
  const { data: cls, isLoading, isError } = useClass(classId ?? "");
  const { data: subResponse } = useMySubscription();
  const subscription = subResponse?.subscription;
  const hasSubscription =
    subscription != null && subscription.effectiveStatus === "active";

  const sessionDate =
    cls != null
      ? resolveClassSessionDate(sessionDateFromParam, cls.dayOfWeek)
      : sessionDateFromParam ?? "";

  const { data: checkins } = useClassCheckins(classId ?? "", sessionDate, {
    enabled:
      Boolean(classId) &&
      Boolean(sessionDate) &&
      (sessionDateFromParam != null || cls != null),
  });
  const checkinMutation = useCheckin();

  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
    }, []),
  );
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const withinCheckinWindow =
    cls != null && Boolean(sessionDate)
      ? isWithinCheckinWindow(now, sessionDate, cls.startTime, cls.endTime)
      : false;

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
    if (
      !cls ||
      !isWithinCheckinWindow(new Date(), sessionDate, cls.startTime, cls.endTime)
    ) {
      return;
    }
    checkinMutation.mutate({ classId, date: sessionDate });
  };

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
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
        checkinDisabled={!hasSubscription || !withinCheckinWindow}
        checkinPending={checkinMutation.isPending}
        checkinDisabledReason={
          !hasSubscription
            ? "Assine um plano para fazer check-in nas aulas."
            : !withinCheckinWindow
              ? "O check-in abre 12 horas antes do início da aula e encerra ao fim da aula."
              : undefined
        }
        showCheckins={false}
        onCheckin={handleCheckin}
      />
    </SafeAreaView>
  );
}
