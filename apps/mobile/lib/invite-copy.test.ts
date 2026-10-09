import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  INVITE_ROLE_HINT,
  INVITE_ROLE_PROMPT,
  inviteHeadline,
  inviteRoleHint,
  ROLE_LABELS,
} from "@/lib/invite-copy";

const ACADEMY = "Alliance Centro";

const USER_TYPE_SCREEN = new URL(
  "../app/(onboarding)/user-type.tsx",
  import.meta.url,
).pathname;

describe("the invite headline", () => {
  it("names the role and the academy", () => {
    expect(inviteHeadline("instructor", ACADEMY)).toBe(
      "Você foi convidado para ser Instrutor na Alliance Centro",
    );
  });

  it("names the role when the academy has no name yet", () => {
    // The public lookup is in flight, or it failed. Neither is an error and
    // neither blocks the role step — the sentence just stops naming what it
    // does not know.
    for (const academyName of [null, ""]) {
      const headline = inviteHeadline("instructor", academyName);
      expect(headline).toBe("Você foi convidado para ser Instrutor nesta academia");
      expect(headline).not.toContain("null");
      expect(headline).not.toContain("undefined");
    }
  });

  it("names the academy when the link suggested no role", () => {
    expect(inviteHeadline(null, ACADEMY)).toBe(
      "Você foi convidado para entrar na Alliance Centro",
    );
  });

  it("names neither when the link gave neither", () => {
    const headline = inviteHeadline(null, null);
    expect(headline).toBe("Você foi convidado para entrar nesta academia");
    expect(headline).not.toContain("null");
    expect(headline).not.toContain("undefined");
  });

  it("says the suggestion can be changed", () => {
    // TAT-175 decision 1: the invited role is a suggestion, never a lock, and
    // the screen has to say so rather than leaving it to be discovered.
    expect(inviteRoleHint("guardian")).toBe(INVITE_ROLE_HINT);
    expect(inviteRoleHint("student")).toBe(INVITE_ROLE_HINT);
    expect(inviteRoleHint("instructor")).toBe(INVITE_ROLE_HINT);
    expect(inviteRoleHint(null)).toBe(INVITE_ROLE_PROMPT);

    expect(INVITE_ROLE_HINT).toBe("Você pode escolher outro perfil se preferir.");
    expect(INVITE_ROLE_PROMPT).toBe("Selecione o seu perfil para continuar.");
  });
});

describe("the role labels", () => {
  it("labels the three roles once", () => {
    expect(ROLE_LABELS).toEqual({
      student: "Aluno",
      instructor: "Instrutor",
      guardian: "Responsável",
    });
  });

  it("is the only place the role step gets its labels", () => {
    // A headline naming "Instrutor" above a card naming something else is the
    // failure this guards, and it only happens if the screen keeps its own copy.
    const screen = readFileSync(USER_TYPE_SCREEN, "utf8");

    expect(screen).toContain("ROLE_LABELS");
    for (const label of Object.values(ROLE_LABELS)) {
      expect(screen, label).not.toContain(`"${label}"`);
    }
  });
});
