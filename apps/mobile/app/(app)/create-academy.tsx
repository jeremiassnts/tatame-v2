import { DatePickerField } from "@/components/DatePickerField";
import { FormInput } from "@/components/FormInput";
import { GradientButton } from "@/components/GradientButton";
import { ImagePickerField } from "@/components/ImagePickerField";
import { useCreateAcademy } from "@/lib/hooks/use-academy";
import { useUploadImage } from "@/lib/hooks/use-upload";
import { useCurrentUser } from "@/lib/hooks/use-user";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAcademyBodySchema, type CreateAcademyBody } from "@tatame/validators";
import type { ImagePickerAsset } from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CreateAcademyScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const createAcademy = useCreateAcademy();
  const uploadImage = useUploadImage();
  const [imageAsset, setImageAsset] = useState<ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateAcademyBody>({
    resolver: zodResolver(createAcademyBodySchema),
    defaultValues: {
      name: "",
      logoUrl: null,
      address: null,
      contactPhone: null,
      foundedAt: null,
    },
  });

  const onSubmit = async (data: CreateAcademyBody) => {
    if (!user?.email) {
      setGeneralError(
        "Não foi possível obter seu e-mail. Tente sair e entrar novamente.",
      );
      return;
    }

    setSubmitting(true);
    setGeneralError("");
    try {
      let logoUrl = data.logoUrl;

      if (imageAsset) {
        const uploaded = await uploadImage.mutateAsync({
          uri: imageAsset.uri,
          type: imageAsset.mimeType ?? "image/jpeg",
          name: imageAsset.fileName ?? "logo.jpg",
        });
        logoUrl = uploaded.url;
      }

      await createAcademy.mutateAsync({
        ...data,
        logoUrl,
        contactEmail: user.email,
      });
      await queryClient.refetchQueries({ queryKey: ["user", "me"] });
      router.replace("/(app)/(manager)/(home)");
    } catch (e) {
      setGeneralError(
        e instanceof Error ? e.message : "Não foi possível criar a academia",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 px-6 pt-2">
        <View className="mt-4 gap-2">
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 28, letterSpacing: -1 }}
          >
            Criar academia
          </Text>
          <Text className="font-poppins text-[15px] text-[#525252]">
            Configure sua academia de Jiu-Jitsu
          </Text>
        </View>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <ScrollView
            className="mt-6 flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-4 pb-4">
              <ImagePickerField
                label="Logo da academia"
                imageUri={imageAsset?.uri ?? null}
                onImageSelected={setImageAsset}
              />

              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Nome da academia"
                    placeholder="Digite o nome da academia"
                    value={value}
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
                    error={errors.address?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="contactPhone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Telefone de contato"
                    placeholder="(11) 99999-9999"
                    value={value ?? ""}
                    onChangeText={(t) => onChange(t || null)}
                    onBlur={onBlur}
                    keyboardType="phone-pad"
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
                    error={errors.foundedAt?.message}
                  />
                )}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        {generalError ? (
          <Text className="mb-2 font-poppins text-sm text-red-500">
            {generalError}
          </Text>
        ) : null}

        <View className="pb-2">
          {submitting ? (
            <View className="h-14 items-center justify-center rounded-xl bg-accent">
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : (
            <GradientButton
              label="Criar academia"
              onPress={handleSubmit(onSubmit)}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
