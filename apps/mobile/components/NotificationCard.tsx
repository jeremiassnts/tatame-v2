import {
  AlertCircle,
  Award,
  BarChart3,
  Clock,
  Flame,
  Gift,
  Info,
  Megaphone,
  ShoppingBag,
  Swords,
  Trophy,
  TriangleAlert,
  UserPlus,
} from "lucide-react-native";
import type React from "react";
import { Pressable, Text, View } from "react-native";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { NotificationItem } from "@/lib/hooks/use-notifications";

type CategoryConfig = {
  icon: string;
  color: string;
  bgColor: string;
};

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  payment: { icon: "triangle-alert", color: "#FFD60A", bgColor: "#FFD60A20" },
  subscription_alert: {
    icon: "triangle-alert",
    color: "#FFD60A",
    bgColor: "#FFD60A20",
  },
  checkin_anomaly: {
    icon: "alert-circle",
    color: "#FF453A",
    bgColor: "#FF453A20",
  },
  class_change: { icon: "info", color: "#32D74B", bgColor: "#32D74B20" },
  belt_promotion: { icon: "award", color: "#32D74B", bgColor: "#32D74B20" },
  announcement: { icon: "megaphone", color: "#32D74B", bgColor: "#32D74B20" },
  new_member: { icon: "user-plus", color: "#32D74B", bgColor: "#32D74B20" },
  milestone: { icon: "trophy", color: "#32D74B", bgColor: "#32D74B20" },
  streak: { icon: "flame", color: "#FFD60A", bgColor: "#FFD60A20" },
  weekly_summary: {
    icon: "bar-chart-3",
    color: "#32D74B",
    bgColor: "#32D74B20",
  },
  inactivity: { icon: "clock", color: "#FFD60A", bgColor: "#FFD60A20" },
  wrapped: { icon: "gift", color: "#A078E8", bgColor: "#A078E820" },
  marketplace: {
    icon: "shopping-bag",
    color: "#32D74B",
    bgColor: "#32D74B20",
  },
  tournament: { icon: "swords", color: "#32D74B", bgColor: "#32D74B20" },
};

const DEFAULT_CONFIG: CategoryConfig = {
  icon: "info",
  color: "#32D74B",
  bgColor: "#32D74B20",
};

const ICON_MAP: Record<
  string,
  React.ComponentType<{ size: number; color: string }>
> = {
  "triangle-alert": TriangleAlert,
  "alert-circle": AlertCircle,
  info: Info,
  award: Award,
  megaphone: Megaphone,
  "user-plus": UserPlus,
  trophy: Trophy,
  flame: Flame,
  "bar-chart-3": BarChart3,
  clock: Clock,
  gift: Gift,
  "shopping-bag": ShoppingBag,
  swords: Swords,
};

type NotificationCardProps = {
  notification: NotificationItem;
  onPress: () => void;
};

export function NotificationCard({
  notification,
  onPress,
}: NotificationCardProps) {
  const isRead = notification.readAt !== null;
  const config = CATEGORY_CONFIG[notification.category] ?? DEFAULT_CONFIG;
  const IconComponent = ICON_MAP[config.icon] ?? Info;
  const relativeTime = formatRelativeTime(notification.createdAt);

  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 14,
        backgroundColor: "#1A1A1A",
        borderWidth: 1,
        borderColor: isRead ? "#2A2A2A" : "#3A3A3A",
        padding: 14,
        flexDirection: "row",
        gap: 12,
        opacity: isRead ? 0.6 : 1,
      }}
    >
      {!isRead && (
        <View
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: "#A078E8",
          }}
        />
      )}

      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: config.bgColor,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <IconComponent size={20} color={config.color} />
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            style={{
              fontFamily: isRead ? "Inter_500Medium" : "Inter_700Bold",
              fontSize: 14,
              color: "#FFFFFF",
              flex: 1,
            }}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: "#525252",
              flexShrink: 0,
            }}
          >
            {relativeTime}
          </Text>
        </View>

        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            color: "#ABABAB",
            lineHeight: 13 * 1.4,
          }}
          numberOfLines={2}
        >
          {notification.body}
        </Text>
      </View>
    </Pressable>
  );
}
