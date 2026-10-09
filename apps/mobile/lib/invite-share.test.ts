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
import { ROLE_LABELS } from "@/lib/invite-copy";
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

    // And from `ROLE_LABELS`, not a second copy of the same three words: the
    // invited person reads them again on `(onboarding)/user-type` after
    // following the link, and the two disagreeing is what nobody notices.
    const module = read("lib/invite-share.ts");
    expect(module).toContain("ROLE_LABELS.student");
    expect(module).toContain("ROLE_LABELS.instructor");
    expect(module).toContain("ROLE_LABELS.guardian");
    for (const label of Object.values(ROLE_LABELS)) {
      expect(module, label).not.toContain(label);
    }
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
const HEADER_ACTIONS = "components/InviteHeaderActions.tsx";
const SELECTION_CARD = "components/SelectionCard.tsx";
const DEPENDENT_SHEET = "components/DependentSelectionModal.tsx";

const occurrences = (haystack: string, needle: string) =>
  haystack.split(needle).length - 1;

/**
 * The manager home's `Ações rápidas` block alone.
 *
 * Several assertions below need to say *which* element carries a handler, and
 * the same handler appears on the welcome card above this block and in the
 * picker mounted below it. A file-wide `toContain` cannot tell them apart.
 */
function quickActionsRegion(home: string): string {
  const from = home.indexOf("Ações rápidas");
  const to = home.indexOf("Aulas de hoje");
  expect(from, "Ações rápidas heading").toBeGreaterThan(-1);
  expect(to, "Aulas de hoje heading").toBeGreaterThan(from);
  return home.slice(from, to);
}

/**
 * Assert that `onPress={handler}` sits on the control `marker` identifies.
 *
 * The two handlers these components take do opposite things - one opens the
 * role picker, the other shares the download page - and swapping the bindings
 * is invisible to any assertion that only reads the two names. So the pairing
 * is what gets asserted: the handler, then the glyph, with no closing tag
 * between them, which is what makes them the same `Pressable`.
 */
function handlerOwnsControl(source: string, handler: string, marker: string) {
  const handlerAt = source.indexOf(`onPress={${handler}}`);
  expect(handlerAt, `onPress={${handler}}`).toBeGreaterThan(-1);
  expect(occurrences(source, `onPress={${handler}}`), handler).toBe(1);

  const markerAt = source.indexOf(marker, handlerAt);
  expect(markerAt, `${marker} after ${handler}`).toBeGreaterThan(-1);
  expect(
    source.slice(handlerAt, markerAt),
    `${handler} and ${marker} in one Pressable`,
  ).not.toContain("</Pressable>");
}

/**
 * The body of a `useCallback` declared as `const <name> = useCallback(`.
 *
 * Needed because every wiring proof on this feature reads a *definition*, and
 * a definition says nothing about what the call site passes. Verification
 * round 2 found exactly that: `selectRole` calling `shareApp()` instead of
 * `shareInvite(role)` left every other assertion green.
 */
