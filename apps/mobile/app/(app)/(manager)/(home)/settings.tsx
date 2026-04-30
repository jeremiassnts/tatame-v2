import { BackButton } from "@/components/BackButton";
import { DatePickerField } from "@/components/DatePickerField";
import { FormInput } from "@/components/FormInput";
import { PhoneInput } from "@/components/PhoneInput";
import { ImagePickerField } from "@/components/ImagePickerField";
import { useAcademyContext } from "@/lib/academy-context";
import { useAcademy, useUpdateAcademy } from "@/lib/hooks/use-academy";
import { useUploadImage } from "@/lib/hooks/use-upload";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateAcademyBodySchema,
  type UpdateAcademyBody,
} from "@tatame/validators";
import type { ImagePickerAsset } from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Mail, MapPin, Phone } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function toDateOnly(value: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m ? m[1]! : value;
}

export default function AcademySettingsScreen() {
  const router = useRouter();
  const { academyId } = useAcademyContext();
  const { data: academy, isLoading } = useAcademy(academyId);
  const updateAcademy = useUpdateAcademy(academyId);
  const uploadImage = useUploadImage();
  const [imageAsset, setImageAsset] = useState<ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<UpdateAcademyBody>({
    resolver: zodResolver(updateAcademyBodySchema),
  });

  useEffect(() => {
    if (academy) {
      reset({
        name: academy.name,
        logoUrl: academy.logoUrl,
        address: academy.address,
        contactEmail: academy.contactEmail,
        contactPhone: academy.contactPhone,
        foundedAt: toDateOnly(academy.foundedAt),
      });
    }
  }, [academy, reset]);

  const onSubmit = async (data: UpdateAcademyBody) => {
    setSubmitting(true);
    setGeneralError("");
    try {
      const changes: Record<string, unknown> = {};

      for (const key of Object.keys(dirtyFields)) {
        changes[key] = data[key as keyof UpdateAcademyBody];
      }

      if (imageAsset) {
        const uploaded = await uploadImage.mutateAsync({
          uri: imageAsset.uri,
          type: imageAsset.mimeType ?? "image/jpeg",
          name: imageAsset.fileName ?? "logo.jpg",
        });
        changes.logoUrl = uploaded.url;
      }

      if (Object.keys(changes).length === 0) {
        return;
      }

      await updateAcademy.mutateAsync(changes as UpdateAcademyBody);
      setSaved(true);
      setTimeout(() => {
        router.back();
      }, 1000);
    } catch (e) {
      setGeneralError(
        e instanceof Error ? e.message : "Não foi possível salvar as alterações",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </SafeAreaView>
    );
  }

  const hasChanges = isDirty || !!imageAsset;

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top", "bottom"]}>
      <View className="flex-1 px-6 pt-2">
        <View className="flex-row items-center justify-between">
          <BackButton />
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 18, letterSpacing: -0.3 }}
          >
            Configurações
          </Text>
          <View className="h-10 w-10" />
        </View>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <ScrollView
            className="mt-6 flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <View style={{ gap: 24 }}>
              <ImagePickerField
                label=""
                variant="academySettings"
                imageUri={imageAsset?.uri ?? academy?.logoUrl ?? null}
                onImageSelected={setImageAsset}
              />

              <View style={{ gap: 16 }}>
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <FormInput
                      label="Nome da academia"
                      placeholder="Nome da academia"
                      value={value ?? ""}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoCapitalize="words"
                      error={errors.name?.message}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="address"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <FormInput
                      label="Endereço"
                      placeholder="Rua, cidade, estado"
                      value={value ?? ""}
                      onChangeText={(t) => onChange(t || null)}
                      onBlur={onBlur}
                      leftIcon={MapPin}
                      error={errors.address?.message}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="contactEmail"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <FormInput
                      label="E-mail de contato"
                      placeholder="contato@academia.com"
                      value={value ?? ""}
                      onChangeText={(t) => onChange(t || null)}
                      onBlur={onBlur}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      leftIcon={Mail}
                      error={errors.contactEmail?.message}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="contactPhone"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <PhoneInput
                      label="Telefone"
                      value={value}
                      onChangePhone={(digits) => onChange(digits || null)}
                      onBlur={onBlur}
                      leftIcon={Phone}
                      error={errors.contactPhone?.message}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="foundedAt"
                  render={({ field: { onChange, value } }) => (
                    <DatePickerField
                      label="Data de fundação"
                      value={value ?? null}
                      onChange={onChange}
                      iconTrailing
                      error={errors.foundedAt?.message}
                    />
                  )}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        {generalError ? (
          <Text className="mb-2 font-poppins text-sm text-red-500">
            {generalError}
          </Text>
        ) : null}

        <View className="pb-2">
          {saved ? (
            <View className="overflow-hidden rounded-xl">
              <LinearGradient
                colors={["#A078E8", "#7C5CBF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 40,
                }}
              >
                <Text className="font-poppins-semibold text-base text-white">
                  Salvo!
                </Text>
              </LinearGradient>
            </View>
          ) : (
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={!hasChanges || submitting}
              className="w-full"
            >
              <View className="overflow-hidden rounded-xl">
                <LinearGradient
                  colors={
                    !hasChanges || submitting
                      ? ["#3A3A3A", "#3A3A3A"]
                      : ["#A078E8", "#7C5CBF"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 40,
                  }}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="font-poppins-semibold text-base text-white">
                      Salvar alterações
                    </Text>
                  )}
                </LinearGradient>
              </View>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
