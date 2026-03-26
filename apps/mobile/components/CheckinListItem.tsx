import { Text, View } from "react-native";
import { CircleCheck } from "lucide-react-native";
import { Avatar } from "@/components/Avatar";

/** Check icon color from design.pen check-in rows (jon0a). */
const CHECKIN_ICON = "#32D74B";

type CheckinListItemProps = {
  userName: string;
  userProfileImageUrl?: string | null;
  checkedInAt: string;
};

function formatCheckinTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function CheckinListItem({
  userName,
  userProfileImageUrl,
  checkedInAt,
}: CheckinListItemProps) {
  const letter = userName.charAt(0).toUpperCase();

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-surface-border bg-surface px-3.5 py-2.5">
      <Avatar
        variant="user"
        imageUrl={userProfileImageUrl}
        fallbackLetter={letter}
        size={36}
      />
      <View className="min-w-0 flex-1" style={{ gap: 2 }}>
        <Text className="font-poppins-semibold text-sm text-primary">
          {userName}
        </Text>
        <Text className="font-poppins text-xs text-muted">
          Check-in às {formatCheckinTime(checkedInAt)}
        </Text>
      </View>
      <CircleCheck size={20} color={CHECKIN_ICON} />
    </View>
  );
}
