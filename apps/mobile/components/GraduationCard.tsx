import type { BeltPromotionResponse } from "@tatame/validators";
import { Pressable, Text, View } from "react-native";

const BELT_COLORS: Record<string, string> = {
  white: "#E0E0E0",
  blue: "#2196F3",
  purple: "#9C27B0",
  brown: "#795548",
  black: "#212121",
};

const BELT_LABELS: Record<string, string> = {
  white: "Branca",
  blue: "Azul",
  purple: "Roxa",
  brown: "Marrom",
  black: "Preta",
};

/** Alinhado a `MAX_STRIPES_BY_BELT` em `@tatame/config`. */
const MAX_STRIPES_BY_BELT: Record<string, number> = {
  white: 4,
  blue: 4,
  purple: 4,
  brown: 4,
  black: 10,
};

/** Anel discreto para #212121 sobre fundo escuro (#1A1A1A / surface). */
const BLACK_BELT_OUTLINE = "rgba(255, 255, 255, 0.18)";

type GraduationCardProps = {
  graduation: BeltPromotionResponse | null | undefined;
  variant: "compact" | "full";
  onRegisterPress?: () => void;
};

function StripeDots({
  beltKey,
  stripes,
  compact,
}: {
  beltKey: string;
  stripes: number;
  compact?: boolean;
}) {
  const max = MAX_STRIPES_BY_BELT[beltKey] ?? 4;
  const count = max + 1;
  const dot = 8;
  const gap = 5;
  return (
    <View
      className={`flex-row items-center ${compact ? "flex-wrap" : ""}`}
      style={{ gap }}
    >
      {Array.from({ length: count }, (_, idx) => (
        <View
          key={idx}
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: idx < stripes ? "#FFFFFF" : "#3A3A3A",
          }}
        />
      ))}
    </View>
  );
}

function BeltSwatch({
  graduation,
  size,
}: {
  graduation: BeltPromotionResponse | null | undefined;
  size: number;
}) {
  const belt = graduation?.belt;
  const isBlack = belt === "black";
  const fill =
    graduation && belt
      ? BELT_COLORS[belt] ?? "#666"
      : "#3A3A3A";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: fill,
        borderWidth: isBlack ? 1 : 0,
        borderColor: isBlack ? BLACK_BELT_OUTLINE : undefined,
      }}
    />
  );
}

export function GraduationCard({
  graduation,
  variant,
  onRegisterPress,
}: GraduationCardProps) {
  const isCompact = variant === "compact";
  const isPressable = !graduation && typeof onRegisterPress === "function";

  const circleSize = isCompact ? 32 : 36;
  const labelClass = "font-poppins text-xs text-muted";
  const titleClass = "font-poppins-bold text-primary";

  const infoStack = (
    <View style={{ gap: 2, flexShrink: 1 }}>
      <Text className={labelClass}>Faixa atual</Text>
      {graduation ? (
        <>
          <Text className={titleClass} style={{ fontSize: 15, lineHeight: 20 }}>
            {(BELT_LABELS[graduation.belt] ?? graduation.belt)}
          </Text>
          {graduation.stripes > 0 && <Text className={labelClass}>{graduation.stripes} {graduation.stripes === 1 ? "grau" : "graus"}</Text>}
        </>
      ) : (
        <Text className={titleClass} style={{ fontSize: 15, lineHeight: 20 }}>
          Não registrada
          {isPressable ? (
            <Text style={{ fontSize: 15, color: "#A078E8" }}>{", clique para registrar"}</Text>
          ) : null}
        </Text>
      )}
    </View>
  );

  /** Layout do design.pen (Belt Card HkzwF): linha com círculo + texto à esquerda, graus à direita. */
  const fullLayout = (
    <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
      <View className="min-w-0 flex-1 flex-row items-center" style={{ gap: 12 }}>
        <BeltSwatch graduation={graduation} size={circleSize} />
        {infoStack}
      </View>
      {graduation ? (
        <StripeDots beltKey={graduation.belt} stripes={graduation.stripes} />
      ) : null}
    </View>
  );

  /** Card estreito na home do aluno: círculo + texto; graus na linha de baixo. */
  const compactLayout = (
    <View style={{ gap: 12 }}>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <BeltSwatch graduation={graduation} size={circleSize} />
        {infoStack}
      </View>
      {graduation ? (
        <StripeDots beltKey={graduation.belt} stripes={graduation.stripes} compact />
      ) : null}
    </View>
  );

  const inner = isCompact ? compactLayout : fullLayout;

  if (isPressable) {
    return (
      <Pressable
        onPress={onRegisterPress}
        className="rounded-2xl border border-surface-border bg-surface"
        style={{
          flex: isCompact ? 1 : undefined,
          padding: 16,
        }}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      className="rounded-2xl border border-surface-border bg-surface"
      style={{
        flex: isCompact ? 1 : undefined,
        padding: 16,
      }}
    >
      {inner}
    </View>
  );
}
