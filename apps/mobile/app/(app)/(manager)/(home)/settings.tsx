import { useState, useEffect } from "react";
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
import {
  updateAcademyBodySchema,
  type UpdateAcademyBody,
} from "@tatame/validators";
import type { ImagePickerAsset } from "expo-image-picker";
import { BackButton } from "@/components/BackButton";
import { FormInput } from "@/components/FormInput";
import { GradientButton } from "@/components/GradientButton";
import { ImagePickerField } from "@/components/ImagePickerField";
import { DatePickerField } from "@/components/DatePickerField";
import { useAcademyContext } from "@/lib/academy-context";
import { useAcademy, useUpdateAcademy } from "@/lib/hooks/use-academy";
import { useUploadImage } from "@/lib/hooks/use-upload";

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
        e instanceof Error ? e.message : "Failed to save changes",
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
              Academy Settings
            </Text>
            <Text className="font-poppins text-[15px] text-[#525252]">
              Update your academy information
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
                imageUri={imageAsset?.uri ?? academy?.logoUrl ?? null}
                onImageSelected={setImageAsset}
              />

              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormInput
                    label="Academy Name"
                    placeholder="Enter academy name"
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
            {saved ? (
              <View className="h-14 items-center justify-center rounded-xl bg-accent">
                <Text className="font-poppins-semibold text-base text-white">
                  Saved!
                </Text>
              </View>
            ) : (
              <GradientButton
                label="Save Changes"
                onPress={handleSubmit(onSubmit)}
                disabled={!hasChanges}
                loading={submitting}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
