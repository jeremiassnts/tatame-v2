import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

const TEXT_MUTED = "#525252";
const BORDER_STRONG = "#3A3A3A";

type ClassCardProps = {
  name: string;
  startTime: string;
  endTime: string;
  instructorName?: string;
  capacity?: number | null;
  checkinCount?: number;
  onPress?: () => void;
  showCheckinButton?: boolean;
  onCheckin?: () => void;
  checkinDisabled?: boolean;
  checkinLabel?: string;
};

export function ClassCard({
  name,
  startTime,
  endTime,
  instructorName,
  capacity,
  checkinCount,
  onPress,
  showCheckinButton,
  onCheckin,
  checkinDisabled,
  checkinLabel = "Check-in",
}: ClassCardProps) {
  const spotsText =
    capacity != null && checkinCount != null
      ? `${checkinCount}/${capacity} alunos`
      : capacity != null
        ? `${capacity} vagas`
        : undefined;

  const infoLine = [instructorName, spotsText].filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3.5 rounded-[14px] border border-surface-border bg-surface p-3.5"
    >
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
      <View className="h-9 w-px" style={{ backgroundColor: BORDER_STRONG }} />
      <View className="min-w-0 flex-1" style={{ gap: 3 }}>
        <Text className="font-poppins-semibold text-sm text-primary">
          {name}
        </Text>
        {infoLine ? (
          <Text
            className="font-poppins text-xs"
            style={{ color: "#8A8A8A" }}
            numberOfLines={1}
          >
            {infoLine}
          </Text>
        ) : null}
      </View>
      {showCheckinButton ? (
        <Pressable
          onPress={onCheckin}
          disabled={checkinDisabled}
          className={`rounded-lg px-3 py-1.5 ${checkinDisabled ? "bg-[#3A3A3A]" : "bg-accent"}`}
        >
          <Text
            className={`font-poppins-semibold text-xs ${checkinDisabled ? "text-muted" : "text-white"}`}
          >
            {checkinLabel}
          </Text>
        </Pressable>
      ) : (
        <ChevronRight size={18} color={TEXT_MUTED} />
      )}
    </Pressable>
  );
}
