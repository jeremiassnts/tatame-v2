import { X } from "lucide-react-native";
import { Image, Modal, Pressable, View } from "react-native";

type ImageViewerModalProps = {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
};

export function ImageViewerModal({ visible, imageUrl, onClose }: ImageViewerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.95)" }}>
        <Pressable
          onPress={onClose}
          className="absolute right-6 top-14 z-10 h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
        >
          <X size={20} color="#FFFFFF" />
        </Pressable>
        <Image
          source={{ uri: imageUrl }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
        />
      </View>
    </Modal>
  );
}
