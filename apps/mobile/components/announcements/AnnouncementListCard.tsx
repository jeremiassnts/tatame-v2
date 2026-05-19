import { Pressable, Text, View } from "react-native";

const TEXT_SECONDARY = "#8A8A8A";

const PT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatAnnouncementDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, "0");
  const month = PT_MONTHS[d.getMonth()] ?? "";
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

type AnnouncementListCardProps = {
  title: string;
  body: string;
  createdAt: string;
  onPress: () => void;
};

export function AnnouncementListCard({
  title,
  body,
  createdAt,
  onPress,
}: AnnouncementListCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-[14px] border border-surface-border bg-surface"
      style={{ padding: 16, gap: 8 }}
    >
      <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
        {formatAnnouncementDate(createdAt)}
      </Text>
      <Text className="font-poppins-semibold text-sm text-primary" numberOfLines={2}>
        {title}
      </Text>
      <Text
        className="font-poppins text-xs"
        style={{ color: TEXT_SECONDARY }}
        numberOfLines={2}
      >
        {body}
      </Text>
    </Pressable>
  );
}
