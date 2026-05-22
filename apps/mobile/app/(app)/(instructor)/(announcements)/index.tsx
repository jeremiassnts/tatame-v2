import { BackButton } from "@/components/BackButton";
import { AnnouncementListCard } from "@/components/announcements/AnnouncementListCard";
import { useAcademyContext } from "@/lib/academy-context";
import { useAnnouncements } from "@/lib/hooks/use-announcements";
import { useRouter } from "expo-router";
import { Megaphone } from "lucide-react-native";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const ACCENT = "#A078E8";

export default function InstructorAnnouncementsScreen() {
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
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, gap: 12 }}
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
            <AnnouncementListCard
              title={item.title}
              body={item.body}
              imageUrl={item.imageUrl}
              createdAt={item.createdAt}
              onPress={() =>
                router.push(`/(app)/(instructor)/(announcements)/${item.id}`)
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
