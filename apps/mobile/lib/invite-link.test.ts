import { resolvePapelToRole } from "@tatame/types";
import { describe, expect, it } from "vitest";
import { parseInviteLink } from "@/lib/invite-link";

const ID = "11111111-1111-1111-1111-111111111111";
const HOST = "https://apptatame.com.br";

describe("resolvePapelToRole", () => {
  it("resolves the shared papel vocabulary and nothing outside it", () => {
    // The three tokens TAT-175 froze, each written as its own member.
    expect(resolvePapelToRole("aluno")).toBe("student");
    expect(resolvePapelToRole("instrutor")).toBe("instructor");
    expect(resolvePapelToRole("responsavel")).toBe("guardian");

    // Five ways of being outside it. The case and the leading space are the
    // two that look like the real token and are not — matching is exact,
    // because the link is always produced by the app and never typed.
    expect(resolvePapelToRole("ALUNO")).toBeNull();
    expect(resolvePapelToRole(" aluno")).toBeNull();
    expect(resolvePapelToRole("")).toBeNull();
    expect(resolvePapelToRole(undefined)).toBeNull();
    expect(resolvePapelToRole(["aluno"])).toBeNull();
  });
});

describe("parseInviteLink", () => {
  it("reads the academy and the suggested role out of an invite link", () => {
    expect(parseInviteLink(`${HOST}/convite/${ID}?papel=aluno`)).toEqual({
      academyId: ID,
      role: "student",
    });
  });

  it("maps each papel token to its role", () => {
    const cases: [string, string][] = [
      ["aluno", "student"],
      ["instrutor", "instructor"],
      ["responsavel", "guardian"],
    ];

    for (const [papel, role] of cases) {
      expect(parseInviteLink(`${HOST}/convite/${ID}?papel=${papel}`)).toEqual({
        academyId: ID,
        role,
      });
    }
  });

  it("degrades an unusable papel to no suggested role", () => {
    // Six ways of being unusable. Every one keeps the academy — the role is a
    // suggestion, so losing it must never cost the invite.
    const queries = [
      "",
      "?papel=",
      "?papel=xyz",
      "?papel=ALUNO",
      "?papel=%20aluno",
      "?papel=aluno&papel=instrutor",
    ];

    for (const query of queries) {
      expect(parseInviteLink(`${HOST}/convite/${ID}${query}`)).toEqual({
        academyId: ID,
        role: null,
      });
    }
  });

  it("decodes the academy segment", () => {
    expect(parseInviteLink(`${HOST}/convite/a%20b`)).toEqual({
      academyId: "a b",
      role: null,
    });
  });

  it("refuses a path that is not exactly one segment after convite", () => {
    // Apple's `/convite/*` and Android's `pathPrefix: "/convite/"` both match
    // more than the link generator ever produces, so the app receives shapes
    // nobody designed. Guessing an academy id out of one is worse than
    // opening at the root.
    const paths = ["/convite/", "/convite", "/convite//", `/convite/${ID}/extra`];

    for (const path of paths) {
      expect(parseInviteLink(`${HOST}${path}`)).toBeNull();
    }
  });

  it("reads one invite the same way in every URL form", () => {
    // Compared against each other, not against a literal: a change that moves
    // every form together still fails here.
    const forms = [
      `${HOST}/convite/${ID}?papel=aluno`,
      `tatame:///convite/${ID}?papel=aluno`,
      `exp://192.168.0.2:8081/--/convite/${ID}?papel=aluno`,
      `/convite/${ID}?papel=aluno`,
    ];

    const results = forms.map(parseInviteLink);
    expect(results[0]).toEqual({ academyId: ID, role: "student" });
    for (const result of results.slice(1)) {
      expect(result).toEqual(results[0]);
    }
  });

  it("accepts the apex host and that path only", () => {
    // The association files are served on the apex alone, so no other host can
    // reach this app — and `apptatame.com.br.evil.com` is the one that would
    // pass a `.endsWith` check written in a hurry.
    const urls = [
      `https://example.com/convite/${ID}`,
      `https://www.apptatame.com.br/convite/${ID}`,
      `https://apptatame.com.br.evil.com/convite/${ID}`,
      `${HOST}/outro/${ID}`,
    ];

    for (const url of urls) {
      expect(parseInviteLink(url)).toBeNull();
    }
  });

  it("returns null instead of throwing on an unparseable url", () => {
    for (const url of ["", "not a url", "://", "tatame://", "%"]) {
      expect(() => parseInviteLink(url)).not.toThrow();
      expect(parseInviteLink(url)).toBeNull();
    }
  });
});
