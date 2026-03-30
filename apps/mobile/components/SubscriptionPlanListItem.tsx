import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

const TEXT_MUTED = "#525252";

export type SubscriptionPlanListItemPlan = {
  id: string;
  name: string;
  priceCents: number;
  weeklyCheckinLimit: number | null;
  recurrenceMonths: number;
};

type SubscriptionPlanListItemProps = {
  plan: SubscriptionPlanListItemPlan;
  isCurrent: boolean;
  onPress: () => void;
};

export function SubscriptionPlanListItem({
  plan,
  isCurrent,
  onPress,
}: SubscriptionPlanListItemProps) {

  function formatRecurrenceMonths(months: number): string {
    if (months === 1) return "mês";
    if (months === 3) return "trimestre";
    if (months === 6) return "semestre";
    return "ano";
  }

  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border bg-surface"
      style={{
        padding: 20,
        gap: 8,
        borderColor: isCurrent ? "#A078E8" : "#2A2A2A",
        borderWidth: isCurrent ? 2 : 1,
      }}
    >
      <View className="flex-row items-center gap-2">
        <Text className="font-poppins-semibold text-base text-primary">
          {plan.name}
        </Text>
        {isCurrent ? (
          <View
            className="rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: "#A078E820" }}
          >
            <Text
              className="font-poppins-semibold text-[10px]"
              style={{ color: "#A078E8" }}
            >
              Atual
            </Text>
          </View>
        ) : null}
        <View className="flex-1" />
        <ChevronRight size={18} color={TEXT_MUTED} />
      </View>
      <Text className="font-poppins-bold text-primary" style={{ fontSize: 22 }}>
        R$ {(plan.priceCents / 100).toFixed(0)} / {formatRecurrenceMonths(plan.recurrenceMonths)}
      </Text>
      <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
        {plan.weeklyCheckinLimit
          ? `${plan.weeklyCheckinLimit} check-ins por semana`
          : "Check-ins ilimitados"}
      </Text>
    </Pressable>
  );
}
