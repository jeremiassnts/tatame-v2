import { BackButton } from "@/components/BackButton";
import { useAcademyContext } from "@/lib/academy-context";
import { useAnnouncements } from "@/lib/hooks/use-announcements";
import { formatAnnouncementDate } from "@/lib/utils/date";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Calendar, Megaphone, Plus } from "lucide-react-native";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const ACCENT = "#A078E8";

type AnnouncementCardProps = {
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  onPress: () => void;
};

function AnnouncementCard({ title, body, imageUrl, createdAt, onPress }: AnnouncementCardProps) {
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
          <Text className="font-poppins-medium text-sm" style={{ color: "#ABABAB" }}>
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
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, gap: 12 }}
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
                title={item.title}
                body={item.body}
                imageUrl={item.imageUrl}
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
