import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STORE_LINKS } from "@/lib/store-links";

const userAgent = vi.hoisted(() => ({ value: "" }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": userAgent.value }),
}));

const { default: ConvitePage } = await import("./page");

const ACADEMY_ID = "11111111-1111-1111-1111-111111111111";
const RE_TAP =
  "Já instalou? Toque neste link de novo para entrar direto na academia.";

/** Deliberately free of the words "Aluno", "Instrutor" and "Responsável". */
const ACADEMY = {
  id: ACADEMY_ID,
  name: "Academia Gracie Centro",
  logoUrl: "https://cdn.example/logo.png",
};

function stubFetch(
  outcome:
    | { status: number; body?: unknown }
    | { throws: true },
) {
  vi.stubGlobal("fetch", async () => {
    if ("throws" in outcome) throw new TypeError("fetch failed");
    return new Response(
      outcome.body === undefined ? null : JSON.stringify(outcome.body),
      { status: outcome.status, headers: { "content-type": "application/json" } },
    );
  });
}

async function render(
  papel?: string,
  outcome: Parameters<typeof stubFetch>[0] = {
    status: 200,
    body: ACADEMY,
  },
) {
  stubFetch(outcome);
  const element = await ConvitePage({
    params: Promise.resolve({ academyId: ACADEMY_ID }),
    searchParams: Promise.resolve(papel === undefined ? {} : { papel }),
  });
  return renderToStaticMarkup(element);
}

afterEach(() => {
  vi.unstubAllGlobals();
  userAgent.value = "";
});

describe("/convite/[academyId]", () => {
  it("renders the inviting academy's name", async () => {
    const html = await render("instrutor");
    expect(html).toContain("Academia Gracie Centro");
  });

  it("falls back to the Tatame icon when the academy has no logo", async () => {
    const withLogo = await render("aluno");
    expect(withLogo).toContain('src="https://cdn.example/logo.png"');

    const withoutLogo = await render("aluno", {
      status: 200,
      body: { ...ACADEMY, logoUrl: null },
    });
    expect(withoutLogo).toContain('src="/icon.png"');
    expect(withoutLogo).not.toContain("cdn.example");
  });

  it("names the kind of member in the heading", async () => {
    const expected: Array<[string, string]> = [
      ["aluno", "Aluno"],
      ["instrutor", "Instrutor"],
      ["responsavel", "Responsável"],
    ];

    for (const [papel, label] of expected) {
      const html = await render(papel);
      expect(html, `?papel=${papel} must name ${label}`).toContain(
        `>${label}</span>`,
      );
    }
  });

  it("says nothing about the role when papel is unusable", async () => {
    for (const papel of [undefined, "xyz"]) {
      const html = await render(papel);
      expect(html).toContain("Academia Gracie Centro");
      for (const label of ["Aluno", "Instrutor", "Responsável"]) {
        expect(
          html,
          `papel=${String(papel)} must not name ${label}`,
        ).not.toContain(label);
      }
    }
  });

  it("closes the loop with the re-tap sentence", async () => {
    // Every outcome that renders this page: named academy, academy with no
    // suggested role, and the degraded page when the API cannot answer.
    expect(await render("aluno")).toContain(RE_TAP);
    expect(await render(undefined)).toContain(RE_TAP);
    expect(await render("aluno", { status: 500 })).toContain(RE_TAP);
  });

  it("sends an unknown academy to the invalid-link page", async () => {
    for (const status of [400, 404]) {
      await expect(
        render("aluno", { status }),
        `${status} must reach notFound()`,
      ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    }
  });

  it("still offers the app when the academy cannot be loaded", async () => {
    for (const outcome of [
      { status: 500 } as const,
      { throws: true } as const,
    ]) {
      const html = await render("instrutor", outcome);
      expect(html).not.toContain("Academia Gracie Centro");
      expect(html).toContain(`href="${STORE_LINKS.ios}"`);
      expect(html).toContain(`href="${STORE_LINKS.android}"`);
      expect(html).toContain(RE_TAP);
      // The suggested role survives the outage — it came from the URL, not
      // from the API.
      expect(html).toContain(">Instrutor</span>");
    }
  });

  it("never implies the link belongs to one person", async () => {
    const barred = [
      "uso único",
      "link único",
      "exclusivo",
      "pessoal",
      "válido apenas para",
    ];
    const outcomes: Array<[string, Parameters<typeof render>[1]]> = [
      ["named academy", { status: 200, body: ACADEMY }],
      ["no suggested role", { status: 200, body: ACADEMY }],
      ["api unavailable", { status: 500 }],
    ];

    for (const [name, outcome] of outcomes) {
      const html = await render(
        name === "no suggested role" ? undefined : "aluno",
        outcome,
      );
      for (const phrase of barred) {
        expect(html, `${name} must not say "${phrase}"`).not.toContain(phrase);
      }
    }
  });
});
