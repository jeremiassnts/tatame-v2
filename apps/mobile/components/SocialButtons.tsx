import { View, Text, Pressable } from "react-native";
import GoogleIcon from "@/assets/icons/google.svg";
import AppleIcon from "@/assets/icons/apple.svg";

type SocialButtonsProps = {
  onGooglePress: () => void;
  onApplePress: () => void;
  disabled?: boolean;
};

export function SocialButtons({
  onGooglePress,
  onApplePress,
  disabled,
}: SocialButtonsProps) {
  return (
    <View className="flex-row gap-3">
      <Pressable
        onPress={onGooglePress}
        disabled={disabled}
        className="h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface"
      >
        <GoogleIcon width={20} height={20} />
        <Text className="font-poppins-medium text-sm text-primary">Google</Text>
      </Pressable>
      <Pressable
        onPress={onApplePress}
        disabled={disabled}
        className="h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface"
      >
        <AppleIcon width={20} height={20} />
        <Text className="font-poppins-medium text-sm text-primary">Apple</Text>
      </Pressable>
    </View>
  );
}
