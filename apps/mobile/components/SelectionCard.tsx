import { User } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

const BELT_COLORS: Record<string, string> = {
  white: "#FFFFFF",
  blue: "#2962FF",
  purple: "#9C27B0",
  brown: "#795548",
  black: "#212121",
  yellow: "#FFD60A",
};

const BELT_LABELS: Record<string, string> = {
  white: "Branca",
  blue: "Azul",
  purple: "Roxa",
  brown: "Marrom",
  black: "Preta",
  yellow: "Amarela",
};

export type SelectionCardProps = {
  name: string;
  initials?: string;
  avatarBg: string;
  iconColor?: string;
  belt?: string | null;
  stripes?: number | null;
  subscriptionStatus?: string | null;
  onPress: () => void;
};

export function SelectionCard({
  name,
  initials,
  avatarBg,
  iconColor,
  belt,
  stripes,
  subscriptionStatus,
  onPress,
}: SelectionCardProps) {
  const beltColor = belt ? (BELT_COLORS[belt] ?? "#FFFFFF") : null;
  const beltLabel = belt ? (BELT_LABELS[belt] ?? belt) : null;
  const beltSub =
    beltLabel && stripes != null && stripes > 0
      ? `${beltLabel} · ${stripes} ${stripes === 1 ? "grau" : "graus"}`
      : beltLabel;

  let badgeBg: string | undefined;
  let badgeText: string | undefined;
  let badgeLabel: string | undefined;
  if (subscriptionStatus !== undefined) {
    if (subscriptionStatus === "active") {
      badgeBg = "#32D74B20";
      badgeText = "#32D74B";
      badgeLabel = "Ativa";
    } else if (subscriptionStatus === "expired") {
      badgeBg = "#FF453A20";
      badgeText = "#FF453A";
      badgeLabel = "Expirado";
    } else {
      badgeBg = "#FF453A20";
      badgeText = "#FF453A";
      badgeLabel = "Sem plano";
    }
  }

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-[14px] p-4 bg-[#242424] gap-3"
      style={({ pressed }) => ({
        backgroundColor: pressed ? "#2E2E2E" : "#242424",
        gap: 14,
      })}
    >
      {/* Avatar */}
      <View
        className="h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: avatarBg }}
      >
        {initials ? (
          <Text className="font-poppins-bold text-sm text-white">{initials}</Text>
        ) : (
          <User size={20} color={iconColor ?? "#FFFFFF"} />
        )}
      </View>

      {/* Name + belt */}
      <View className="flex-1">
        <Text className="font-poppins-semibold text-[15px] text-white" numberOfLines={1}>
          {name}
        </Text>
        {beltSub ? (
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: beltColor ?? "#666" }}
            />
            <Text className="font-poppins text-[13px] text-muted">{beltSub}</Text>
          </View>
        ) : null}
      </View>

      {/* Subscription badge */}
      {badgeLabel ? (
        <View className="rounded-md px-2 py-[3px]" style={{ backgroundColor: badgeBg }}>
          <Text className="font-poppins-semibold text-[11px]" style={{ color: badgeText }}>
            {badgeLabel}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
