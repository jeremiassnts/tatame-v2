import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STORE_LINKS, type Platform } from "@/lib/store-links";
import { StoreButtons } from "./store-buttons";

const HIGHLIGHTS: Array<Platform | null> = ["ios", "android", null];

/**
 * The opening `<a>` tag carrying this href, and nothing after it. Bounded by
 * the tag's own `>` rather than by a character count, so it can never bleed
 * into the sibling button and report its attributes as this one's.
 */
function hrefBlock(html: string, href: string) {
  const start = html.indexOf(`href="${href}"`);
  expect(start, `no anchor for ${href}`).toBeGreaterThan(-1);
  const end = html.indexOf(">", start);
  expect(end, `unterminated anchor for ${href}`).toBeGreaterThan(start);
  return html.slice(start, end);
}

describe("StoreButtons", () => {
  it("renders both store links whatever the platform", () => {
    for (const highlight of HIGHLIGHTS) {
      const html = renderToStaticMarkup(
        <StoreButtons highlight={highlight} />,
      );
      expect(html).toContain(`href="${STORE_LINKS.ios}"`);
      expect(html).toContain(`href="${STORE_LINKS.android}"`);
    }
  });

  it("marks exactly the store matching the platform", () => {
    const expected: Record<string, [string, string]> = {
      // [ios marker, android marker]
      ios: ["true", "false"],
      android: ["false", "true"],
      none: ["false", "false"],
    };

    for (const highlight of HIGHLIGHTS) {
      const html = renderToStaticMarkup(
        <StoreButtons highlight={highlight} />,
      );
      const [ios, android] = expected[highlight ?? "none"]!;
      expect(hrefBlock(html, STORE_LINKS.ios)).toContain(
        `data-highlighted="${ios}"`,
      );
      expect(hrefBlock(html, STORE_LINKS.android)).toContain(
        `data-highlighted="${android}"`,
      );
    }
  });

  it("puts each consumer's buttons on the surface it sits on", () => {
    // Both rows of the surface table, asserted. The variant exists because the
    // two existing consumers genuinely differ: `assinatura-confirmada` is a
    // `surface` card, so its buttons have to be darker than it, while the
    // `conta` dashboard is `background`, so its buttons have to be lighter.
    // Collapse the two and one of them renders the same colour as what it sits
    // on, which is the failure the plan's Impact table named in advance.
    const expected: Array<["background" | "surface", string, string]> = [
      ["background", "bg-background", "hover:bg-surface"],
      ["surface", "bg-surface", "hover:bg-white/5"],
    ];

    for (const [surface, background, hover] of expected) {
      const html = renderToStaticMarkup(<StoreButtons surface={surface} />);

      for (const href of [STORE_LINKS.ios, STORE_LINKS.android]) {
        const block = hrefBlock(html, href);
        expect(block, `${surface} must use ${background}`).toContain(
          ` ${background} `,
        );
        expect(block, `${surface} must use ${hover}`).toContain(hover);
      }
    }

    // And the two are not the same markup, which a shared substring would hide.
    expect(renderToStaticMarkup(<StoreButtons surface="background" />)).not.toBe(
      renderToStaticMarkup(<StoreButtons surface="surface" />),
    );
  });

  it("is the only store markup every consumer renders", () => {
    const consumers = [
      "app/assinatura-confirmada/page.tsx",
      "app/conta/(dashboard)/layout.tsx",
      "app/baixar/page.tsx",
      "app/convite/[academyId]/page.tsx",
    ];

    for (const relative of consumers) {
      const source = readFileSync(join(process.cwd(), relative), "utf-8");
      expect(source, `${relative} must import StoreButtons`).toContain(
        "StoreButtons",
      );
      // And must not have kept its own copy of the links.
      expect(source, `${relative} must not inline a store URL`).not.toContain(
        "apptatame.com.br",
      );
    }
  });
});
