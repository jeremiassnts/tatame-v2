import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

type BackButtonProps = {
  onPress?: () => void;
};

export function BackButton({ onPress }: BackButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
    >
      <ArrowLeft size={20} color="#FFFFFF" />
    </Pressable>
  );
}
