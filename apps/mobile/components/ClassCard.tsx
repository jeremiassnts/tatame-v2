import { View, Text } from "react-native";
import { Clock } from "lucide-react-native";

type ClassCardProps = {
  name: string;
  startTime: string;
  endTime: string;
  instructorName?: string;
};

export function ClassCard({
  name,
  startTime,
  endTime,
  instructorName,
}: ClassCardProps) {
  return (
    <View className="flex-row items-center rounded-2xl border border-surface-border bg-surface p-4">
      <View className="flex-1">
        <Text className="font-poppins-semibold text-sm text-primary">
          {name}
        </Text>
        {instructorName ? (
          <Text className="mt-0.5 font-poppins text-xs text-muted">
            {instructorName}
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-center gap-1">
        <Clock size={14} color="#ABABAB" />
        <Text className="font-poppins text-xs text-muted">
          {startTime} – {endTime}
        </Text>
      </View>
    </View>
  );
}
