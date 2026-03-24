import { View, Text } from "react-native";

type DividerProps = {
  text?: string;
};

export function Divider({ text = "ou" }: DividerProps) {
  return (
    <View className="flex-row items-center gap-3 py-1">
      <View className="h-px flex-1 bg-[#2A2A2A]" />
      <Text className="font-poppins text-xs text-[#525252]">{text}</Text>
      <View className="h-px flex-1 bg-[#2A2A2A]" />
    </View>
  );
}
