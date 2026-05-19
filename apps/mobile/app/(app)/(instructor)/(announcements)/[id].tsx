import { AnnouncementDetailContent } from "@/components/announcements/AnnouncementDetailContent";
import { useAnnouncement } from "@/lib/hooks/use-announcements";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const ACCENT = "#A078E8";

export default function InstructorAnnouncementDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: announcement, isPending, isError } = useAnnouncement(id ?? null);

  if (isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={["top"]}>
        <ActivityIndicator color={ACCENT} />
      </SafeAreaView>
    );
  }

  if (isError || !announcement) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={["top"]}>
        <Text className="font-poppins text-sm" style={{ color: TEXT_SECONDARY }}>
          Aviso não encontrado.
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text className="font-poppins-medium text-sm" style={{ color: ACCENT }}>
            Voltar
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View
        className="flex-row items-center justify-between"
        style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 }}
      >
        <Pressable onPress={() => router.back()}>
          <Text className="font-poppins text-sm" style={{ color: ACCENT }}>
            ← Voltar
          </Text>
        </Pressable>
        <Text className="font-poppins-semibold text-base text-primary">
          Detalhes do aviso
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <AnnouncementDetailContent
        title={announcement.title}
        body={announcement.body}
        imageUrl={announcement.imageUrl}
        createdAt={announcement.createdAt}
        authorName={announcement.authorName}
      />
    </SafeAreaView>
  );
}
