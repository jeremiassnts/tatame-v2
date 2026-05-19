import {
  useAnnouncement,
  useDeleteAnnouncement,
} from "@/lib/hooks/use-announcements";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pencil } from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const ACCENT = "#A078E8";

const PT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, "0");
  const month = PT_MONTHS[d.getMonth()] ?? "";
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

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
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 24, paddingBottom: 32, gap: 0 }}>
          {/* Header */}
          <View
            className="flex-row items-center justify-between"
            style={{ paddingHorizontal: 24, marginBottom: 20 }}
          >
            <Pressable onPress={() => router.back()}>
              <Text className="font-poppins text-sm" style={{ color: ACCENT }}>
                ← Voltar
              </Text>
            </Pressable>
            <Text className="font-poppins-semibold text-base text-primary">
              Detalhes do aviso
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(app)/(manager)/(more)/create-announcement",
                  params: { announcementId: id },
                })
              }
            >
              <Pencil size={20} color={ACCENT} />
            </Pressable>
          </View>

          {/* Cover image */}
          {announcement.imageUrl ? (
            <Image
              source={{ uri: announcement.imageUrl }}
              style={{ width: "100%", height: 220 }}
              resizeMode="cover"
            />
          ) : (
            <View
              className="items-center justify-center"
              style={{ height: 120, backgroundColor: "#1A1A1A" }}
            />
          )}

          <View style={{ paddingHorizontal: 24, paddingTop: 20, gap: 16 }}>
            {/* Meta */}
            <View style={{ gap: 4 }}>
              <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
                {formatDate(announcement.createdAt)} · {announcement.authorName}
              </Text>
            </View>

            {/* Title */}
            <Text
              className="font-poppins-bold text-primary"
              style={{ fontSize: 22, letterSpacing: -0.5, lineHeight: 30 }}
            >
              {announcement.title}
            </Text>

            {/* Body */}
            <Text className="font-poppins text-sm text-primary" style={{ lineHeight: 22 }}>
              {announcement.body}
            </Text>

            {/* Delete */}
            <Pressable
              onPress={handleDelete}
              disabled={deleteAnnouncement.isPending}
              className="items-center rounded-[14px] border"
              style={{ padding: 16, borderColor: "#FF453A40", marginTop: 16 }}
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
