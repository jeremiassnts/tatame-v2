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
  dependentIds: string[];
  isGuardian: boolean;
  hasSubscription: boolean;
  checkinPending: boolean;
  sessionDate: string;
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
  dependentIds,
  isGuardian,
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

  const { allCheckedIn, checkinCount, withinWindow } = useMemo(() => {
    const list = checkins ?? [];
    const count = list.length;
    const within = isWithinCheckinWindow(now, sessionDate, startTime, endTime);

    if (!userId) return { allCheckedIn: false, checkinCount: count, withinWindow: within };

    const checkedDependentIds = new Set(
      list.filter((c) => c.dependentId).map((c) => c.dependentId),
    );
    const selfCheckedIn = list.some((c) => c.userId === userId && !c.dependentId);

    let allDone: boolean;
    if (isGuardian) {
      allDone = dependentIds.length > 0 && dependentIds.every((id) => checkedDependentIds.has(id));
    } else if (dependentIds.length > 0) {
      allDone = selfCheckedIn && dependentIds.every((id) => checkedDependentIds.has(id));
    } else {
      allDone = selfCheckedIn;
    }

    return { allCheckedIn: allDone, checkinCount: count, withinWindow: within };
  }, [checkins, userId, dependentIds, isGuardian, now, sessionDate, startTime, endTime]);

  const checkinDisabled =
    !hasSubscription || checkinPending || allCheckedIn || !withinWindow;

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
      checkinLabel={allCheckedIn ? "Check-in realizado" : "Check-in"}
      onPress={onPress}
    />
  );
}

