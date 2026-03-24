import { View, Text, Pressable, Image } from "react-native";
import { ImagePlus } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

type ImagePickerFieldProps = {
  label: string;
  imageUri: string | null;
  onImageSelected: (asset: ImagePicker.ImagePickerAsset) => void;
  error?: string;
};

export function ImagePickerField({
  label,
  imageUri,
  onImageSelected,
  error,
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

  return (
    <View className="gap-1.5">
      <Text className="font-poppins-medium text-[13px] text-muted">
        {label}
      </Text>
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
