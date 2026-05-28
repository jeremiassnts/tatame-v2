import {
  useAnnouncement,
  useCreateAnnouncement,
  useUpdateAnnouncement,
} from "@/lib/hooks/use-announcements";
import { useUploadImage } from "@/lib/hooks/use-upload";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Camera, ImageIcon } from "lucide-react-native";
import { useState, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#8A8A8A";
const ACCENT = "#A078E8";
const BORDER = "#2A2A2A";
const SURFACE = "#1A1A1A";

type FormData = {
  title: string;
  body: string;
};

export default function CreateAnnouncementScreen() {
  const router = useRouter();
  const { announcementId } = useLocalSearchParams<{ announcementId?: string }>();
  const isEditing = !!announcementId;

  const { data: existing } = useAnnouncement(announcementId ?? null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const uploadImage = useUploadImage();
  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      title: "",
      body: "",
    },
  });

  useEffect(() => {
    if (existing) {
      reset({ title: existing.title, body: existing.body });
      setImageUrl(existing.imageUrl ?? null);
    }
  }, [existing, reset]);

  const isLoading = isSubmitting || uploadImage.isPending;

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    try {
      const ext = asset.uri.split(".").pop() ?? "jpg";
      const uploaded = await uploadImage.mutateAsync({
        uri: asset.uri,
        type: `image/${ext}`,
        name: `announcement.${ext}`,
      });
      setImageUrl(uploaded.url);
    } catch {
      Alert.alert("Erro", "Não foi possível fazer upload da imagem.");
    }
  }

  async function onSubmit(data: FormData) {
    try {
      if (isEditing && announcementId) {
        await updateAnnouncement.mutateAsync({
          id: announcementId,
          title: data.title,
          body: data.body,
          imageUrl,
        });
      } else {
        const payload: { title: string; body: string; imageUrl?: string } = {
          title: data.title,
          body: data.body,
        };
        if (imageUrl) payload.imageUrl = imageUrl;
        await createAnnouncement.mutateAsync(payload);
      }
      router.back();
    } catch {
      Alert.alert("Erro", "Não foi possível salvar o aviso. Tente novamente.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(app)/(manager)/(more)/announcements")}>
            <Text className="font-poppins text-sm" style={{ color: ACCENT }}>
              ← Voltar
            </Text>
          </Pressable>
          <Text className="font-poppins-semibold text-base text-primary">
            {isEditing ? "Editar aviso" : "Novo aviso"}
          </Text>
          <View style={{ width: 60 }} />
        </View>
      </View>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32, gap: 24 }}>

            {/* Cover image */}
            <Pressable
              onPress={pickImage}
              className="items-center justify-center overflow-hidden rounded-2xl"
              style={{
                height: 180,
                backgroundColor: SURFACE,
                borderWidth: 1,
                borderColor: BORDER,
                borderStyle: "dashed",
              }}
            >
              {imageUrl ? (
                <>
                  <Image
                    source={{ uri: imageUrl }}
                    style={{ position: "absolute", width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                  <View
                    className="absolute items-center justify-center rounded-full"
                    style={{ backgroundColor: "rgba(0,0,0,0.5)", padding: 10 }}
                  >
                    <Camera size={20} color="white" />
                  </View>
                </>
              ) : (
                <View className="items-center" style={{ gap: 8 }}>
                  {uploadImage.isPending ? (
                    <ActivityIndicator color={ACCENT} />
                  ) : (
                    <>
                      <ImageIcon size={32} color={TEXT_SECONDARY} />
                      <Text
                        className="font-poppins text-xs"
                        style={{ color: TEXT_SECONDARY }}
                      >
                        Toque para adicionar imagem
                      </Text>
                    </>
                  )}
                </View>
              )}
            </Pressable>

            {/* Title */}
            <View style={{ gap: 8 }}>
              <Text className="font-poppins-medium text-sm text-primary">Título</Text>
              <Controller
                control={control}
                name="title"
                rules={{ required: true, maxLength: 200 }}
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="Ex. Horário especial de natal"
                    placeholderTextColor={TEXT_SECONDARY}
                    className="rounded-[14px] border font-poppins text-sm text-primary"
                    style={{
                      padding: 14,
                      backgroundColor: SURFACE,
                      borderColor: error ? "#FF453A" : BORDER,
                    }}
                    maxLength={200}
                  />
                )}
              />
            </View>

            {/* Body */}
            <View style={{ gap: 8 }}>
              <Text className="font-poppins-medium text-sm text-primary">Conteúdo</Text>
              <Controller
                control={control}
                name="body"
                rules={{ required: true, maxLength: 5000 }}
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="Escreva o conteúdo do aviso aqui..."
                    placeholderTextColor={TEXT_SECONDARY}
                    multiline
                    numberOfLines={6}
                    className="rounded-[14px] border font-poppins text-sm text-primary"
                    style={{
                      padding: 14,
                      backgroundColor: SURFACE,
                      borderColor: error ? "#FF453A" : BORDER,
                      minHeight: 140,
                      textAlignVertical: "top",
                    }}
                    maxLength={5000}
                  />
                )}
              />
            </View>

            {/* Submit */}
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading}
              style={{ borderRadius: 14, overflow: "hidden" }}
            >
              <LinearGradient
                colors={["#A078E8", "#7C4FBE"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ padding: 16, alignItems: "center" }}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-poppins-semibold text-sm text-white">
                    {isEditing ? "Salvar alterações" : "Publicar aviso"}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
