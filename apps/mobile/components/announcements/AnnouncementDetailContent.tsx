import { Image, Text, View } from "react-native";

const TEXT_SECONDARY = "#8A8A8A";

const PT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatAnnouncementDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, "0");
  const month = PT_MONTHS[d.getMonth()] ?? "";
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

type AnnouncementDetailContentProps = {
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  authorName: string;
};

export function AnnouncementDetailContent({
  title,
  body,
  imageUrl,
  createdAt,
  authorName,
}: AnnouncementDetailContentProps) {
  return (
    <View style={{ gap: 0 }}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: "100%", height: 220 }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ height: 120, backgroundColor: "#1A1A1A" }} />
      )}

      <View style={{ paddingHorizontal: 24, paddingTop: 20, gap: 16 }}>
        <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
          {formatAnnouncementDate(createdAt)} · {authorName}
        </Text>
        <Text
          className="font-poppins-bold text-primary"
          style={{ fontSize: 22, letterSpacing: -0.5, lineHeight: 30 }}
        >
          {title}
        </Text>
        <Text className="font-poppins text-sm text-primary" style={{ lineHeight: 22 }}>
          {body}
        </Text>
      </View>
    </View>
  );
}
