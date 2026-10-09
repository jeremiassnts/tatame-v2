/**
 * TAT-178: the manager's two share actions.
 *
 * Two kinds of assertion live here and they prove different things. The first
 * run against `lib/invite-share.ts` directly, because that module imports no
 * `react-native` and every decision it makes — the `papel` token, the member
 * threshold, the empty-academy branch, dismiss-vs-reject — is a pure function.
 *
 * The second read source text. `vitest.config.ts` runs `environment: "node"`
 * with no renderer, so nothing can assert that a screen *displays* a button;
 * what can be asserted is that the screen asks the shared module for it and
 * keeps no second copy of anything. `lib/invite-copy.test.ts` established that
 * pattern for the role labels and this follows it.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PAPEL_TO_ROLE,
  ROLE_TO_PAPEL,
  resolvePapelToRole,
  type InviteRole,
} from "@tatame/types";
import { describe, expect, it, vi } from "vitest";
import { parseInviteLink } from "@/lib/invite-link";
import {
  APP_DOWNLOAD_URL,
  APP_SHARE_MESSAGE,
  buildInviteUrl,
  INVITE_LABEL,
  INVITE_QUICK_ACTION_LABEL,
  INVITE_ROLE_OPTIONS,
  INVITE_WELCOME_MEMBER_THRESHOLD,
  inviteShareMessage,
  shareMessage,
  SHARE_APP_LABEL,
  shouldShowInviteWelcome,
} from "@/lib/invite-share";

const MOBILE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (relative: string) =>
  readFileSync(`${MOBILE_ROOT}${relative}`, "utf8");

const ROLES: InviteRole[] = ["student", "instructor", "guardian"];
const ACCENTED = /[áàâãéêíóôõúüç]/i;

/** C1 */
describe("the role options", () => {
  it("lists the three roles in order", () => {
    expect(INVITE_ROLE_OPTIONS.map((o) => o.role)).toEqual([
      "student",
      "instructor",
      "guardian",
    ]);
    expect(INVITE_ROLE_OPTIONS.map((o) => o.label)).toEqual([
      "Aluno",
      "Instrutor",
      "Responsável",
    ]);
  });

  /** C3 */
  it("the guardian option explains it invites the adult", () => {
    const guardian = INVITE_ROLE_OPTIONS.find((o) => o.role === "guardian");

    expect(guardian).toBeDefined();
    const description = guardian!.description.toLowerCase();
    // The adult, then the act of registering, then the child's standing in the
    // system. All three, because "convide o responsável" alone still reads as
    // "the person we are enrolling is the responsável".
    expect(description).toContain("responsável");
    expect(description).toContain("cadastra");
    expect(description).toContain("dependente");
  });

  it("gives every option a description, so no row is a bare label", () => {
    for (const option of INVITE_ROLE_OPTIONS) {
      expect(option.description.length, option.role).toBeGreaterThan(20);
    }
  });
});

/** C2 */
describe("the invite url", () => {
  it("builds the invite url for each role", () => {
    expect(buildInviteUrl("acad-1", "student")).toBe(
      "https://apptatame.com.br/convite/acad-1?papel=aluno",
    );
    expect(buildInviteUrl("acad-1", "instructor")).toBe(
      "https://apptatame.com.br/convite/acad-1?papel=instrutor",
    );
    expect(buildInviteUrl("acad-1", "guardian")).toBe(
      "https://apptatame.com.br/convite/acad-1?papel=responsavel",
    );
  });

  it("escapes an academy id that would otherwise change the path", () => {
    expect(buildInviteUrl("a/b?c", "student")).toBe(
      "https://apptatame.com.br/convite/a%2Fb%3Fc?papel=aluno",
    );
  });

  it("every url it builds is one parseInviteLink accepts", () => {
    // The producer and the consumer are two modules that nothing else connects.
    // A token spelt `responsável` here would still read perfectly in the
    // message and resolve to no role on the other side.
    for (const role of ROLES) {
      const url = buildInviteUrl("acad-42", role);
      expect(parseInviteLink(url), role).toEqual({
        academyId: "acad-42",
        role,
      });
    }

    const escaped = buildInviteUrl("a/b?c", "guardian");
    expect(parseInviteLink(escaped)).toEqual({
      academyId: "a/b?c",
      role: "guardian",
    });
  });
});

