import { INVITE_LABEL, SHARE_APP_LABEL } from "@/lib/invite-share";
import { Share2, UserPlus } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

/**
 * The manager home's empty state, shown while the academy is still small.
 *
 * It disappears on its own — `shouldShowInviteWelcome` in `lib/invite-share.ts`
 * owns the threshold and the reason for it, including that `activeMembers`
 * counts the manager themselves.
 */
export function InviteWelcomeCard({
  onInvitePress,
  onShareAppPress,
}: {
  onInvitePress: () => void;
  onShareAppPress: () => void;
}) {
  return (
    <View
      className="rounded-2xl border bg-accent-translucent"
      style={{ padding: 20, gap: 14, borderColor: "rgba(160,120,232,0.3)" }}
    >
      <View style={{ gap: 6 }}>
        <Text className="font-poppins-bold text-base text-primary">
          Sua academia ainda está vazia
        </Text>
        <Text className="font-poppins text-xs text-muted" style={{ lineHeight: 18 }}>
          Convide seus alunos e instrutores. É um link só, e ele serve para o
          grupo todo.
        </Text>
      </View>

      <View className="flex-row" style={{ gap: 10 }}>
        <Pressable
          onPress={onInvitePress}
          className="h-10 min-w-0 flex-1 flex-row items-center justify-center rounded-xl bg-accent"
          style={{ gap: 6 }}
        >
          <UserPlus size={16} color="#FFFFFF" />
          <Text className="font-poppins-semibold text-sm text-white">
            {INVITE_LABEL}
          </Text>
        </Pressable>
        <Pressable
          onPress={onShareAppPress}
          className="h-10 min-w-0 flex-1 flex-row items-center justify-center rounded-xl border border-surface-border bg-surface"
          style={{ gap: 6 }}
        >
          <Share2 size={16} color="#FFFFFF" />
          <Text className="font-poppins-semibold text-sm text-primary">
            {SHARE_APP_LABEL}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
