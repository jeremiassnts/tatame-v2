import { Modal, Pressable, Text, View } from "react-native";

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

const SUBSCRIPTION_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "#1A3A1A", text: "#4ADE80" },
  expired: { bg: "#3A1A1A", text: "#F87171" },
  none: { bg: "#2A2A2A", text: "#8A8A8A" },
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  expired: "Expirado",
  none: "Sem plano",
};

type DependentOption = {
  id: string;
  name: string;
  currentBelt?: { belt: string; stripes: number } | null;
  subscriptionStatus?: string | null;
};

export type DependentSelectionModalProps = {
  visible: boolean;
  onClose: () => void;
  /** undefined means "self" (the logged-in user) */
  onSelect: (dependentId?: string) => void;
  dependents: DependentOption[];
  /** false for guardians — they cannot check in as themselves */
  showSelfOption: boolean;
  userName?: string;
  userBelt?: { belt: string; stripes: number } | null;
};

function BeltDot({ belt, size = 12 }: { belt: string; size?: number }) {
  const color = BELT_COLORS[belt] ?? "#666";
  const isBlack = belt === "black";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: isBlack ? 1 : 0,
        borderColor: isBlack ? "rgba(255,255,255,0.18)" : undefined,
      }}
    />
  );
}

function SubscriptionBadge({ status }: { status: string | null | undefined }) {
  const key = status ?? "none";
  const colors = SUBSCRIPTION_STATUS_COLORS[key] ?? SUBSCRIPTION_STATUS_COLORS.none;
  const label = SUBSCRIPTION_STATUS_LABELS[key] ?? key;
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
        backgroundColor: colors.bg,
      }}
    >
      <Text
        style={{
          fontFamily: "Poppins_500Medium",
          fontSize: 10,
          color: colors.text,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function SelectionRow({
  name,
  belt,
  stripes,
  subscriptionStatus,
  isLast,
  onPress,
}: {
  name: string;
  belt?: string | null;
  stripes?: number | null;
  subscriptionStatus?: string | null;
  isLast: boolean;
  onPress: () => void;
}) {
  const beltLabel = belt ? (BELT_LABELS[belt] ?? belt) : null;
  const beltSub =
    beltLabel && stripes != null && stripes > 0
      ? `${beltLabel} · ${stripes} ${stripes === 1 ? "grau" : "graus"}`
      : beltLabel ?? null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 12,
        backgroundColor: pressed ? "#232323" : "transparent",
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#2A2A2A",
      })}
    >
      {/* Belt dot */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "#2A2A2A",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {belt ? (
          <BeltDot belt={belt} size={16} />
        ) : (
          <View
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: "#3A3A3A",
            }}
          />
        )}
      </View>

      {/* Name + belt info */}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: "Poppins_600SemiBold",
            fontSize: 14,
            color: "#FFFFFF",
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        {beltSub ? (
          <Text
            style={{
              fontFamily: "Poppins_400Regular",
              fontSize: 12,
              color: "#8A8A8A",
            }}
          >
            {beltSub}
          </Text>
        ) : null}
      </View>

      {/* Subscription badge */}
      {subscriptionStatus !== undefined ? (
        <SubscriptionBadge status={subscriptionStatus} />
      ) : null}
    </Pressable>
  );
}

export function DependentSelectionModal({
  visible,
  onClose,
  onSelect,
  dependents,
  showSelfOption,
  userName,
  userBelt,
}: DependentSelectionModalProps) {
  const rows: Array<{
    key: string;
    name: string;
    belt?: string | null;
    stripes?: number | null;
    subscriptionStatus?: string | null;
    onPress: () => void;
  }> = [];

  if (showSelfOption) {
    rows.push({
      key: "__self__",
      name: userName ? `${userName} (Eu)` : "Eu",
      belt: userBelt?.belt ?? null,
      stripes: userBelt?.stripes ?? null,
      subscriptionStatus: undefined, // self — no badge needed
      onPress: () => onSelect(undefined),
    });
  }

  for (const dep of dependents) {
    rows.push({
      key: dep.id,
      name: dep.name,
      belt: dep.currentBelt?.belt ?? null,
      stripes: dep.currentBelt?.stripes ?? null,
      subscriptionStatus: dep.subscriptionStatus,
      onPress: () => onSelect(dep.id),
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        {/* Backdrop */}
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#00000099",
          }}
        />

        {/* Sheet */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#1A1A1A",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: "center", paddingTop: 12 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#525252",
              }}
            />
          </View>

          {/* Title */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: "#2A2A2A",
            }}
          >
            <Text
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 16,
                color: "#FFFFFF",
              }}
            >
              Check-in para quem?
            </Text>
          </View>

          {/* Options */}
          <View>
            {rows.map((row, idx) => (
              <SelectionRow
                key={row.key}
                name={row.name}
                belt={row.belt}
                stripes={row.stripes}
                subscriptionStatus={row.subscriptionStatus}
                isLast={idx === rows.length - 1}
                onPress={() => {
                  onClose();
                  row.onPress();
                }}
              />
            ))}
          </View>

          {/* Bottom safe area */}
          <View style={{ height: 42 }} />
        </View>
      </View>
    </Modal>
  );
}
