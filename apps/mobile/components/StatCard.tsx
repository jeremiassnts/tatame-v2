import { View, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";

type StatCardProps = {
  icon: LucideIcon;
  count: number;
  label: string;
};

export function StatCard({ icon: Icon, count, label }: StatCardProps) {
  return (
    <View className="flex-1 rounded-2xl border border-surface-border bg-surface p-4">
      <Icon size={20} color="#A078E8" />
      <Text
        className="mt-2 font-poppins-bold text-primary"
        style={{ fontSize: 24 }}
      >
        {count}
      </Text>
      <Text className="font-poppins text-xs text-muted">{label}</Text>
    </View>
  );
}
