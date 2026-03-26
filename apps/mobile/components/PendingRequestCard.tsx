import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Check, X } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

type PendingRequestCardProps = {
  name: string;
  role: string;
  createdAt: string;
  profileImageUrl?: string | null;
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) return "há poucos minutos";
  if (hours < 24) return `há ${hours} hora${hours > 1 ? "s" : ""}`;

  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}

export function PendingRequestCard({
  name,
  role,
  createdAt,
  profileImageUrl,
  onApprove,
  onReject,
  isLoading,
}: PendingRequestCardProps) {
  const letter = (name || "?").charAt(0).toUpperCase();

  return (
    <View
      className="rounded-2xl border border-surface-border bg-surface"
      style={{ padding: 16, gap: 14 }}
    >
      <View className="flex-row items-center gap-3">
        <Avatar variant="user" imageUrl={profileImageUrl} fallbackLetter={letter} />
        <View className="min-w-0 flex-1" style={{ gap: 4 }}>
          <Text className="font-poppins-semibold text-base text-primary">{name}</Text>
          <View className="flex-row items-center gap-2">
            <Badge variant="role" value={role} />
            <Text className="font-poppins text-xs" style={{ color: "#525252" }}>
              {timeAgo(createdAt)}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row gap-3">
        <Pressable
          onPress={onReject}
          disabled={isLoading}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-red-500/30 py-2.5"
          style={{ backgroundColor: "#3A1A1A" }}
        >
          <X size={14} color="#F87171" />
          <Text className="font-poppins-semibold text-sm" style={{ color: "#F87171" }}>
            Rejeitar
          </Text>
        </Pressable>
        <Pressable
          onPress={onApprove}
          disabled={isLoading}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5"
        >
          <Check size={14} color="#FFFFFF" />
          <Text className="font-poppins-semibold text-sm text-white">Aprovar</Text>
        </Pressable>
      </View>
    </View>
  );
}
