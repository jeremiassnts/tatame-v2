import { Check } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

type Props = {
  title: string;
  description: string;
  price: string;
  period: string;
  features: readonly string[];
  ctaLabel: string;
  badgeLabel?: string;
  variant: "neutral" | "accent";
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

function FeatureItem({ text }: { text: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 8 }}>
      <Check size={16} color="#32D74B" />
      <Text className="font-poppins text-sm text-primary">{text}</Text>
    </View>
  );
}

export function PlanCard({
  title,
  description,
  price,
  period,
  features,
  ctaLabel,
  badgeLabel,
  variant,
  disabled,
  loading,
  onPress,
}: Props) {
  const isAccent = variant === "accent";

  return (
    <View
      className={isAccent ? "rounded-2xl border-2 bg-surface" : "rounded-2xl border border-surface-border bg-surface"}
      style={{ padding: 20, gap: 16, borderColor: isAccent ? "#A078E8" : undefined }}
    >
      {badgeLabel ? (
        <View
          className="self-start rounded-full"
          style={{
            paddingHorizontal: 12,
            paddingVertical: 4,
            backgroundColor: "#A078E8",
          }}
        >
          <Text className="font-poppins-bold text-[10px] text-white">{badgeLabel}</Text>
        </View>
      ) : null}

      <View style={{ gap: 4 }}>
        <Text className="font-poppins-bold text-lg text-primary">{title}</Text>
        <Text className="font-poppins text-xs" style={{ color: "#ABABAB" }}>
          {description}
        </Text>
      </View>

      <View className="flex-row items-baseline" style={{ gap: 4 }}>
        <Text className="font-poppins-bold text-3xl text-primary">{price}</Text>
        <Text className="font-poppins text-sm" style={{ color: "#ABABAB" }}>
          {period}
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {features.map((text) => (
          <FeatureItem key={text} text={text} />
        ))}
      </View>

      <Pressable
        onPress={onPress}
        disabled={disabled}
        className="items-center rounded-xl"
        style={{
          paddingVertical: 14,
          backgroundColor: isAccent ? "#A078E8" : "#FFF",
        }}
      >
        {loading ? (
          <ActivityIndicator color={isAccent ? "#FFF" : "#000"} />
        ) : (
          <Text className={isAccent ? "font-poppins-semibold text-sm text-white" : "font-poppins-semibold text-sm text-black"}>
            {ctaLabel}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

