import { Text, View } from "react-native";

type BadgeVariant = "role" | "status";

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  instructor: { bg: "#2A2A2A", text: "#A078E8" },
  student: { bg: "#2A2A2A", text: "#8A8A8A" },
  manager: { bg: "#2A2A2A", text: "#A078E8" },
  guardian: { bg: "#2A2A2A", text: "#8A8A8A" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "#1A3A1A", text: "#4ADE80" },
  pending: { bg: "#3A3A1A", text: "#FFD60A" },
  blocked: { bg: "#3A1A1A", text: "#F87171" },
  rejected: { bg: "#3A1A1A", text: "#F87171" },
};

const ROLE_LABELS: Record<string, string> = {
  instructor: "Instrutor",
  student: "Aluno",
  manager: "Gestor",
  guardian: "Responsável",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  pending: "Pendente",
  blocked: "Bloqueado",
  rejected: "Rejeitado",
};

type BadgeProps = {
  variant: BadgeVariant;
  value: string;
};

export function Badge({ variant, value }: BadgeProps) {
  const colors =
    variant === "role"
      ? (ROLE_COLORS[value] ?? ROLE_COLORS.student)
      : (STATUS_COLORS[value] ?? STATUS_COLORS.active);

  const label =
    variant === "role" ? (ROLE_LABELS[value] ?? value) : (STATUS_LABELS[value] ?? value);

  return (
    <View
      className="rounded-full px-2.5 py-0.5"
      style={{ backgroundColor: colors.bg }}
    >
      <Text
        className="font-poppins-medium text-[10px]"
        style={{ color: colors.text }}
      >
        {label}
      </Text>
    </View>
  );
}
