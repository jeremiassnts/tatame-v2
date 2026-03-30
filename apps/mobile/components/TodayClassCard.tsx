import { isWithinCheckinWindow } from "@/lib/checkin-window";
import { useClassCheckins } from "@/lib/hooks/use-checkin";
import { ClassCard } from "@/components/ClassCard";
import { useMemo } from "react";

type TodayClassCardProps = {
  classId: string;
  name: string;
  startTime: string;
  endTime: string;
  instructorName?: string | null;
  capacity?: number | null;
  userId: string | undefined;
  hasSubscription: boolean;
  checkinPending: boolean;
  sessionDate: string; // YYYY-MM-DD (same as request body.date)
  now: Date;
  onCheckin: () => void;
  onPress: () => void;
};

export function TodayClassCard({
  classId,
  name,
  startTime,
  endTime,
  instructorName,
  capacity,
  userId,
  hasSubscription,
  checkinPending,
  sessionDate,
  now,
  onCheckin,
  onPress,
}: TodayClassCardProps) {
  const { data: checkins } = useClassCheckins(classId, sessionDate, {
    enabled: Boolean(classId) && Boolean(sessionDate),
  });

  const { checkinDone, checkinCount, withinWindow } = useMemo(() => {
    const list = checkins ?? [];
    const count = list.length;
    const done = userId ? list.some((c) => c.userId === userId) : false;
    const within = isWithinCheckinWindow(now, sessionDate, startTime, endTime);
    return { checkinDone: done, checkinCount: count, withinWindow: within };
  }, [checkins, userId, now, sessionDate, startTime, endTime]);

  const checkinDisabled =
    !hasSubscription || checkinPending || checkinDone || !withinWindow;

  return (
    <ClassCard
      name={name}
      startTime={startTime}
      endTime={endTime}
      instructorName={instructorName ?? undefined}
      capacity={capacity}
      checkinCount={capacity != null ? checkinCount : undefined}
      showCheckinButton
      onCheckin={onCheckin}
      checkinDisabled={checkinDisabled}
      checkinLabel={checkinDone ? "Check-in realizado" : "Check-in"}
      onPress={onPress}
    />
  );
}

