import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { LogOut } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";

const TEXT_SECONDARY = "#ABABAB";

type SignOutButtonProps = {
  /** Set while the screen has work in flight that the teardown would race. */
  disabled?: boolean;
};

/**
 * Footer escape hatch for the screens reached before a role layout mounts — the
 * joining flow and `create-academy`. Those have no tab bar and no route to
 * `profile.tsx`, so without this a user who signs in with the wrong account is
 * stranded and needs manual intervention to get out.
 *
 * `profile.tsx` keeps its own handler: its sign-out is a row in a settings list,
 * a different affordance with nothing to share beyond these three lines.
 */
export function SignOutButton({ disabled = false }: SignOutButtonProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const isBlocked = disabled || signingOut;

  async function handleSignOut() {
    if (isBlocked) return;
    setSigningOut(true);
    try {
      // Cleared first so nothing re-renders against the outgoing account's data.
      queryClient.clear();
      await signOut();
      router.replace("/(auth)");
    } catch {
      // Staying disabled would re-trap the user this button exists to free.
      setSigningOut(false);
    }
  }

  return (
    <Pressable
      onPress={handleSignOut}
      disabled={isBlocked}
      className="flex-row items-center justify-center py-3.5"
      style={{ gap: 8, opacity: isBlocked ? 0.5 : 1 }}
    >
      <LogOut size={16} color={TEXT_SECONDARY} />
      <Text className="font-poppins-medium text-sm" style={{ color: TEXT_SECONDARY }}>
        Sair da conta
      </Text>
    </Pressable>
  );
}
