import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Pressable, Text, View } from "react-native";

type MemberCardProps = {
  name: string;
  role: string;
  status: string;
  profileImageUrl: string | null;
  onPress: () => void;
};

export function MemberCard({
  name,
  role,
  status,
  profileImageUrl,
  onPress,
}: MemberCardProps) {
  const letter = (name || "?").charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-surface-border bg-surface px-4 py-3"
    >
      <Avatar variant="user" imageUrl={profileImageUrl} fallbackLetter={letter} />
      <View className="min-w-0 flex-1" style={{ gap: 4 }}>
        <Text className="font-poppins-semibold text-sm text-primary">{name}</Text>
        <View className="flex-row gap-1.5">
          <Badge variant="role" value={role} />
          <Badge variant="status" value={status} />
        </View>
      </View>
    </Pressable>
  );
}
