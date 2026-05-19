import { ChevronRight, Megaphone } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";
const ACCENT = "#A078E8";

const PT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, "0");
  const month = PT_MONTHS[d.getMonth()] ?? "";
  return `${day} ${month}`;
}

type AnnouncementFeedCardProps = {
  title: string;
  body: string;
  createdAt: string;
  onPress: () => void;
};

export function AnnouncementFeedCard({
  title,
  body,
  createdAt,
  onPress,
}: AnnouncementFeedCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-[14px] border"
      style={{
        padding: 14,
        gap: 12,
        backgroundColor: "#1A1A1A",
        borderColor: "#2A2A2A",
      }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 38, height: 38, backgroundColor: "#A078E820" }}
      >
        <Megaphone size={18} color={ACCENT} />
      </View>
      <View className="min-w-0 flex-1" style={{ gap: 2 }}>
        <Text
          className="font-poppins-semibold text-sm text-primary"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          className="font-poppins text-xs"
          style={{ color: TEXT_SECONDARY }}
          numberOfLines={1}
        >
          {formatShortDate(createdAt)} · {body}
        </Text>
      </View>
      <ChevronRight size={16} color={TEXT_MUTED} />
    </Pressable>
  );
}
