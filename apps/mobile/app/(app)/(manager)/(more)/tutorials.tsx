import { useTutorials, type TutorialItem } from "@/lib/hooks/use-tutorials";
import { useRouter } from "expo-router";
import { ChevronLeft, Play } from "lucide-react-native";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ACCENT = "#A078E8";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TutorialCard({ item }: { item: TutorialItem }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(item.youtubeUrl)}
      className="overflow-hidden rounded-2xl border border-surface-border bg-surface"
    >
      {/* Thumbnail */}
      <View style={{ height: 180, backgroundColor: "#2A2A2A" }}>
        <Image
          source={{ uri: item.thumbnailUrl }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
        {/* Play button */}
        <View
          className="absolute items-center justify-center rounded-full"
          style={{
            width: 48,
            height: 48,
            backgroundColor: ACCENT,
            top: "50%",
            left: "50%",
            transform: [{ translateX: -24 }, { translateY: -24 }],
          }}
        >
          <Play size={22} color="#FFFFFF" fill="#FFFFFF" />
        </View>
        {/* Duration badge */}
        <View
          className="absolute rounded-md"
          style={{
            bottom: 8,
            right: 8,
            backgroundColor: "#000000CC",
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
        >
          <Text
            className="font-poppins-semibold text-primary"
            style={{ fontSize: 11 }}
          >
            {formatDuration(item.durationSeconds)}
          </Text>
        </View>
      </View>

      {/* Card body */}
      <View style={{ padding: 16, gap: 8 }}>
        <Text
          className="font-poppins-semibold text-primary"
          style={{ fontSize: 15 }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text
          className="font-poppins text-xs"
          style={{ color: "#8A8A8A", lineHeight: 18 }}
          numberOfLines={2}
        >
          {item.description}
        </Text>
      </View>
    </Pressable>
  );
}

export default function TutorialsScreen() {
  const router = useRouter();
  const { data: tutorials, isLoading } = useTutorials();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View
        className="flex-row items-center"
        style={{ paddingHorizontal: 24, paddingTop: 8, gap: 12 }}
      >
        <Pressable
          onPress={() => router.back()}
          className="items-center justify-center rounded-xl border border-surface-border bg-surface"
          style={{ width: 40, height: 40 }}
        >
          <ChevronLeft size={20} color="#FFFFFF" />
        </Pressable>
        <Text className="flex-1 font-poppins-bold text-lg text-primary">
          Tutoriais
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={tutorials ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 32,
            gap: 12,
          }}
          ListHeaderComponent={
            <Text
              className="font-poppins-medium"
              style={{ fontSize: 14, color: "#ABABAB", marginBottom: 8 }}
            >
              {tutorials?.length ?? 0} vídeo{(tutorials?.length ?? 0) !== 1 ? "s" : ""}{" "}
              disponíve{(tutorials?.length ?? 0) !== 1 ? "is" : "l"}
            </Text>
          }
          renderItem={({ item }) => <TutorialCard item={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
