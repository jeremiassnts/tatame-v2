import { BackButton } from "@/components/BackButton";
import { AnnouncementDetailContent } from "@/components/announcements/AnnouncementDetailContent";
import {
  useAnnouncement,
  useDeleteAnnouncement,
} from "@/lib/hooks/use-announcements";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pencil } from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const ACCENT = "#A078E8";


export default function AnnouncementDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: announcement, isPending, isError } = useAnnouncement(id ?? null);
  const deleteAnnouncement = useDeleteAnnouncement();

  function handleDelete() {
    Alert.alert(
      "Excluir aviso",
      "Tem certeza que deseja excluir este aviso? Essa ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAnnouncement.mutateAsync(id!);
              router.back();
            } catch {
              Alert.alert("Erro", "Não foi possível excluir o aviso.");
            }
          },
        },
      ],
    );
  }

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
      <View className="flex-row items-center justify-between px-6 pb-2 pt-2">
        <BackButton />
        <Text className="font-poppins-bold text-lg text-primary">
          Detalhes do aviso
        </Text>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(app)/(manager)/(more)/create-announcement",
              params: { announcementId: id },
            })
          }
          className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
        >
          <Pencil size={20} color={ACCENT} />
        </Pressable>
      </View>

      <AnnouncementDetailContent
        title={announcement.title}
        body={announcement.body}
        imageUrl={announcement.imageUrl}
        createdAt={announcement.createdAt}
        authorName={announcement.authorName}
      />

      {/* Delete */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Pressable
          onPress={handleDelete}
          disabled={deleteAnnouncement.isPending}
          className="items-center rounded-[14px] border"
          style={{ padding: 16, borderColor: "#FF453A40" }}
        >
          {deleteAnnouncement.isPending ? (
            <ActivityIndicator color="#FF453A" />
          ) : (
            <Text
              className="font-poppins-semibold text-sm"
              style={{ color: "#FF453A" }}
            >
              Excluir aviso
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
