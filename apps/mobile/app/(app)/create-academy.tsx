import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAcademyBodySchema, type CreateAcademyBody } from "@tatame/validators";
import type { ImagePickerAsset } from "expo-image-picker";
import { BackButton } from "@/components/BackButton";
import { FormInput } from "@/components/FormInput";
import { GradientButton } from "@/components/GradientButton";
import { ImagePickerField } from "@/components/ImagePickerField";
import { DatePickerField } from "@/components/DatePickerField";
import { useCreateAcademy } from "@/lib/hooks/use-academy";
import { useUploadImage } from "@/lib/hooks/use-upload";

export default function CreateAcademyScreen() {
  const router = useRouter();
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
      contactEmail: null,
      contactPhone: null,
      foundedAt: null,
    },
  });

  const onSubmit = async (data: CreateAcademyBody) => {
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

      await createAcademy.mutateAsync({ ...data, logoUrl });
      router.replace("/(app)/(manager)/(home)");
    } catch (e) {
      setGeneralError(
        e instanceof Error ? e.message : "Failed to create academy",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="flex-1 px-6 pt-2">
          <BackButton />

          <View className="mt-4 gap-2">
            <Text
              className="font-poppins-bold text-primary"
              style={{ fontSize: 28, letterSpacing: -1 }}
            >
              Create Academy
            </Text>
            <Text className="font-poppins text-[15px] text-[#525252]">
              Set up your BJJ academy
            </Text>
          </View>

          <ScrollView
            className="mt-6 flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-4 pb-4">
              <ImagePickerField
                label="Academy Logo"
                imageUri={imageAsset?.uri ?? null}
                onImageSelected={setImageAsset}
              />

              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Academy Name"
                    placeholder="Enter academy name"
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
                    label="Address"
                    placeholder="Street, city, state"
                    value={value ?? ""}
                    onChangeText={(t) => onChange(t || null)}
                    onBlur={onBlur}
                    error={errors.address?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="contactEmail"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Contact Email"
                    placeholder="academy@email.com"
                    value={value ?? ""}
                    onChangeText={(t) => onChange(t || null)}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={errors.contactEmail?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="contactPhone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Contact Phone"
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
                    label="Founded Date"
                    value={value ?? null}
                    onChange={onChange}
                    error={errors.foundedAt?.message}
                  />
                )}
              />
            </View>
          </ScrollView>

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
                label="Create Academy"
                onPress={handleSubmit(onSubmit)}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
