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

const { default: ConviteNaoEncontrado } = await import("./not-found");

describe("/convite/[academyId] not-found", () => {
  it("tells the visitor the invite link is invalid", () => {
    const html = renderToStaticMarkup(<ConviteNaoEncontrado />);

    expect(html).toContain("Convite inválido");
    expect(html).toContain("Este link não aponta para nenhuma academia");
    // No academy name can appear here: a 400 or a 404 means there is none.
    expect(html).not.toContain("Academia Gracie Centro");
    // Still offers the app — a mistyped invite is no reason to send the
    // visitor away empty-handed.
    expect(html).toContain(`href="${STORE_LINKS.ios}"`);
    expect(html).toContain(`href="${STORE_LINKS.android}"`);
  });
});
