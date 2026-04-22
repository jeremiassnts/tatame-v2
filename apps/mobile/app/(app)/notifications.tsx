import { BackButton } from "@/components/BackButton";
import { NotificationCard } from "@/components/NotificationCard";
import { NotificationDetailSheet } from "@/components/NotificationDetailSheet";
import {
  useMarkAllAsRead,
  useNotifications,
} from "@/lib/hooks/use-notifications";
import type { NotificationItem } from "@/lib/hooks/use-notifications";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type FilterKey = "all" | "alerts" | "errors" | "info";

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "alerts", label: "Alertas" },
  { key: "errors", label: "Erros" },
  { key: "info", label: "Info" },
];

const ALERT_CATEGORIES = [
  "payment",
  "subscription_alert",
  "streak",
  "inactivity",
];
const ERROR_CATEGORIES = ["checkin_anomaly"];

function matchesFilter(item: NotificationItem, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "alerts") return ALERT_CATEGORIES.includes(item.category);
  if (filter === "errors") return ERROR_CATEGORIES.includes(item.category);
  if (filter === "info")
    return (
      !ALERT_CATEGORIES.includes(item.category) &&
      !ERROR_CATEGORIES.includes(item.category)
    );
  return true;
}

export default function NotificationsScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [selectedNotification, setSelectedNotification] =
    useState<NotificationItem | null>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useNotifications();

  const markAllAsRead = useMarkAllAsRead();

  const allItems = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => matchesFilter(item, activeFilter));
  }, [allItems, activeFilter]);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#0C0C0C" }}
      edges={["top"]}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BackButton />
          <Text
            style={{
              fontFamily: "Sora_700Bold",
              fontSize: 18,
              color: "#FFFFFF",
              letterSpacing: -0.3,
            }}
          >
            Notificações
          </Text>
        </View>

        <Pressable
          onPress={() => markAllAsRead.mutate()}
          disabled={markAllAsRead.isPending}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              color: "#A078E8",
              opacity: markAllAsRead.isPending ? 0.5 : 1,
            }}
          >
            Marcar todas
          </Text>
        </Pressable>
      </View>

      {/* Filter chips */}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 24,
          paddingBottom: 16,
        }}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = tab.key === activeFilter;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveFilter(tab.key)}
              style={{
                height: 36,
                paddingHorizontal: 16,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isActive ? "#A078E8" : "#1A1A1A",
                borderWidth: 1,
                borderColor: isActive ? "#A078E8" : "#2A2A2A",
              }}
            >
              <Text
                style={{
                  fontFamily: isActive ? "Inter_600SemiBold" : "Inter_500Medium",
                  fontSize: 13,
                  color: isActive ? "#FFFFFF" : "#ABABAB",
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#A078E8" />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingBottom: 32,
            gap: 10,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refetch}
              tintColor="#A078E8"
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 80,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: "#525252",
                }}
              >
                Nenhuma notificação por enquanto
              </Text>
            </View>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingTop: 16, alignItems: "center" }}>
                <ActivityIndicator color="#A078E8" size="small" />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <NotificationCard
              notification={item}
              onPress={() => setSelectedNotification(item)}
            />
          )}
        />
      )}

      <NotificationDetailSheet
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
      />
    </SafeAreaView>
  );
}
