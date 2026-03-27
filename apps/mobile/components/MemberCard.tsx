import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Pressable, Text, View } from "react-native";

type MemberCardProps = {
  name: string;
  role: string;
  status: string;
  profileImageUrl: string | null;
  belt?: string | null;
  stripes?: number | null;
  onPress?: () => void;
};

const BELT_LABELS: Record<string, string> = {
  white: "Branca",
  blue: "Azul",
  purple: "Roxa",
  brown: "Marrom",
  black: "Preta",
};

const BELT_COLORS: Record<string, string> = {
  white: "#E5E7EB",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  brown: "#92400E",
  black: "#111827",
};

function formatBeltLabel(belt?: string | null, stripes?: number | null) {
  if (!belt) return null;
  const beltLabel = BELT_LABELS[belt] ?? belt;
  if (typeof stripes !== "number" || stripes <= 0) {
    return beltLabel;
  }
  const stripeLabel = stripes === 1 ? "grau" : "graus";
  return `${beltLabel} • ${stripes} ${stripeLabel}`;
}

export function MemberCard({
  name,
  role,
  status,
  profileImageUrl,
  belt,
  stripes,
  onPress,
}: MemberCardProps) {
  const letter = (name || "?").charAt(0).toUpperCase();
  const isInteractive = typeof onPress === "function";
  const beltLabel = formatBeltLabel(belt, stripes);
  const beltColor = belt ? (BELT_COLORS[belt] ?? "#525252") : "#525252";

  return (
    <Pressable
      onPress={onPress}
      disabled={!isInteractive}
      className="flex-row items-center gap-3 rounded-2xl border border-surface-border bg-surface px-4 py-3"
    >
      <Avatar variant="user" imageUrl={profileImageUrl} fallbackLetter={letter} />
      <View className="min-w-0 flex-1" style={{ gap: 4 }}>
        <View className="flex-row items-center justify-between gap-2">
          <Text className="min-w-0 flex-1 font-poppins-semibold text-sm text-primary">
            {name}
          </Text>
          <Badge variant="role" value={role} />
        </View>
        <View className="flex-row items-center gap-1.5">
          {beltLabel ? (
            <View className="flex-row items-center gap-1.5">
              <View
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: beltColor }}
              />
              <Text className="font-poppins text-xs text-muted">{beltLabel}</Text>
            </View>
          ) : null}
          <Badge variant="status" value={status} />
        </View>
      </View>
    </Pressable>
  );
}
