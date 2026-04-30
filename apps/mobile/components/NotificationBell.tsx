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
      className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
    >
      <Bell size={20} color="#FFFFFF" />
      {count > 0 && (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            height: 18,
            minWidth: 18,
            borderRadius: 9,
            backgroundColor: "#A078E8",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 4,
          }}
        >
          <Text
            style={{
              fontFamily: "Poppins_700Bold",
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
