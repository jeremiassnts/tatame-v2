import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";

type DatePickerFieldProps = {
  label: string;
  value: string | null;
  onChange: (date: string | null) => void;
  error?: string;
};

export function DatePickerField({
  label,
  value,
  onChange,
  error,
}: DatePickerFieldProps) {
  const [show, setShow] = useState(false);

  const dateValue = value ? new Date(value + "T00:00:00") : new Date();

  const formatDisplay = (dateStr: string | null) => {
    if (!dateStr) return "Select date";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const handleChange = (_event: unknown, selectedDate?: Date) => {
    setShow(Platform.OS === "ios");
    if (selectedDate) {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const dd = String(selectedDate.getDate()).padStart(2, "0");
      onChange(`${yyyy}-${mm}-${dd}`);
    }
  };

  return (
    <View className="gap-1.5">
      <Text className="font-poppins-medium text-[13px] text-muted">
        {label}
      </Text>
      <Pressable
        onPress={() => setShow(true)}
        className={`h-[52px] flex-row items-center rounded-xl border px-4 ${
          error ? "border-red-500" : "border-surface-border"
        } bg-surface`}
      >
        <Calendar size={18} color="#525252" style={{ marginRight: 8 }} />
        <Text
          className={`flex-1 font-poppins text-[15px] ${value ? "text-primary" : "text-[#525252]"}`}
        >
          {formatDisplay(value)}
        </Text>
      </Pressable>
      {show ? (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleChange}
          themeVariant="dark"
        />
      ) : null}
      {error ? (
        <Text className="font-poppins text-xs text-red-500">{error}</Text>
      ) : null}
    </View>
  );
}
