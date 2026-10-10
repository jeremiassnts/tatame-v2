import { isDownloadLink, parseInviteLink } from "@/lib/invite-link";
import { setPendingInvite } from "@/lib/pending-invite";

/**
 * expo-router's inbound-URL hook, and the single place this app sees a link
 * arrive from the operating system.
 *
 * The router calls it on both entry paths with no work from us:
 * `getLinkingConfig`'s `getInitialURL` when a link starts the app cold, and
 * `link/linking.ts`'s `subscribe` when one arrives while it is already
 * running. That is why TAT-177 needs no `Linking.addEventListener` of its own —
 * a second listener beside the router's would see the same URLs twice.
 *
 * It also means this function is on the path of **every** URL the app ever
 * receives, including the `tatame:///sso-callback` that
 * `lib/hooks/use-start-sso.ts` builds with `Linking.createURL`. Anything this
 * does not recognise is handed back byte for byte; rewriting it would break
 * Google and Apple sign-in, which is the one failure here that is loud.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  /**
   * `true` on a cold start, `false` on a resume. Deliberately unused: a link
   * means the same thing either way, and branching on it would make the app
   * behave differently depending on whether it happened to be in memory.
   */
  initial: boolean;
}): string {
  const invite = parseInviteLink(path);

  if (invite) {
    setPendingInvite(invite);
    // The root, not the invite path. Where a signed-out invitee goes next —
    // sign-in, role selection, the join request — is TAT-191's decision, and
    // `app/index.tsx` already routes by auth state.
    return "/";
  }

  // Someone who already has the app has no use for the download page.
  if (isDownloadLink(path)) return "/";

  return path;
}