function callbackBody(source: string, name: string): string {
  const from = source.indexOf(`const ${name} = useCallback(`);
  expect(from, `const ${name} = useCallback(`).toBeGreaterThan(-1);
  const to = source.indexOf("  );", from);
  expect(to, `end of ${name}`).toBeGreaterThan(from);
  return source.slice(from, to);
}

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

  /** C26 */
  it("the actions sit in the true branch of the gate", () => {
    const members = read(MEMBERS_LIST);

    // `{showInviteActions ? (<InviteHeaderActions` — the leading brace is what
    // rejects `!showInviteActions`, which contains the positive form as a
    // substring and would otherwise read identically. Naming the element in
    // the then-position is what rejects the two branches being swapped. Both
    // mutations invert AC 4 exactly: actions on the instructor and student
    // lists, none on the manager's.
    expect(members).toMatch(
      /\{showInviteActions \? \(\s*<InviteHeaderActions/,
    );
    expect(members).toMatch(/\{showInviteActions \? \(\s*<InviteRoleSheet/);
    expect(members).not.toContain("!showInviteActions");

    // Exactly the two gate sites, so a third one cannot appear unproven.
    expect(occurrences(members, "showInviteActions ?")).toBe(2);
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
    const quickActions = quickActionsRegion(home);

    // Scoped to the region, because `invite.openPicker` is also the welcome
    // card's handler further up the screen — a file-wide `toContain` cannot say
    // which element carries it.
    expect(occurrences(quickActions, "invite.openPicker")).toBe(1);
    expect(occurrences(quickActions, "INVITE_QUICK_ACTION_LABEL")).toBe(1);

    // And on the same `Pressable`: no closing tag may sit between the handler
    // and the label it belongs to.
    const handlerAt = quickActions.indexOf("invite.openPicker");
    const labelAt = quickActions.indexOf("INVITE_QUICK_ACTION_LABEL");
    expect(handlerAt).toBeLessThan(labelAt);
    expect(quickActions.slice(handlerAt, labelAt)).not.toContain("</Pressable>");

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

    for (const file of [
      MEMBERS_LIST,
      MANAGER_HOME,
      ROLE_SHEET,
      WELCOME_CARD,
      HEADER_ACTIONS,
    ]) {
      const source = read(file);
      expect(source, file).not.toContain(inviteFragment);
      expect(source, file).not.toContain(appFragment);
      // A second copy of either URL is the other way the two drift apart.
      expect(source, file).not.toContain("apptatame.com.br");
      // And every one of them reads from the shared module, directly or through
      // the hook that wraps it — the claim's "from there", asserted.
      expect(source, file).toMatch(
        /from "@\/lib\/(hooks\/use-)?invite-share"/,
      );
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

/** C22, C24 */
describe("the check-in sheet is untouched", () => {
  it("the check-in sheet passes no description", () => {
    const card = read(SELECTION_CARD);

    expect(card).toContain("description?: string;");
    expect(card).toContain("Icon = User");

    expect(read(DEPENDENT_SHEET)).not.toContain("description");
  });

  it("the card renders the icon it is handed, and a description outranks the belt line", () => {
    const card = read(SELECTION_CARD);

    // The glyph comes from the prop, not from the hardcoded `User` the card
    // showed before — swapping it back makes all three picker rows identical.
    expect(card).toMatch(/<Icon size=\{20\}/);
    expect(card).not.toMatch(/<User size=/);

    // And the description wins when a row carries both, which is the ternary's
    // whole content. Swapping the arms puts the belt dot on a role row and
    // hides every description.
    expect(card).toMatch(
      /\{description \? \([\s\S]{0,300}\) : beltSub \? \(/,
    );
  });
});

/** C23 */
describe("the hook's wiring", () => {
  it("each action is wired to its own message", () => {
    const hook = read("lib/hooks/use-invite-share.ts");

    // Swapping the two — the app message going out as the invite — is
    // invisible to every other assertion in this file.
    expect(hook).toMatch(
      /shareApp[\s\S]{0,200}?shareMessage\(\s*APP_SHARE_MESSAGE/,
    );
    expect(hook).toMatch(
      /shareInvite[\s\S]{0,300}?shareMessage\(\s*inviteShareMessage\(/,
    );
    expect(hook).toContain("buildInviteUrl(academyId, role)");
    expect(occurrences(hook, "APP_SHARE_MESSAGE")).toBe(2); // the import and the one use
    expect(occurrences(hook, "inviteShareMessage")).toBe(2);
  });
});

/** C27 */
describe("the handler bindings", () => {
  /** Every place this feature mounts one of its own components. */
  const MOUNTS: [string, string, string][] = [
    [MEMBERS_LIST, "InviteHeaderActions", "members header"],
    [MEMBERS_LIST, "InviteRoleSheet", "members picker"],
    [MANAGER_HOME, "InviteWelcomeCard", "home welcome card"],
    [MANAGER_HOME, "InviteRoleSheet", "home picker"],
  ];

  it("every mount hands each action the handler its name promises", () => {
    for (const [file, element, where] of MOUNTS) {
      const source = read(file);
      const open = `<${element}`;
      expect(occurrences(source, open), `${where}: one mount`).toBe(1);

      const mount = source.slice(
        source.indexOf(open),
        source.indexOf("/>", source.indexOf(open)),
      );

      if (element === "InviteRoleSheet") {
        // `onSelect` must be the handler that shares the *invite*; pointing it
        // at `shareApp` would share the download page from the role picker.
        expect(mount, where).toContain("visible={invite.pickerVisible}");
        expect(mount, where).toContain("onClose={invite.closePicker}");
        expect(mount, where).toContain("onSelect={invite.selectRole}");
      } else {
        // Swapping these two is the whole gap: `Convidar` would share `/baixar`
        // and the share icon would open the role picker.
        expect(mount, where).toContain("onInvitePress={invite.openPicker}");
        expect(mount, where).toContain("onShareAppPress={invite.shareApp}");
      }
    }
  });

  it("inside each component the handler sits on the control its glyph names", () => {
    for (const file of [
      "components/InviteHeaderActions.tsx",
      "components/InviteWelcomeCard.tsx",
    ]) {
      const source = read(file);
      handlerOwnsControl(source, "onInvitePress", "<UserPlus");
      handlerOwnsControl(source, "onShareAppPress", "<Share2");
    }
  });
});

/** C28 */
describe("picking a role", () => {
  it("picking a role shares the invite, never the app message", () => {
    const body = callbackBody(read("lib/hooks/use-invite-share.ts"), "selectRole");

    expect(body).toContain("setPickerVisible(false)");
    expect(body).toContain("shareInvite(role)");
    // The surviving mutant round 2 found: `void shareApp()` here shares
    // `/baixar` and the `?papel=` link is never shared at all.
    expect(body).not.toContain("shareApp");
  });

  it("the share-app action never reaches for the invite builder", () => {
    const body = callbackBody(read("lib/hooks/use-invite-share.ts"), "shareApp");

    expect(body).toContain("APP_SHARE_MESSAGE");
    expect(body).not.toContain("inviteShareMessage");
    expect(body).not.toContain("buildInviteUrl");
  });

  it("the invite action never reaches for the app message", () => {
    const body = callbackBody(
      read("lib/hooks/use-invite-share.ts"),
      "shareInvite",
    );

    expect(body).toContain("inviteShareMessage(");
    expect(body).toContain("buildInviteUrl(academyId, role)");
    expect(body).not.toContain("APP_SHARE_MESSAGE");
  });
});

/** C25 */
describe("the picker's glyphs", () => {
  it("each role gets its own glyph", () => {
    const sheet = read(ROLE_SHEET);

    const table = sheet.slice(
      sheet.indexOf("ROLE_ICONS"),
      sheet.indexOf("};", sheet.indexOf("ROLE_ICONS")),
    );
    const glyphs = ROLES.map((role) => {
      const match = table.match(new RegExp(`${role}:\\s*(\\w+)`));
      expect(match, role).not.toBeNull();
      return match![1];
    });

    // Three distinct glyphs: one shared avatar across all three rows is the
    // state the `Icon` prop exists to leave behind.
    expect(new Set(glyphs).size).toBe(3);
    for (const glyph of glyphs) {
      expect(sheet, glyph).toMatch(
        new RegExp(`import \\{[^}]*\\b${glyph}\\b[^}]*\\} from "lucide-react-native"`),
      );
    }

    // And handed to the card rather than decided inside it.
    expect(sheet).toContain("Icon={ROLE_ICONS[option.role]}");
  });
});
