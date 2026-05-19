import { BackButton } from "@/components/BackButton";
import { useAcademyContext } from "@/lib/academy-context";
import { useAnnouncements } from "@/lib/hooks/use-announcements";
import { formatAnnouncementDate } from "@/lib/utils/date";
import { useRouter } from "expo-router";
import { Megaphone, Plus } from "lucide-react-native";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const ACCENT = "#A078E8";

type AnnouncementCardProps = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  onPress: () => void;
};

function AnnouncementCard({ title, body, createdAt, onPress }: AnnouncementCardProps) {
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

export default function AnnouncementsScreen() {
  const router = useRouter();
  const { academyId } = useAcademyContext();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
    isPending,
  } = useAnnouncements(academyId);

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-background pt-8" edges={["top"]}>
      <View className="flex-1">
        <View className="flex-row items-center justify-between px-6 pb-2 pt-2">
          <BackButton />
          <Text className="font-poppins-bold text-lg text-primary">Avisos</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
          <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
            {total} {total === 1 ? "aviso publicado" : "avisos publicados"}
          </Text>
        </View>

        {isPending ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, gap: 10 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={ACCENT}
              />
            }
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View className="items-center rounded-[14px] border border-surface-border bg-surface py-12">
                <Megaphone size={32} color={TEXT_SECONDARY} style={{ marginBottom: 12 }} />
                <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
                  Nenhum aviso publicado ainda
                </Text>
              </View>
            }
            ListFooterComponent={
              isFetchingNextPage ? (
                <ActivityIndicator color={ACCENT} style={{ marginTop: 16 }} />
              ) : null
            }
            renderItem={({ item }) => (
              <AnnouncementCard
                id={item.id}
                title={item.title}
                body={item.body}
                createdAt={item.createdAt}
                onPress={() =>
                  router.push(`/(app)/(manager)/(more)/announcement/${item.id}`)
                }
              />
            )}
          />
        )}

        {/* FAB */}
        <Pressable
          onPress={() => router.push("/(app)/(manager)/(more)/create-announcement")}
          className="absolute items-center justify-center rounded-full"
          style={{
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            backgroundColor: ACCENT,
            shadowColor: ACCENT,
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Plus size={24} color="white" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
