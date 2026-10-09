import { describe, expect, it } from "vitest";
import { resolveInviteRole, resolveInviteView } from "./invite";

const ACADEMY = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Academia do Convite",
  logoUrl: "https://cdn.example/logo.png",
};

function respondsWith(status: number, body?: unknown): typeof fetch {
  return (async () =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

function throws(): typeof fetch {
  return (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
}

describe("resolveInviteRole", () => {
  it("maps each papel token to its role", () => {
    expect(resolveInviteRole("aluno")).toBe("student");
    expect(resolveInviteRole("instrutor")).toBe("instructor");
    expect(resolveInviteRole("responsavel")).toBe("guardian");
  });

  it("degrades an unknown papel to no suggested role", () => {
    // Five ways of being unusable: absent, present but empty, a token nobody
    // defined, the right word in the wrong case, and something long enough to
    // be an attack rather than a typo.
    expect(resolveInviteRole(undefined)).toBeNull();
    expect(resolveInviteRole("")).toBeNull();
    expect(resolveInviteRole("xyz")).toBeNull();
    expect(resolveInviteRole("ALUNO")).toBeNull();
    expect(resolveInviteRole("a".repeat(64))).toBeNull();
  });
});

describe("resolveInviteView", () => {
  it("names the academy that invited", async () => {
    const view = await resolveInviteView(
      ACADEMY.id,
      "instrutor",
      respondsWith(200, ACADEMY),
    );

    expect(view).toEqual({
      kind: "ok",
      academy: ACADEMY,
      role: "instructor",
    });
  });

  it("turns each endpoint outcome into its own view", async () => {
    expect(
      await resolveInviteView(ACADEMY.id, "aluno", respondsWith(200, ACADEMY)),
    ).toMatchObject({ kind: "ok" });

    // 400 and 404 both mean "this academy does not exist".
    expect(
      await resolveInviteView(ACADEMY.id, "aluno", respondsWith(400)),
    ).toEqual({ kind: "not-found" });
    expect(
      await resolveInviteView(ACADEMY.id, "aluno", respondsWith(404)),
    ).toEqual({ kind: "not-found" });

    // A 500 and a thrown fetch both mean "we do not know", and the suggested
    // role survives so the page can still say what the person was invited as.
    expect(
      await resolveInviteView(ACADEMY.id, "aluno", respondsWith(500)),
    ).toEqual({ kind: "unavailable", role: "student" });
    expect(await resolveInviteView(ACADEMY.id, "aluno", throws())).toEqual({
      kind: "unavailable",
      role: "student",
    });
  });
});
