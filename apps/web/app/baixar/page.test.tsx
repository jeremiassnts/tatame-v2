import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { STORE_LINKS } from "@/lib/store-links";

const userAgent = vi.hoisted(() => ({ value: "" }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": userAgent.value }),
}));

// `next/image` reaches for the Next build context, which a bare vitest run has
// no reason to provide. The page's claim is about the store links and the copy,
// not about how the logo is optimised.
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // A stub for `next/image`, which needs a Next build context a bare test
    // has not.
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

const { default: BaixarPage } = await import("./page");

async function render(ua = "") {
  userAgent.value = ua;
  return renderToStaticMarkup(await BaixarPage());
}

describe("/baixar", () => {
  it("puts both stores in front of a member", async () => {
    const html = await render(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)",
    );
    expect(html).toContain(`href="${STORE_LINKS.ios}"`);
    expect(html).toContain(`href="${STORE_LINKS.android}"`);
  });

  it("carries no manager marketing", async () => {
    const html = await render();
    // One string per marketing section the site's landing page composes. If any
    // of them is ever imported here, this is what notices.
    const barred = [
      "Sua academia inteira na palma da sua mão", // HeroV2 h1
      "O que o app oferece", // FeaturesV2 h2
      "Um plano. Tudo incluso.", // PricingV2 h2
      "Perguntas frequentes", // FaqV2 h2
    ];
    for (const phrase of barred) {
      expect(html, `/baixar must not carry "${phrase}"`).not.toContain(phrase);
    }
  });
});
