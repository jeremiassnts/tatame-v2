import { beforeEach, describe, expect, it } from "vitest";
import { parseInviteLink } from "@/lib/invite-link";
import { clearPendingInvite, readPendingInvite, setPendingInvite } from "@/lib/pending-invite";
import { redirectSystemPath } from "./+native-intent";

const ID = "11111111-1111-1111-1111-111111111111";
const INVITE = `https://apptatame.com.br/convite/${ID}?papel=instrutor`;
const DOWNLOAD = "https://apptatame.com.br/baixar";
const SSO = "tatame:///sso-callback";
const UNKNOWN = "/alguma-coisa";

const STORED = { academyId: "academy-already-here", role: null } as const;

beforeEach(() => {
  clearPendingInvite();
});

describe("redirectSystemPath", () => {
  it("hands the parsed invite to the pending-invite store", () => {
    redirectSystemPath({ path: INVITE, initial: true });
    // Asserted against the parser's own output rather than a literal, so the
    // two cannot drift apart without this failing.
    expect(readPendingInvite()).toEqual(parseInviteLink(INVITE));
    expect(readPendingInvite()).toEqual({ academyId: ID, role: "instructor" });
  });

  it("sends an invite to the app root", () => {
    // `/` and not `/convite/...`: where a signed-out invitee goes next is
    // TAT-191's decision, and `app/index.tsx` already routes by auth state.
    expect(redirectSystemPath({ path: INVITE, initial: true })).toBe("/");
  });

  it("sends the download page to the app root", () => {
    expect(redirectSystemPath({ path: DOWNLOAD, initial: false })).toBe("/");
  });

  it("leaves a stored invite alone for every other url", () => {
    for (const path of [DOWNLOAD, SSO, UNKNOWN]) {
      clearPendingInvite();
      setPendingInvite(STORED);
      redirectSystemPath({ path, initial: false });
      expect(readPendingInvite()).toEqual(STORED);
    }
  });

  it("returns every other url untouched", () => {
    // String identity, not shape. This function runs on every inbound URL the
    // app receives, and `lib/hooks/use-start-sso.ts` builds `tatame:///sso-callback`
    // with `Linking.createURL` — rewriting it by even one character breaks
    // Google and Apple sign-in.
    const paths = [
      SSO,
      "https://apptatame.com.br/",
      "https://apptatame.com.br/conta",
      "/sso-callback",
      "exp://192.168.0.2:8081/--/",
    ];

    for (const path of paths) {
      expect(redirectSystemPath({ path, initial: false })).toBe(path);
    }
  });

  it("behaves the same on a cold start as on a resume", () => {
    // expo-router reaches this through `getInitialURL` on a cold start and
    // through the `url` listener on a resume, and nothing here may branch on
    // which. Both runs are compared against each other, over all four classes.
    for (const path of [INVITE, DOWNLOAD, SSO, UNKNOWN]) {
      clearPendingInvite();
      const cold = redirectSystemPath({ path, initial: true });
      const afterCold = readPendingInvite();

      clearPendingInvite();
      const warm = redirectSystemPath({ path, initial: false });
      const afterWarm = readPendingInvite();

      expect(warm).toBe(cold);
      expect(afterWarm).toEqual(afterCold);
    }
  });
});
