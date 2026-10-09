import { INVITE_ROLE_OPTIONS } from "@/lib/invite-share";
import type { InviteRole } from "@tatame/types";
import { GraduationCap, User, Users } from "lucide-react-native";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SelectionCard } from "./SelectionCard";

/**
 * Who the manager is inviting, as an action sheet.
 *
 * `components/DependentSelectionModal.tsx` is the precedent and this is the
 * same shape: a transparent `Modal` with a dismissing backdrop, a handle, and
 * `SelectionCard` rows. Deliberately not the 52px form-field select with a
 * chevron that `components/` also offers — that one belongs under a label
 * inside a form, and this is triggered by a button.
 */

const ROLE_ICONS: Record<InviteRole, typeof User> = {
  student: User,
  instructor: GraduationCap,
  guardian: Users,
};

export type InviteRoleSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (role: InviteRole) => void;
};

export function InviteRoleSheet({
  visible,
  onClose,
  onSelect,
}: InviteRoleSheetProps) {
  const insets = useSafeAreaInsets();

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
            <Text className="font-poppins-bold text-xl text-white">
              Convidar quem?
            </Text>
            {/* The link is the same for everyone, and the picker is the first
                place a manager could assume otherwise. */}
            <Text className="mb-2 font-poppins text-[13px] text-muted">
              É um link só — pode mandar no grupo da turma quantas vezes quiser.
            </Text>

            {INVITE_ROLE_OPTIONS.map((option) => (
              <SelectionCard
                key={option.role}
                name={option.label}
                description={option.description}
                Icon={ROLE_ICONS[option.role]}
                avatarBg="rgba(160,120,232,0.125)"
                iconColor="#A078E8"
                onPress={() => onSelect(option.role)}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
