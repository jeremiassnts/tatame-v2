import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STORE_LINKS, type Platform } from "@/lib/store-links";
import { StoreButtons } from "./store-buttons";

const HIGHLIGHTS: Array<Platform | null> = ["ios", "android", null];

function hrefBlock(html: string, href: string) {
  const start = html.indexOf(`href="${href}"`);
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, start + 200);
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
