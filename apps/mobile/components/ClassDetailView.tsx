import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Calendar,
  Check,
  Pencil,
  Timer,
  Trash2,
  User,
  Users,
} from "lucide-react-native";
import { BackButton } from "@/components/BackButton";
import { CapacityBar } from "@/components/CapacityBar";
import { CheckinListItem } from "@/components/CheckinListItem";
import type { CheckinItem } from "@/lib/hooks/use-checkin";

/** Icons + labels in info rows — design.pen M-MGR-08 (jon0a) info items. */
const INFO_ICON = "#525252";
const ACCENT_BAR = "#A078E8";

type ClassData = {
  id: string;
  name: string;
  description?: string | null;
  instructorName?: string;
  dayOfWeekLabel: string;
  startTime: string;
  endTime: string;
  capacity: number | null;
  checkinCount: number;
};

type ClassDetailViewProps = {
  classData: ClassData;
  checkins?: (CheckinItem & {
    userName: string;
    userProfileImageUrl?: string | null;
  })[];
  canEdit?: boolean;
  canDelete?: boolean;
  canCheckin?: boolean;
  checkinDone?: boolean;
  checkinDisabled?: boolean;
  checkinDisabledReason?: string;
  showCheckins?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onCheckin?: () => void;
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center" style={{ gap: 8 }}>
      <Icon size={16} color={INFO_ICON} />
      <View style={{ gap: 1 }}>
        <Text
          className="font-poppins text-[11px]"
          style={{ color: INFO_ICON }}
        >
          {label}
        </Text>
        <Text className="font-poppins-semibold text-[13px] text-primary">
          {value}
        </Text>
      </View>
    </View>
  );
}

export function ClassDetailView({
  classData,
  checkins,
  canEdit,
  canDelete,
  canCheckin,
  checkinDone,
  checkinDisabled,
  checkinDisabledReason,
  showCheckins,
  onEdit,
  onDelete,
  onCheckin,
}: ClassDetailViewProps) {
  const handleDelete = () => {
    Alert.alert(
      "Excluir aula",
      `Tem certeza que deseja excluir "${classData.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: onDelete },
      ],
    );
  };

  const handleCheckinPress = () => {
    if (checkinDone) return;
    if (checkinDisabled) {
      if (checkinDisabledReason) {
        Alert.alert("Check-in indisponível", checkinDisabledReason);
      }
      return;
    }
    onCheckin?.();
  };

  return (
    <>
      <View className="flex-row items-center justify-between px-6 pb-2 pt-2">
        <BackButton />
        <Text className="font-poppins-bold text-lg text-primary">
          Detalhes da aula
        </Text>
        {canEdit ? (
          <Pressable
            onPress={onEdit}
            className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
          >
            <Pencil size={18} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View className="h-10 w-10" />
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 20, gap: 16 }}
        >
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View
              style={{
                width: 4,
                height: 48,
                borderRadius: 2,
                backgroundColor: ACCENT_BAR,
              }}
            />
            <View className="min-w-0 flex-1" style={{ gap: 4 }}>
              <Text
                className="font-poppins-bold text-xl text-primary"
                style={{ letterSpacing: -0.5 }}
              >
                {classData.name}
              </Text>
              {classData.description ? (
                <Text
                  className="font-poppins text-[13px] text-muted"
                  style={{ lineHeight: 1.3 * 13 }}
                >
                  {classData.description}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="h-px w-full bg-surface-border" />

          <View className="flex-row" style={{ gap: 16 }}>
            <View className="flex-1" style={{ gap: 12 }}>
              <InfoRow
                icon={Timer}
                label="Horário"
                value={`${classData.startTime} — ${classData.endTime}`}
              />
              <InfoRow
                icon={Calendar}
                label="Dia"
                value={classData.dayOfWeekLabel}
              />
            </View>
            <View className="flex-1" style={{ gap: 12 }}>
              <InfoRow
                icon={User}
                label="Instrutor"
                value={classData.instructorName ?? "—"}
              />
              <InfoRow
                icon={Users}
                label="Vagas"
                value={
                  classData.capacity != null
                    ? `${classData.checkinCount} / ${classData.capacity} alunos`
                    : "Ilimitado"
                }
              />
            </View>
          </View>

          <CapacityBar
            current={classData.checkinCount}
            max={classData.capacity}
          />
        </View>

        {showCheckins ? (
          <>
            <Text className="font-poppins-semibold text-sm text-muted">
              Check-ins de hoje
            </Text>
            <View style={{ gap: 10 }}>
              {!checkins || checkins.length === 0 ? (
                <View className="items-center rounded-xl border border-surface-border bg-surface py-6">
                  <Text className="font-poppins text-sm text-muted">
                    Nenhum check-in registrado
                  </Text>
                </View>
              ) : (
                checkins.map((c) => (
                  <CheckinListItem
                    key={c.id}
                    userName={c.userName ?? "Aluno"}
                    userProfileImageUrl={c.userProfileImageUrl}
                    checkedInAt={c.checkedInAt}
                  />
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View className="px-6 pb-6" style={{ gap: 12 }}>
        {canCheckin ? (
          <Pressable onPress={handleCheckinPress} disabled={checkinDone}>
            <View className="overflow-hidden rounded-xl">
              <LinearGradient
                colors={
                  checkinDone || checkinDisabled
                    ? ["#3A3A3A", "#3A3A3A"]
                    : ["#A078E8", "#7C5CBF"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="h-[52px] flex-row items-center justify-center gap-2"
              >
                {checkinDone ? (
                  <>
                    <Check size={18} color="#4ADE80" />
                    <Text
                      className="font-poppins-semibold text-[15px]"
                      style={{ color: "#4ADE80" }}
                    >
                      Check-in realizado
                    </Text>
                  </>
                ) : (
                  <Text className="font-poppins-semibold text-[15px] text-white">
                    Fazer check-in
                  </Text>
                )}
              </LinearGradient>
            </View>
          </Pressable>
        ) : null}

        {canDelete ? (
          <Pressable
            onPress={handleDelete}
            className="h-[52px] flex-row items-center justify-center gap-2 rounded-xl border"
            style={{ backgroundColor: "#FF453A15", borderColor: "#FF453A40" }}
          >
            <Trash2 size={18} color="#FF453A" />
            <Text
              className="font-poppins-semibold text-[15px]"
              style={{ color: "#FF453A" }}
            >
              Excluir aula
            </Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}
