import { Bell } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useUnreadCount } from "@/lib/hooks/use-notifications";

export function NotificationBell() {
  const router = useRouter();
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      style={{ position: "relative", padding: 4 }}
    >
      <Bell size={24} color="#FFFFFF" />
      {count > 0 && (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            height: 16,
            width: 16,
            borderRadius: 8,
            backgroundColor: "#A078E8",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              fontSize: 9,
              color: "#FFFFFF",
            }}
          >
            {count > 9 ? "9+" : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
