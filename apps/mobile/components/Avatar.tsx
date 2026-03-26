import { LinearGradient } from "expo-linear-gradient";
import { Grid3x3, type LucideIcon } from "lucide-react-native";
import { Image, Text } from "react-native";

const SIZE = 44;
const GRADIENT_COLORS = ["#A078E8", "#7C5CBF"] as const;

export type AvatarVariant = "brand" | "user";

type AvatarProps = {
  variant: AvatarVariant;
  imageUrl?: string | null;
  /** Used when `variant` is `user` and there is no image. */
  fallbackLetter?: string;
  /** Used when `variant` is `brand` and there is no image. */
  FallbackIcon?: LucideIcon;
  size?: number;
};

export function Avatar({
  variant,
  imageUrl,
  fallbackLetter,
  FallbackIcon = Grid3x3,
  size = SIZE,
}: AvatarProps) {
  const borderRadius = variant === "user" ? size / 2 : 12;

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius }}
      />
    );
  }

  if (variant === "user") {
    const letter = (fallbackLetter?.trim().charAt(0) || "?").toUpperCase();
    return (
      <LinearGradient
        colors={[...GRADIENT_COLORS]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text className="font-poppins-semibold text-lg text-white">
          {letter}
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[...GRADIENT_COLORS]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <FallbackIcon size={22} color="#FFFFFF" />
    </LinearGradient>
  );
}
