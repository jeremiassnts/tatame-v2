import { View, Text, Pressable, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Grid3x3, ImagePlus } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

const LOGO_HERO_SIZE = 88;

type ImagePickerFieldProps = {
  label: string;
  imageUri: string | null;
  onImageSelected: (asset: ImagePicker.ImagePickerAsset) => void;
  error?: string;
  /**
   * `academySettings` — circular hero + gradient placeholder + “Alterar logo” (Pencil M-MGR-03).
   */
  variant?: "default" | "academySettings";
};

export function ImagePickerField({
  label,
  imageUri,
  onImageSelected,
  error,
  variant = "default",
}: ImagePickerFieldProps) {
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      onImageSelected(result.assets[0]);
    }
  };

  if (variant === "academySettings") {
    return (
      <View className="items-center">
        <Pressable
          onPress={pickImage}
          className="items-center gap-3 active:opacity-90"
        >
          <View
            className={`items-center justify-center overflow-hidden rounded-full border ${
              error ? "border-red-500" : "border-surface-border"
            }`}
            style={{ width: LOGO_HERO_SIZE, height: LOGO_HERO_SIZE }}
          >
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={["#A078E8", "#7C5CBF"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{
                  width: LOGO_HERO_SIZE,
                  height: LOGO_HERO_SIZE,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Grid3x3 size={40} color="#FFFFFF" />
              </LinearGradient>
            )}
          </View>
          <Text className="font-poppins-medium text-[13px] text-accent">
            Alterar logo
          </Text>
        </Pressable>
        {error ? (
          <Text className="font-poppins text-xs text-red-500">{error}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="font-poppins-medium text-[13px] text-muted">
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={pickImage}
        className={`h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border ${
          error ? "border-red-500" : "border-surface-border"
        } bg-surface`}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <ImagePlus size={28} color="#ABABAB" />
        )}
      </Pressable>
      {error ? (
        <Text className="font-poppins text-xs text-red-500">{error}</Text>
      ) : null}
    </View>
  );
}
