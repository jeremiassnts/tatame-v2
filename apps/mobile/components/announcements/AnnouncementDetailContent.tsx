import { formatAnnouncementDate } from "@/lib/utils/date";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, ImageIcon, User } from "lucide-react-native";
import { Image, ScrollView, Text, View } from "react-native";

const ACCENT = "#A078E8";

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
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Image */}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: "100%", height: 200, borderRadius: 16 }}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={["#2A2A2A", "#1A1A1A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: "100%", height: 200, borderRadius: 16, alignItems: "center", justifyContent: "center" }}
        >
          <ImageIcon size={32} color="#525252" />
        </LinearGradient>
      )}

      {/* Title Section */}
      <View style={{ gap: 12 }}>
        {/* Meta Row */}
        <View className="flex-row" style={{ gap: 12 }}>
          <View
            className="flex-row items-center"
            style={{ gap: 6, backgroundColor: "#A078E820", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <Calendar size={14} color={ACCENT} />
            <Text className="font-poppins-semibold text-xs" style={{ color: ACCENT }}>
              {formatAnnouncementDate(createdAt)}
            </Text>
          </View>
          <View
            className="flex-row items-center"
            style={{ gap: 6, backgroundColor: "#A078E820", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <User size={14} color={ACCENT} />
            <Text className="font-poppins-semibold text-xs" style={{ color: ACCENT }}>
              {authorName}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text
          className="font-poppins-bold text-primary"
          style={{ fontSize: 20 }}
        >
          {title}
        </Text>
      </View>

      {/* Body */}
      <Text
        className="font-poppins text-sm"
        style={{ color: "#ABABAB", lineHeight: 22.4 }}
      >
        {body}
      </Text>
    </ScrollView>
  );
}
