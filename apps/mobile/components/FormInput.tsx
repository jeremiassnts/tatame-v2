import { useState } from "react";
import { View, Text, TextInput, Pressable, TextInputProps } from "react-native";
import { EyeOff, Eye } from "lucide-react-native";

type FormInputProps = {
  label: string;
  error?: string;
} & TextInputProps;

export function FormInput({
  label,
  error,
  secureTextEntry,
  ...props
}: FormInputProps) {
  const [hidden, setHidden] = useState(secureTextEntry);

  return (
    <View className="gap-1.5">
      <Text className="font-poppins-medium text-[13px] text-muted">{label}</Text>
      <View
        className={`h-[52px] flex-row items-center rounded-xl border bg-surface px-4 ${
          error ? "border-red-500" : "border-surface-border"
        }`}
      >
        <TextInput
          className="flex-1 font-poppins text-[15px] text-primary"
          placeholderTextColor="#525252"
          secureTextEntry={!!hidden}
          autoCorrect={false}
          {...props}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setHidden((h) => !h)} className="ml-2">
            {hidden ? (
              <EyeOff size={20} color="#525252" />
            ) : (
              <Eye size={20} color="#525252" />
            )}
          </Pressable>
        )}
      </View>
      {error ? <Text className="font-poppins text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
