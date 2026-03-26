import { useState } from "react";
import { View, Text, TextInput, Pressable, TextInputProps } from "react-native";
import { EyeOff, Eye, type LucideIcon } from "lucide-react-native";

type FormInputProps = {
  label: string;
  error?: string;
  /** Optional leading icon (e.g. map-pin, mail) — manager settings layout. */
  leftIcon?: LucideIcon;
} & TextInputProps;

export function FormInput({
  label,
  error,
  secureTextEntry,
  leftIcon: LeftIcon,
  ...props
}: FormInputProps) {
  const [hidden, setHidden] = useState(secureTextEntry);

  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="font-poppins-medium text-[13px] text-muted">{label}</Text>
      ) : null}
      <View
        className={`h-[52px] flex-row items-center rounded-xl border bg-surface px-4 ${
          error ? "border-red-500" : "border-surface-border"
        } ${LeftIcon ? "gap-2.5" : ""}`}
      >
        {LeftIcon ? <LeftIcon size={18} color="#525252" /> : null}
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
