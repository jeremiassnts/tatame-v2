import { Pressable, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";

type GradientButtonProps = {
  label: string;
  onPress: () => void;
};

export function GradientButton({ label, onPress }: GradientButtonProps) {
  return (
    <Pressable onPress={onPress} className="w-full">
      <LinearGradient
        colors={["#A078E8", "#7C5CBF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="h-14 flex-row items-center justify-center rounded-xl"
      >
        <Text className="font-poppins-semibold text-base text-white">
          {label}
        </Text>
        <ArrowRight size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
      </LinearGradient>
    </Pressable>
  );
}
