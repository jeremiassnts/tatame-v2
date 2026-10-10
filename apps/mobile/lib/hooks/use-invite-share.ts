import type { InviteRole } from "@tatame/types";
import { useCallback, useState } from "react";
import { Alert, Share } from "react-native";
import { useAcademyContext } from "@/lib/academy-context";
import {
  APP_SHARE_MESSAGE,
  buildInviteUrl,
  inviteShareMessage,
  shareMessage,
} from "@/lib/invite-share";

/**
 * The only place in `apps/mobile` that touches `Share`.
 *
 * Three entry points share the same two messages, and the branch that has to be
 * right is the one nobody pictures: the sheet resolving `dismissedAction` is an
 * ordinary outcome, not a failure. Written inline at each entry point that
 * branch gets copied three times and goes wrong in two of them, so the hook is
 * the mechanism rather than a tidiness preference — `lib/invite-share.test.ts`
 * asserts no other module imports `Share`.
 *
 * It holds the picker's `visible` flag too, because every entry point that
 * invites needs it and none of them needs anything else about it.
 */
export function useInviteShare() {
  const { academyId, academyName } = useAcademyContext();
  const [pickerVisible, setPickerVisible] = useState(false);

  const openPicker = useCallback(() => setPickerVisible(true), []);
  const closePicker = useCallback(() => setPickerVisible(false), []);

  // Both wrapped rather than passed by reference: `Share.share` is a static
  // that reads its own class, and `Alert.alert` takes buttons and options this
  // module has no business forwarding.
  const share = useCallback(
    (content: { message: string }) => Share.share(content),
    [],
  );
  const reportError = useCallback(
    (title: string, body: string) => Alert.alert(title, body),
    [],
  );

  const shareApp = useCallback(
    () => shareMessage(APP_SHARE_MESSAGE, share, reportError),
    [share, reportError],
  );

  const shareInvite = useCallback(
    (role: InviteRole | null) =>
      shareMessage(
        inviteShareMessage(academyName, buildInviteUrl(academyId, role)),
        share,
        reportError,
      ),
    [academyId, academyName, share, reportError],
  );

  /** Pick a role, close the sheet, then open the share sheet over the screen. */
  const selectRole = useCallback(
    (role: InviteRole | null) => {
      setPickerVisible(false);
      void shareInvite(role);
    },
    [shareInvite],
  );

  return {
    pickerVisible,
    openPicker,
    closePicker,
    selectRole,
    shareApp,
    shareInvite,
  };
}
