import { formatAnnouncementDate } from "@/lib/utils/date";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar } from "lucide-react-native";
import { Image, Pressable, Text, View } from "react-native";

const TEXT_SECONDARY = "#8A8A8A";

type AnnouncementListCardProps = {
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  onPress: () => void;
};

export function AnnouncementListCard({
  title,
  body,
  imageUrl,
  createdAt,
  onPress,
}: AnnouncementListCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden"
      style={{ borderRadius: 16, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#2A2A2A" }}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: "100%", height: 120 }}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={["#2A2A2A", "#1A1A1A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: "100%", height: 120 }}
        />
      )}
      <View style={{ padding: 16, gap: 10 }}>
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Calendar size={14} color={TEXT_SECONDARY} />
          <Text className="font-poppins-medium text-xs" style={{ color: TEXT_SECONDARY }}>
            {formatAnnouncementDate(createdAt)}
          </Text>
        </View>
        <Text
          className="font-poppins-semibold text-primary"
          style={{ fontSize: 15 }}
          numberOfLines={2}
        >
          {title}
        </Text>
        <Text
          className="font-poppins"
          style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18.2 }}
          numberOfLines={2}
        >
          {body}
        </Text>
      </View>
    </Pressable>
  );
}
