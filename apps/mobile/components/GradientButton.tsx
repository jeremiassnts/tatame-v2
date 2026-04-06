import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text } from "react-native";

type GradientButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function GradientButton({ label, onPress, disabled, loading }: GradientButtonProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading}>
      <LinearGradient
        colors={disabled ? ["#3A3A3A", "#3A3A3A"] : ["#A078E8", "#7C5CBF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          height: 40,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text className="font-poppins-semibold text-base text-white">
              {label}
            </Text>
            <ArrowRight size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}
