import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";
import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";

type DatePickerFieldProps = {
  label: string;
  value: string | null;
  onChange: (date: string | null) => void;
  error?: string;
  /** When true, calendar icon on the right (M-MGR-03 settings). */
  iconTrailing?: boolean;
};

function toDateString(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function DatePickerField({
  label,
  value,
  onChange,
  error,
  iconTrailing = false,
}: DatePickerFieldProps) {
  const [show, setShow] = useState(false);

  const dateValue = value ? new Date(value + "T00:00:00") : new Date();

  const formatDisplay = (dateStr: string | null) => {
    if (!dateStr) return "Selecione a data";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const handleChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === "android") setShow(false);
    if (selectedDate) onChange(toDateString(selectedDate));
  };

  return (
    <View className="gap-1.5">
      <Text className="font-poppins-medium text-[13px] text-muted">
        {label}
      </Text>
      <Pressable
        onPress={() => setShow(true)}
        className={`h-[52px] flex-row items-center rounded-xl border px-4 ${error ? "border-red-500" : "border-surface-border"
          } bg-surface ${iconTrailing ? "justify-between" : "gap-2"}`}
      >
        {!iconTrailing ? (
          <Calendar size={18} color="#525252" />
        ) : null}
        <Text
          className={`font-poppins text-[15px] ${iconTrailing ? "" : "flex-1"} ${value ? "text-primary" : "text-[#525252]"}`}
        >
          {formatDisplay(value)}
        </Text>
        {iconTrailing ? <Calendar size={18} color="#525252" /> : null}
      </Pressable>

      {Platform.OS === "ios" && show ? (
        <Modal transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <Pressable
            className="flex-1 items-center justify-center bg-black/80"
            onPress={() => setShow(false)}
          >
            <Pressable className="mx-6 w-[90%] rounded-2xl bg-surface-card pb-6 pt-2">
              <DateTimePicker
                value={dateValue}
                mode="date"
                display="spinner"
                onChange={handleChange}
                themeVariant="dark"
              />
              <View className="px-4">
                <Pressable
                  onPress={() => setShow(false)}
                  className="h-[48px] items-center justify-center rounded-xl bg-accent"
                >
                  <Text className="font-poppins-semibold text-[15px] text-white">
                    OK
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {Platform.OS === "android" && show ? (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
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
