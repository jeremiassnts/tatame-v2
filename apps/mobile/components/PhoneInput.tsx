import { MaskedTextInput } from "react-native-mask-text";
import { View, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";

type PhoneInputProps = {
  label: string;
  /** Raw digits (unmasked), e.g. "11999999999" */
  value: string | null | undefined;
  /** Called with digits only */
  onChangePhone: (digits: string) => void;
  onBlur?: () => void;
  error?: string;
  /** Optional leading icon (used in settings screen) */
  leftIcon?: LucideIcon;
};

export function PhoneInput({
  label,
  value,
  onChangePhone,
  onBlur,
  error,
  leftIcon: LeftIcon,
}: PhoneInputProps) {
  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="font-poppins-medium text-[13px] text-muted">
          {label}
        </Text>
      ) : null}
      <View
        className={`h-[52px] flex-row items-center rounded-xl border bg-surface px-4 ${
          error ? "border-red-500" : "border-surface-border"
        } ${LeftIcon ? "gap-2.5" : ""}`}
      >
        {LeftIcon ? <LeftIcon size={18} color="#525252" /> : null}
        <MaskedTextInput
          mask="(99) 99999-9999"
          keyboardType="phone-pad"
          placeholder="(11) 99999-9999"
          placeholderTextColor="#525252"
          value={value ?? ""}
          onChangeText={(_formatted, unmasked) => {
            onChangePhone(unmasked);
          }}
          onBlur={onBlur}
          autoCorrect={false}
          style={{ flex: 1, fontFamily: "Poppins_400Regular", fontSize: 15, color: "#FFFFFF" }}
        />
      </View>
      {error ? (
        <Text className="font-poppins text-xs text-red-500">{error}</Text>
      ) : null}
    </View>
  );
}
