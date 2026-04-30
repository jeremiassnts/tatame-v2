import {
  formatAbsoluteDate,
  formatRelativeTime,
} from "@/lib/format-relative-time";
import type { NotificationItem } from "@/lib/hooks/use-notifications";
import { useMarkAsRead } from "@/lib/hooks/use-notifications";
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
  TriangleAlert,
  Trophy,
  UserPlus,
  X,
} from "lucide-react-native";
import type React from "react";
import { useEffect } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

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

type NotificationDetailSheetProps = {
  notification: NotificationItem | null;
  onClose: () => void;
};

export function NotificationDetailSheet({
  notification,
  onClose,
}: NotificationDetailSheetProps) {
  const markAsRead = useMarkAsRead();

  useEffect(() => {
    if (notification && notification.readAt === null) {
      markAsRead.mutate(notification.id);
    }
  }, [notification?.id]);

  if (!notification) return null;

  const config = CATEGORY_CONFIG[notification.category] ?? DEFAULT_CONFIG;
  const IconComponent = ICON_MAP[config.icon] ?? Info;
  const relativeTime = formatRelativeTime(notification.createdAt);
  const absoluteDate = formatAbsoluteDate(notification.createdAt);

  return (
    <Modal
      visible={notification !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#00000099",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />

        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#1A1A1A",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: "center", paddingTop: 12 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#525252",
              }}
            />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: 16,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: config.bgColor,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconComponent size={18} color={config.color} />
              </View>
              <Text
                style={{
                  fontFamily: "Sora_700Bold",
                  fontSize: 16,
                  color: "#FFFFFF",
                  flex: 1,
                }}
                numberOfLines={2}
              >
                {notification.title}
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: "#2A2A2A",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 12,
              }}
            >
              <X size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Separator */}
          <View style={{ height: 1, backgroundColor: "#2A2A2A" }} />

          {/* Body */}
          <ScrollView
            style={{ maxHeight: 400 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20, gap: 12 }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Clock size={14} color="#525252" />
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: "#525252",
                }}
              >
                {relativeTime}
                {" · "}
                {absoluteDate}
              </Text>
            </View>

            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: "#ABABAB",
                lineHeight: 14 * 1.5,
              }}
            >
              {notification.body}
            </Text>
          </ScrollView>

          {/* Bottom safe area padding */}
          <View style={{ height: 42 }} />
        </View>
      </View>
    </Modal>
  );
}
