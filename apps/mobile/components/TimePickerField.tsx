import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Clock } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";

type TimePickerFieldProps = {
  label: string;
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
  error?: string;
};

function parseTimeToDate(time: string | undefined) {
  const now = new Date();
  const [hRaw, mRaw] = (time ?? "").split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);

  if (Number.isFinite(h) && Number.isFinite(m)) {
    now.setHours(h, m, 0, 0);
  } else {
    now.setSeconds(0, 0);
  }
  return now;
}

function formatDateToTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function TimePickerField({
  label,
  value,
  onChange,
  placeholder = "Selecionar horário",
  error,
}: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => parseTimeToDate(value));

  const display = useMemo(() => (value?.length ? value : placeholder), [
    placeholder,
    value,
  ]);

  const close = () => setOpen(false);

  const openPicker = () => {
    setDraft(parseTimeToDate(value));
    setOpen(true);
  };

  const handleAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === "dismissed") {
      close();
      return;
    }
    if (date) onChange(formatDateToTime(date));
    close();
  };

  return (
    <View className="gap-1.5">
      <Text className="font-poppins-medium text-[13px] text-muted">{label}</Text>

      <Pressable
        onPress={openPicker}
        className={`h-[52px] flex-row items-center rounded-xl border px-4 ${error ? "border-red-500" : "border-surface-border"} bg-surface gap-2`}
      >
        <Clock size={18} color="#525252" />
        <Text
          className={`font-poppins text-[15px] flex-1 ${value?.length ? "text-primary" : "text-[#525252]"}`}
          numberOfLines={1}
        >
          {display}
        </Text>
      </Pressable>

      {Platform.OS === "android" ? (
        open ? (
          <DateTimePicker
            value={draft}
            mode="time"
            is24Hour={true}
            timeZoneName="America/Sao_Paulo"
            locale="pt-BR"
            display="default"
            onChange={handleAndroidChange}
            themeVariant="dark"
          />
        ) : null
      ) : (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={close}
        >
          <View className="flex-1 justify-center px-6">
            <Pressable className="absolute inset-0 bg-black/60" onPress={close} />

            <View className="overflow-hidden rounded-2xl border border-surface-border bg-surface p-4 gap-4">
              <DateTimePicker
                value={draft}
                mode="time"
                is24Hour={true}
                timeZoneName="America/Sao_Paulo"
                locale="pt-BR"
                display="spinner"
                onChange={(_e, d) => {
                  if (d) setDraft(d);
                }}
                themeVariant="dark"
              />

              <View className="flex-row justify-end gap-3">
                <Pressable onPress={close} className="px-3 py-2">
                  <Text className="font-poppins-medium text-sm text-muted">
                    Cancelar
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onChange(formatDateToTime(draft));
                    close();
                  }}
                  className="px-3 py-2"
                >
                  <Text className="font-poppins-semibold text-sm text-accent">
                    OK
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {error ? <Text className="font-poppins text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}

