import { Check, ChevronDown } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

export type ModalSelectOption = {
  value: string;
  label: string;
};

type ModalSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: ModalSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  maxListHeight?: number;
};

export function ModalSelect({
  value,
  onChange,
  options,
  placeholder = "Selecionar",
  disabled,
  maxListHeight = 320,
}: ModalSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    return options.find((o) => o.value === value)?.label;
  }, [options, value]);

  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        className={`h-[52px] flex-row items-center justify-between rounded-xl border border-surface-border bg-surface px-4 ${disabled ? "opacity-60" : ""}`}
      >
        <Text
          className={`font-poppins text-[15px] ${selectedLabel ? "text-primary" : "text-muted"}`}
          numberOfLines={1}
        >
          {selectedLabel ?? placeholder}
        </Text>
        <ChevronDown size={18} color="#525252" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View className="flex-1 justify-center px-6">
          <Pressable
            className="absolute inset-0 bg-black/60"
            onPress={close}
          />

          <View className="overflow-hidden rounded-2xl border border-surface-border bg-surface">
            <ScrollView style={{ maxHeight: maxListHeight }}>
              {options.map((opt, idx) => {
                const selected = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      onChange(opt.value);
                      close();
                    }}
                    className={`flex-row items-center justify-between px-4 py-3 ${idx < options.length - 1 ? "border-b border-surface-border" : ""}`}
                  >
                    <Text
                      className="font-poppins text-sm text-primary"
                      numberOfLines={2}
                    >
                      {opt.label}
                    </Text>
                    {selected ? <Check size={16} color="#A078E8" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

