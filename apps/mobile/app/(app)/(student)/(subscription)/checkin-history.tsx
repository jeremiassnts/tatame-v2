import { BackButton } from "@/components/BackButton";
import { useCheckinHistory } from "@/lib/hooks/use-checkin";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const TEXT_MUTED = "#525252";

type CheckinEntry = {
  id: string;
  className: string;
  date: string;
  dayOfWeek: string;
  time: string;
};

type Section = {
  key: string;
  title: string;
  count: number;
  data: CheckinEntry[];
};

export default function CheckinHistoryScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useCheckinHistory();
  const [refreshing, setRefreshing] = useState(false);

  const sections: Section[] = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) =>
      page.items.map((week) => ({
        key: week.weekReference,
        title: week.weekLabel,
        count: week.count,
        data: week.checkins,
      })),
    );
  }, [data]);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["checkins", "me", "history"] });
    setRefreshing(false);
  };

  const onEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View
        className="flex-row items-center gap-3"
        style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 }}
      >
        <BackButton />
        <Text className="flex-1 text-center font-poppins-semibold text-base text-primary">
          Histórico de check-ins
        </Text>
        <View className="h-10 w-10" />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#A078E8" />
        </View>
      ) : sections.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
            Nenhum check-in registrado
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#A078E8"
            />
          }
          renderSectionHeader={({ section }) => (
            <View
              className="flex-row items-center justify-between"
              style={{ paddingTop: 20, paddingBottom: 12 }}
            >
              <Text className="font-poppins-semibold text-sm text-primary">
                {section.title}
              </Text>
              <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
                {section.count} check-ins
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View className="flex-row items-center gap-3" style={{ paddingVertical: 10 }}>
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: "#32D74B" }}
              />
              <View style={{ gap: 2 }}>
                <Text className="font-poppins-semibold text-sm text-primary">
                  {item.className}
                </Text>
                <Text className="font-poppins text-xs" style={{ color: TEXT_MUTED }}>
                  {item.dayOfWeek}, {formatDisplayDate(item.date)} · {item.time}
                </Text>
              </View>
            </View>
          )}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color="#A078E8" style={{ marginTop: 16 }} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