/** C18 */
describe("the papel table", () => {
  it("every role round-trips through its papel token", () => {
    expect(Object.keys(ROLE_TO_PAPEL).sort()).toEqual([...ROLES].sort());

    for (const role of ROLES) {
      expect(resolvePapelToRole(ROLE_TO_PAPEL[role]), role).toBe(role);
    }
  });

  it("is the exact inverse of the table the parsers read", () => {
    for (const [papel, role] of Object.entries(PAPEL_TO_ROLE)) {
      expect(ROLE_TO_PAPEL[role], papel).toBe(papel);
    }
    expect(Object.keys(PAPEL_TO_ROLE)).toHaveLength(
      Object.keys(ROLE_TO_PAPEL).length,
    );
  });
});

/** C5 */
describe("the app message", () => {
  it("the app message points at the download page", () => {
    expect(APP_DOWNLOAD_URL).toBe("https://apptatame.com.br/baixar");
    expect(APP_SHARE_MESSAGE).toContain(APP_DOWNLOAD_URL);
    // The apex sells academy-management subscriptions to managers, which is the
    // wrong page for the student this message is sent to.
    expect(APP_SHARE_MESSAGE).not.toContain("https://apptatame.com.br\n");
    expect(APP_SHARE_MESSAGE.endsWith("https://apptatame.com.br")).toBe(false);
    expect(APP_SHARE_MESSAGE).not.toContain("/convite/");
    expect(APP_SHARE_MESSAGE).toMatch(ACCENTED);
  });
});

/** C15, C16 */
describe("the invite message", () => {
  it("the invite message names the academy and speaks to a group", () => {
    const url = buildInviteUrl("acad-1", "student");
    const message = inviteShareMessage("Academia Alpha", url);

    expect(message).toContain("Academia Alpha");
    expect(message).toContain(url);
    expect(message).toMatch(ACCENTED);
    // Not "convide um aluno": the link is one-to-many, and a manager who reads
    // it as one-per-person repeats the whole flow thirty times.
    expect(message).toContain("para todos");
    expect(message.toLowerCase()).toContain("compartilh");
    expect(message.toLowerCase()).toContain("entrem");
  });

  it("an unnamed academy loses the name, not the sentence", () => {
    const url = buildInviteUrl("acad-1", "student");

    for (const name of ["", "   ", null, undefined]) {
      const message = inviteShareMessage(name, url);

      expect(message, String(name)).toContain(url);
      expect(message, String(name)).toContain("nossa academia");
      expect(message, String(name)).not.toContain("undefined");
      expect(message, String(name)).not.toContain("null");
      // "organizar a ." and "organizar a  nossa" are the two shapes an empty
      // interpolation leaves behind.
      expect(message, String(name)).not.toContain("  ");
      expect(message, String(name)).not.toContain(" .");
    }
  });

  it("trims a padded academy name instead of widening the gap", () => {
    const message = inviteShareMessage("  Academia Alpha  ", "https://x");
    expect(message).toContain("organizar a Academia Alpha.");
  });
});

/** C6, C7, C9 */
describe("opening the share sheet", () => {
  it("a completed share reports nothing", async () => {
    const share = vi.fn().mockResolvedValue({ action: "sharedAction" });
    const reportError = vi.fn();

    await shareMessage("hello", share, reportError);

    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ message: "hello" });
    expect(reportError).not.toHaveBeenCalled();
  });

  it("a dismissed sheet reports nothing", async () => {
    const share = vi.fn().mockResolvedValue({ action: "dismissedAction" });
    const reportError = vi.fn();

    await expect(
      shareMessage("hello", share, reportError),
    ).resolves.toBeUndefined();

    expect(reportError).not.toHaveBeenCalled();
  });

  it("a failed share raises one Portuguese alert", async () => {
    const share = vi.fn().mockRejectedValue(new Error("no activity found"));
    const reportError = vi.fn();

    await expect(
      shareMessage("hello", share, reportError),
    ).resolves.toBeUndefined();

    expect(reportError).toHaveBeenCalledTimes(1);
    const [title, body] = reportError.mock.calls[0];
    expect(title).toBe("Erro");
    expect(body).toMatch(ACCENTED);
    expect(body.length).toBeGreaterThan(10);
  });

  it("sends only a message, never a separate url field", () => {
    // iOS hands `UIActivityViewController` one activity item per field and the
    // receiving app picks; splitting the link out is how the academy name and
    // the group sentence stop arriving with it.
    const source = read("lib/hooks/use-invite-share.ts");
    expect(source).not.toMatch(/url\s*:/);
  });
});

