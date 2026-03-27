import { BackButton } from "@/components/BackButton";
import { ClassCard } from "@/components/ClassCard";
import { WeekDayStrip } from "@/components/WeekDayStrip";
import { useClasses } from "@/lib/hooks/use-classes";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_MUTED = "#525252";

const DAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

function formatTime(t: string) {
  const parts = t.split(":");
  const h = parts[0] ?? "0";
  const m = parts[1] ?? "00";
  return `${h.padStart(2, "0")}:${m}`;
}

function getDateLabel(dayOfWeek: number): string {
  const today = new Date();
  const diff = dayOfWeek - today.getDay();
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  const dayName = DAY_NAMES[dayOfWeek];
  const d = target.getDate();
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const monthName = months[target.getMonth()];
  return `${dayName}, ${d} de ${monthName}`;
}

export default function ManagerClassSchedule() {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const { data: classes, isLoading } = useClasses(selectedDay);

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <View className="flex-row items-center justify-between px-6 pb-2 pt-2">
        <BackButton />
        <Text className="font-poppins-bold text-lg text-primary">Agenda</Text>
        <Pressable
          onPress={() => router.push("/(app)/(manager)/(classes)/create")}
          className="h-10 w-10 items-center justify-center rounded-xl bg-accent"
        >
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: 24,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <WeekDayStrip selectedDay={selectedDay} onDaySelect={setSelectedDay} />

        <Text className="font-poppins-semibold text-sm text-muted">
          {getDateLabel(selectedDay)}
        </Text>

        <View style={{ gap: 10 }}>
          {isLoading ? (
            <View className="items-center py-8">
              <Text className="font-poppins text-sm text-muted">
                Carregando...
              </Text>
            </View>
          ) : !classes || classes.length === 0 ? (
            <View className="items-center rounded-[14px] border border-surface-border bg-surface py-8">
              <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
                Nenhuma aula neste dia
              </Text>
            </View>
          ) : (
            classes.map((cls) => (
              <ClassCard
                key={cls.id}
                name={cls.name}
                startTime={formatTime(cls.startTime)}
                endTime={formatTime(cls.endTime)}
                instructorName={cls.instructorName ?? undefined}
                capacity={cls.capacity}
                onPress={() => router.push(`/(app)/(manager)/(classes)/${cls.id}`)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
