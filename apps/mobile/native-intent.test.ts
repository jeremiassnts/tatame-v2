import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseInviteLink } from "@/lib/invite-link";
import { clearPendingInvite, readPendingInvite, setPendingInvite } from "@/lib/pending-invite";
import { redirectSystemPath } from "@/app/+native-intent";

/**
 * TAT-191 gave the store an AsyncStorage mirror, and AsyncStorage's entry
 * imports `react-native`, which cannot load in `environment: "node"`. Nothing
 * below asserts the mirror — `lib/pending-invite.test.ts` owns that — so this
 * is the smallest double that keeps the module loadable.
 */
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));

const ID = "11111111-1111-1111-1111-111111111111";
const INVITE = `https://apptatame.com.br/convite/${ID}?papel=instrutor`;
const DOWNLOAD = "https://apptatame.com.br/baixar";
const SSO = "tatame:///sso-callback";
const UNKNOWN = "/alguma-coisa";

const STORED = { academyId: "academy-already-here", role: null } as const;

beforeEach(() => {
  void clearPendingInvite();
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
      void clearPendingInvite();
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
      void clearPendingInvite();
      const cold = redirectSystemPath({ path, initial: true });
      const afterCold = readPendingInvite();

      void clearPendingInvite();
      const warm = redirectSystemPath({ path, initial: false });
      const afterWarm = readPendingInvite();

      expect(warm).toBe(cold);
      expect(afterWarm).toEqual(afterCold);
    }
  });
});

/**
 * Why this file is not `app/+native-intent.test.ts`, beside the module it
 * proves, which is where every other test in this package sits.
 *
 * expo-router builds its route tree from a `require.context` over `app/` whose
 * ignore regex exempts exactly `+html`, `+native-intent` and `*+api` — and
 * anchors each at the extension (`expo-router/_ctx-shared.js`). A `.test.ts`
 * beside `+native-intent.ts` therefore misses the exemption, enters the route
 * tree, and `getRoutesCore.js` throws on the leading `+`: the app does not boot
 * at all, in Expo Go or in a build.
 *
 * So the rule is wider than this one file: `app/` holds routes, and nothing
 * under it may be a test. The case below is what keeps that true.
 */
describe("app/ holds routes only", () => {
  it("has no test file under app/, which expo-router scans as a route", () => {
    const appDir = fileURLToPath(new URL("./app", import.meta.url));
    const offenders = readdirSync(appDir, { recursive: true })
      .map(String)
      .filter((entry) => /\.test\.[jt]sx?$/.test(entry));

    expect(offenders).toEqual([]);
  });
});
