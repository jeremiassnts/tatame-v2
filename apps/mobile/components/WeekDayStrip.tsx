import { Pressable, Text, View } from "react-native";

/** Weekday row labels — matches design.pen "Week Days" (node s5xEh). */
const DAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

/** Unselected label + number color from design (not `muted` #ABABAB). */
const DAY_STRIP_MUTED = "#525252";

type WeekDayStripProps = {
  selectedDay: number;
  onDaySelect: (day: number) => void;
};

function getWeekDates(): { day: number; date: number }[] {
  const today = new Date();
  const currentDay = today.getDay();
  const result: { day: number; date: number }[] = [];

  for (let i = 0; i < 7; i++) {
    const diff = i - currentDay;
    const d = new Date(today);
    d.setDate(today.getDate() + diff);
    result.push({ day: i, date: d.getDate() });
  }

  return result;
}

export function WeekDayStrip({ selectedDay, onDaySelect }: WeekDayStripProps) {
  const weekDates = getWeekDates();

  return (
    <View className="flex-row" style={{ gap: 6 }}>
      {weekDates.map(({ day, date }) => {
        const isSelected = day === selectedDay;
        return (
          <Pressable
            key={day}
            onPress={() => onDaySelect(day)}
            className={`flex-1 items-center justify-center rounded-[12px] ${
              isSelected ? "bg-accent" : "border border-surface-border bg-surface"
            }`}
            style={{ height: 56, gap: 2 }}
          >
            <Text
              className={`font-poppins text-[10px] ${
                isSelected ? "font-poppins-semibold text-primary" : "font-poppins-medium"
              }`}
              style={{
                letterSpacing: 0.5,
                ...(isSelected ? undefined : { color: DAY_STRIP_MUTED }),
              }}
            >
              {DAY_LABELS[day]}
            </Text>
            <Text
              className={
                isSelected
                  ? "font-poppins-bold text-primary"
                  : "font-poppins-semibold"
              }
              style={{
                fontSize: 15,
                ...(isSelected ? {} : { color: DAY_STRIP_MUTED }),
              }}
            >
              {date}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
