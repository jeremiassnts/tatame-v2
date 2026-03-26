import { Avatar } from "@/components/Avatar";
import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

type AcademySearchCardProps = {
  name: string;
  address: string | null;
  logoUrl: string | null;
  onPress: () => void;
};

export function AcademySearchCard({
  name,
  address,
  logoUrl,
  onPress,
}: AcademySearchCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-surface-border bg-surface px-4 py-3"
    >
      <Avatar variant="brand" imageUrl={logoUrl} />
      <View className="min-w-0 flex-1" style={{ gap: 2 }}>
        <Text className="font-poppins-semibold text-sm text-primary">{name}</Text>
        {address ? (
          <Text
            className="font-poppins text-xs"
            style={{ color: "#8A8A8A" }}
            numberOfLines={1}
          >
            {address}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color="#525252" />
    </Pressable>
  );
}
