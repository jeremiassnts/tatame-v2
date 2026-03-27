import { BackButton } from "@/components/BackButton";
import { FormInput } from "@/components/FormInput";
import { ModalSelect } from "@/components/ModalSelect";
import { TimePickerField } from "@/components/TimePickerField";
import { LinearGradient } from "expo-linear-gradient";
import { Check, Lock } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";

const DAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const DAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

type Instructor = { id: string; name: string };

export type ClassFormData = {
  name: string;
  description: string;
  instructorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number | null;
  /** Only for create mode — additional days to create on */
  extraDays?: number[];
};

type ClassFormProps = {
  mode: "create" | "edit";
  canSelectInstructor?: boolean;
  currentInstructorName?: string;
  instructors?: Instructor[];
  initialData?: Partial<ClassFormData>;
  onSubmit: (data: ClassFormData) => void;
  isSubmitting?: boolean;
};

export function ClassForm({
  mode,
  canSelectInstructor,
  currentInstructorName,
  instructors,
  initialData,
  onSubmit,
  isSubmitting,
}: ClassFormProps) {
  const [form, setForm] = useState(() => ({
    name: initialData?.name ?? "",
    description: initialData?.description ?? "",
    instructorId: initialData?.instructorId ?? "",
    dayOfWeek: initialData?.dayOfWeek ?? 1,
    startTime: initialData?.startTime ?? "",
    endTime: initialData?.endTime ?? "",
    capacityText:
      initialData?.capacity != null ? String(initialData.capacity) : "",
    unlimited: initialData?.capacity === null,
    selectedExtraDays: [] as number[],
  }));

  const handleSubmit = () => {
    onSubmit({
      name: form.name.trim(),
      description: form.description.trim(),
      instructorId: form.instructorId,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      capacity: form.unlimited ? null : Number(form.capacityText) || null,
      extraDays: mode === "create" ? form.selectedExtraDays : undefined,
    });
  };

  const toggleExtraDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      selectedExtraDays: prev.selectedExtraDays.includes(day)
        ? prev.selectedExtraDays.filter((d) => d !== day)
        : [...prev.selectedExtraDays, day],
    }));
  };

  const title = mode === "create" ? "Nova aula" : "Editar aula";

  return (
    <>
      <View className="flex-row items-center justify-between px-6 pb-2 pt-2">
        <BackButton />
        <Text className="font-poppins-bold text-lg text-primary">{title}</Text>
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: 24,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <FormInput
          label="Nome da aula"
          value={form.name}
          onChangeText={(v) => setForm((prev) => ({ ...prev, name: v }))}
          placeholder="Ex: Fundamentos"
        />

        <FormInput
          label="Descrição"
          value={form.description}
          onChangeText={(v) => setForm((prev) => ({ ...prev, description: v }))}
          placeholder="Descrição opcional da aula..."
          multiline
          numberOfLines={3}
          style={{ height: 80 }}
        />

        <View style={{ gap: 6 }}>
          <Text className="font-poppins-medium text-[13px] text-muted">
            {canSelectInstructor
              ? "Instrutor"
              : "Instrutor (definido automaticamente)"}
          </Text>
          {canSelectInstructor ? (
            <ModalSelect
              value={form.instructorId}
              onChange={(v) => setForm((prev) => ({ ...prev, instructorId: v }))}
              placeholder="Selecionar instrutor"
              options={(instructors ?? []).map((i) => ({
                value: i.id,
                label: i.name,
              }))}
            />
          ) : (
            <View className="h-[52px] flex-row items-center gap-2.5 rounded-xl border border-surface-border bg-surface px-4">
              <Text className="flex-1 font-poppins text-[15px] text-primary">
                {currentInstructorName ?? "—"}
              </Text>
              <Lock size={16} color="#525252" />
            </View>
          )}
        </View>

        <View style={{ gap: 6 }}>
          <Text className="font-poppins-medium text-[13px] text-muted">
            Dia da semana
          </Text>
          <ModalSelect
            value={String(form.dayOfWeek)}
            onChange={(v) =>
              setForm((prev) => ({ ...prev, dayOfWeek: Number(v) }))
            }
            options={DAY_LABELS.map((label, i) => ({
              value: String(i),
              label,
            }))}
          />
        </View>

        <View className="flex-row" style={{ gap: 12 }}>
          <View className="flex-1">
            <TimePickerField
              label="Início"
              value={form.startTime}
              onChange={(v) => setForm((prev) => ({ ...prev, startTime: v }))}
              placeholder="19:00"
            />
          </View>
          <View className="flex-1">
            <TimePickerField
              label="Término"
              value={form.endTime}
              onChange={(v) => setForm((prev) => ({ ...prev, endTime: v }))}
              placeholder="20:30"
            />
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <View className="flex-row items-center justify-between">
            <Text className="font-poppins-medium text-[13px] text-muted">
              Capacidade máxima
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="font-poppins text-xs text-muted">Ilimitado</Text>
              <Switch
                value={form.unlimited}
                onValueChange={(v) => {
                  setForm((prev) => ({
                    ...prev,
                    unlimited: v,
                    capacityText: v ? "" : prev.capacityText,
                  }));
                }}
                trackColor={{ false: "#3A3A3A", true: "#A078E8" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
          {!form.unlimited ? (
            <FormInput
              label=""
              value={form.capacityText}
              onChangeText={(v) =>
                setForm((prev) => ({ ...prev, capacityText: v }))
              }
              placeholder="20"
              keyboardType="number-pad"
            />
          ) : null}
        </View>

        {mode === "create" ? (
          <View
            className="rounded-xl border border-surface-border bg-surface p-4 gap-4"
          >
            <View className="gap-1">
              <Text className="font-poppins-semibold text-sm text-primary">
                Criar para múltiplos dias
              </Text>
              <Text className="font-poppins text-xs text-muted">
                Repita esta aula em outros dias da semana
              </Text>
            </View>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {DAY_SHORT.map((label, i) => {
                if (i === form.dayOfWeek) return null;
                const selected = form.selectedExtraDays.includes(i);
                return (
                  <Pressable
                    key={label}
                    onPress={() => toggleExtraDay(i)}
                    className={`items-center justify-center rounded-lg border px-3 py-2 ${selected
                      ? "border-accent bg-accent-translucent"
                      : "border-surface-border bg-surface"
                      }`}
                  >
                    <Text
                      className={`font-poppins-medium text-xs ${selected ? "text-accent" : "text-muted"
                        }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View className="px-6 pb-6">
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting || !form.name.trim()}
        >
          <View className="overflow-hidden rounded-xl">
            <LinearGradient
              colors={
                isSubmitting || !form.name.trim()
                  ? ["#3A3A3A", "#3A3A3A"]
                  : ["#A078E8", "#7C5CBF"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="h-14 flex-row items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Check size={20} color="#FFFFFF" />
                  <Text className="font-poppins-semibold text-base text-white">
                    Salvar aula
                  </Text>
                </>
              )}
            </LinearGradient>
          </View>
        </Pressable>
      </View>
    </>
  );
}