/** C12, C13 */
describe("the welcome-card threshold", () => {
  it("no member count means no card", () => {
    expect(shouldShowInviteWelcome(undefined)).toBe(false);
  });

  it("the card lives below five active members", () => {
    expect(INVITE_WELCOME_MEMBER_THRESHOLD).toBe(5);

    // 1 is a brand-new academy: `activeMembers` counts the manager's own active
    // membership, so the empty case is 1 and never 0.
    expect(shouldShowInviteWelcome(1)).toBe(true);
    expect(shouldShowInviteWelcome(4)).toBe(true);
    expect(shouldShowInviteWelcome(5)).toBe(false);
    expect(shouldShowInviteWelcome(30)).toBe(false);
  });
});

/** C19 */
describe("the button labels", () => {
  it("every new button label fits a mobile button", () => {
    const labels = [INVITE_LABEL, SHARE_APP_LABEL, INVITE_QUICK_ACTION_LABEL];

    for (const label of labels) {
      for (const line of label.split("\n")) {
        expect(line.length, line).toBeLessThanOrEqual(16);
      }
    }
  });
});

/** C21 */
describe("the share module stays pure", () => {
  it("the share module stays pure", () => {
    // Everything above is only provable because of this: a `react-native`
    // import would make the module unloadable under `environment: "node"`.
    expect(read("lib/invite-share.ts")).not.toContain("react-native");
  });
});

// ---------------------------------------------------------------------------
// Source-text assertions. See the file header for why the wiring gets proven
// in this shape rather than by rendering anything.
// ---------------------------------------------------------------------------

const MEMBERS_LIST = "components/MembersListContent.tsx";
const MANAGER_MEMBERS = "app/(app)/(manager)/(members)/index.tsx";
const INSTRUCTOR_MEMBERS = "app/(app)/(instructor)/(members)/index.tsx";
const STUDENT_MEMBERS = "app/(app)/(student)/(members)/index.tsx";
const MANAGER_HOME = "app/(app)/(manager)/(home)/index.tsx";
const ROLE_SHEET = "components/InviteRoleSheet.tsx";
const WELCOME_CARD = "components/InviteWelcomeCard.tsx";
const SELECTION_CARD = "components/SelectionCard.tsx";
const DEPENDENT_SHEET = "components/DependentSelectionModal.tsx";

/** Every TypeScript source file the app ships, relative to `apps/mobile`. */
function sourceFiles(): string[] {
  const found: string[] = [];

  const walk = (relative: string) => {
    for (const entry of readdirSync(`${MOBILE_ROOT}${relative}`, {
      withFileTypes: true,
    })) {
      const path = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts"))
        found.push(path);
    }
  };

  for (const root of ["app", "components", "lib"]) walk(root);
  return found.sort();
}

/** C4 */
describe("who gets the invite actions", () => {
  it("only the manager members list asks for the invite actions", () => {
    // Opt-in, not opt-out: the default is what a fourth consumer inherits.
    expect(read(MEMBERS_LIST)).toContain("showInviteActions = false");
    expect(read(MEMBERS_LIST)).toContain("showInviteActions ?");

    expect(read(MANAGER_MEMBERS)).toContain("showInviteActions");
    expect(read(INSTRUCTOR_MEMBERS)).not.toContain("showInviteActions");
    expect(read(STUDENT_MEMBERS)).not.toContain("showInviteActions");
  });
});

