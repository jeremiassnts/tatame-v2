import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { STORE_LINKS } from "@/lib/store-links";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // A stub for `next/image`, which needs a Next build context a bare test
    // has not.
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

const { default: AssinaturaConfirmadaPage } = await import("./page");

describe("/assinatura-confirmada", () => {
  /**
   * The grep in `components/store-buttons.test.tsx` proves this page names
   * `StoreButtons`. It cannot prove the page renders them, nor that it asks for
   * the right surface — and `surface="background"` is a live argument with no
   * other call site, so this is the only place it is exercised.
   */
  it("renders the shared store buttons on the card's surface", () => {
    const html = renderToStaticMarkup(<AssinaturaConfirmadaPage />);

    expect(html).toContain(`href="${STORE_LINKS.ios}"`);
    expect(html).toContain(`href="${STORE_LINKS.android}"`);
    // The card is `bg-surface`, so the buttons must be darker than it. Getting
    // this wrong renders the buttons the same colour as what they sit on.
    expect(html).toContain("bg-background hover:bg-surface");
    expect(html).not.toContain("hover:bg-white/5");
  });
});
