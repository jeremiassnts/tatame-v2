import { INVITE_LABEL } from "@/lib/invite-share";
import { Share2, UserPlus } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

/**
 * The manager's two header actions, as one named element.
 *
 * Extracted from `MembersListContent` for a reason that is not tidiness: the
 * gate that keeps these off the instructor and student lists is a prop, and the
 * only way a node test can pin which branch of that ternary they sit in is for
 * the branch to be a single named element. Inlined, a gate flipped to
 * `!showInviteActions` reads identically to a source-text search.
 */
export function InviteHeaderActions({
  onInvitePress,
  onShareAppPress,
}: {
  onInvitePress: () => void;
  onShareAppPress: () => void;
}) {
  return (
    <View className="flex-row items-center" style={{ gap: 8 }}>
      <Pressable
        onPress={onShareAppPress}
        className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
      >
        <Share2 size={18} color="#FFFFFF" />
      </Pressable>
      <Pressable
        onPress={onInvitePress}
        className="h-10 flex-row items-center rounded-xl bg-accent px-3"
        style={{ gap: 6 }}
      >
        <UserPlus size={16} color="#FFFFFF" />
        <Text className="font-poppins-semibold text-sm text-white">
          {INVITE_LABEL}
        </Text>
      </Pressable>
    </View>
  );
}
