import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { BELT_LABELS_SHORT, getBeltColor } from "@/lib/belts";
import { Pressable, Text, View } from "react-native";

type MemberCardProps = {
  name: string;
  role: string;
  status: string;
  profileImageUrl: string | null;
  belt?: string | null;
  stripes?: number | null;
  subtitle?: string | null;
  onPress?: () => void;
};

function formatBeltLabel(belt?: string | null, stripes?: number | null) {
  if (!belt) return null;
  const beltLabel = BELT_LABELS_SHORT[belt as keyof typeof BELT_LABELS_SHORT] ?? belt;
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
  subtitle,
  onPress,
}: MemberCardProps) {
  const letter = (name || "?").charAt(0).toUpperCase();
  const isInteractive = typeof onPress === "function";
  const beltLabel = formatBeltLabel(belt, stripes);
  const beltColor = getBeltColor(belt as never);

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
        {subtitle ? (
          <Text className="font-poppins text-xs text-muted">{subtitle}</Text>
        ) : null}
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
