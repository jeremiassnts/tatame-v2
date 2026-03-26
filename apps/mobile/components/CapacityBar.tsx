import { Text, View } from "react-native";

type CapacityBarProps = {
  current: number;
  max: number | null;
};

/** Label color from design.pen "Capacity Bar" (node 7yXlD / parent jon0a). */
const CAP_LABEL = "#525252";
/** Track fill from design (capTrack #242424). */
const CAP_TRACK = "#242424";

function getBarColor(ratio: number): string {
  if (ratio < 0.6) return "#4ADE80";
  if (ratio < 0.85) return "#FFD60A";
  return "#F87171";
}

export function CapacityBar({ current, max }: CapacityBarProps) {
  if (max === null) {
    return (
      <View style={{ gap: 6 }}>
        <View className="flex-row items-center justify-between">
          <Text className="font-poppins-medium text-xs" style={{ color: CAP_LABEL }}>
            Ocupação
          </Text>
          <Text className="font-poppins-bold text-xs text-primary">
            {current} alunos
          </Text>
        </View>
      </View>
    );
  }

  const ratio = max > 0 ? current / max : 0;
  const percentage = Math.min(ratio * 100, 100);
  const color = getBarColor(ratio);

  return (
    <View style={{ gap: 6 }}>
      <View className="flex-row items-center justify-between">
        <Text className="font-poppins-medium text-xs" style={{ color: CAP_LABEL }}>
          Ocupação
        </Text>
        <Text className="font-poppins-bold text-xs" style={{ color }}>
          {current}/{max}
        </Text>
      </View>
      <View
        className="w-full overflow-hidden rounded-[3px]"
        style={{ height: 6, backgroundColor: CAP_TRACK }}
      >
        <View
          className="h-full rounded-[3px]"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}