/** C8 */
describe("the picker's shape", () => {
  it("the picker follows the DependentSelectionModal shape", () => {
    const sheet = read(ROLE_SHEET);

    expect(sheet).toContain("<Modal");
    expect(sheet).toContain("visible");
    expect(sheet).toContain("onClose");
    expect(sheet).toContain("onSelect");
    expect(sheet).toContain("<SelectionCard");
    // The 52px form-field select with a chevron, which belongs under a label
    // inside a form and not behind a button.
    expect(sheet).not.toContain("ModalSelect");
  });

  it("reads its rows from the shared options rather than listing roles again", () => {
    const sheet = read(ROLE_SHEET);

    expect(sheet).toContain("INVITE_ROLE_OPTIONS");
    for (const option of INVITE_ROLE_OPTIONS) {
      expect(sheet, option.label).not.toContain(option.description);
    }
  });
});

/** C10, C11 */
describe("the manager home quick actions", () => {
  const QUICK_ACTION_CARD =
    'className="min-w-0 flex-1 rounded-[14px] border border-surface-border bg-surface"';

  it("the manager home has five quick actions", () => {
    const cards = read(MANAGER_HOME).split(QUICK_ACTION_CARD).length - 1;

    expect(cards).toBe(5);
  });

  it("the fifth quick action opens the shared picker", () => {
    const home = read(MANAGER_HOME);

    expect(home).toContain("INVITE_QUICK_ACTION_LABEL");
    expect(home).toContain("invite.openPicker");
    expect(home).toContain("InviteRoleSheet");
    // Only the hook may reach for the native module.
    expect(home).not.toContain("Share.share");
  });
});

/** C14 */
describe("the welcome card on the manager home", () => {
  it("the welcome card sits above the quick actions and offers both actions", () => {
    const home = read(MANAGER_HOME);

    const cardAt = home.indexOf("<InviteWelcomeCard");
    const headingAt = home.indexOf("Ações rápidas");
    expect(cardAt).toBeGreaterThan(-1);
    expect(headingAt).toBeGreaterThan(-1);
    expect(cardAt).toBeLessThan(headingAt);

    // The screen asks the pure predicate instead of comparing a number here,
    // which is what keeps C12 and C13 the proof of the threshold.
    expect(home).toContain("shouldShowInviteWelcome(stats?.activeMembers)");

    const card = read(WELCOME_CARD);
    expect(card).toContain("onInvitePress");
    expect(card).toContain("onShareAppPress");
    expect(card).toContain("INVITE_LABEL");
    expect(card).toContain("SHARE_APP_LABEL");
  });
});

/** C17 */
describe("one place keeps the messages", () => {
  it("no screen keeps its own copy of a message", () => {
    const inviteFragment = inviteShareMessage(
      "Academia Alpha",
      "https://x",
    ).split("\n\n")[1];
    const appFragment = APP_SHARE_MESSAGE.split("\n\n")[0];

    for (const file of [MEMBERS_LIST, MANAGER_HOME, ROLE_SHEET, WELCOME_CARD]) {
      const source = read(file);
      expect(source, file).not.toContain(inviteFragment);
      expect(source, file).not.toContain(appFragment);
      // A second copy of either URL is the other way the two drift apart.
      expect(source, file).not.toContain("apptatame.com.br");
    }

    // And each screen that shares goes through the single hook.
    for (const file of [MEMBERS_LIST, MANAGER_HOME]) {
      expect(read(file), file).toContain("useInviteShare");
    }
  });
});

/** C20 */
describe("the native share module", () => {
  it("one hook is the only importer of Share", () => {
    const importers = sourceFiles().filter((file) => {
      const match = read(file).match(/import\s*\{([^}]*)\}\s*from\s*"react-native"/);
      if (!match) return false;
      return match[1]
        .split(",")
        .map((name) => name.trim())
        .includes("Share");
    });

    expect(importers).toEqual(["lib/hooks/use-invite-share.ts"]);
  });
});

/** C22 */
describe("the check-in sheet is untouched", () => {
  it("the check-in sheet passes no description", () => {
    const card = read(SELECTION_CARD);

    expect(card).toContain("description?: string;");
    expect(card).toContain("Icon = User");

    expect(read(DEPENDENT_SHEET)).not.toContain("description");
  });
});
