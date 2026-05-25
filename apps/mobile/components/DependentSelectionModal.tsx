import { BELT_COLORS } from "@/lib/belts";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SelectionCard } from "./SelectionCard";

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

export function DependentSelectionModal({
  visible,
  onClose,
  onSelect,
  dependents,
  showSelfOption,
  userName,
  userBelt,
}: DependentSelectionModalProps) {
  const insets = useSafeAreaInsets();

  const rows: Array<{
    key: string;
    name: string;
    initials?: string;
    avatarBg: string;
    iconColor?: string;
    belt?: string | null;
    stripes?: number | null;
    subscriptionStatus?: string | null;
    onPress: () => void;
  }> = [];

  if (showSelfOption) {
    const initials = userName
      ? userName
          .split(" ")
          .filter((w) => w.length > 0)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "EU";

    rows.push({
      key: "__self__",
      name: "Eu",
      initials,
      avatarBg: "#A078E8",
      belt: userBelt?.belt ?? null,
      stripes: userBelt?.stripes ?? null,
      subscriptionStatus: undefined,
      onPress: () => onSelect(undefined),
    });
  }

  for (const dep of dependents) {
    const belt = dep.currentBelt?.belt ?? null;
    const beltColor = belt ? (BELT_COLORS[belt] ?? "#FFFFFF") : "#FFFFFF";
    rows.push({
      key: dep.id,
      name: dep.name,
      avatarBg: `${beltColor}30`,
      iconColor: beltColor,
      belt,
      stripes: dep.currentBelt?.stripes ?? null,
      subscriptionStatus: dep.subscriptionStatus,
      onPress: () => onSelect(dep.id),
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1">
        {/* Backdrop */}
        <Pressable onPress={onClose} className="absolute inset-0 bg-black/60" />

        {/* Sheet */}
        <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-surface pt-2">
          {/* Handle */}
          <View className="items-center pb-3 pt-2">
            <View className="h-1 w-10 rounded-full" style={{ backgroundColor: "#3A3A3A" }} />
          </View>

          {/* Content */}
          <ScrollView
            bounces={false}
            style={{ maxHeight: 500 }}
            contentContainerStyle={{
              paddingTop: 8,
              paddingHorizontal: 24,
              paddingBottom: Math.max(insets.bottom, 24) + 8,
              gap: 4,
            }}
          >
            {/* Title */}
            <Text className="mb-2 font-poppins-bold text-xl text-white">
              Check-in para quem?
            </Text>

            {/* Cards */}
            {rows.map((row) => (
              <SelectionCard
                key={row.key}
                name={row.name}
                initials={row.initials}
                avatarBg={row.avatarBg}
                iconColor={row.iconColor}
                belt={row.belt}
                stripes={row.stripes}
                subscriptionStatus={row.subscriptionStatus}
                onPress={() => {
                  onClose();
                  row.onPress();
                }}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
