import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, isProtectedRoute } from "./middleware";

/** `createRouteMatcher` reads `req.nextUrl.pathname` and nothing else. */
function at(pathname: string) {
  return { nextUrl: { pathname } } as unknown as NextRequest;
}

const PUBLIC_PATHS = [
  "/convite/11111111-1111-1111-1111-111111111111",
  "/baixar",
  "/.well-known/apple-app-site-association",
  "/.well-known/assetlinks.json",
];

describe("middleware", () => {
  it("challenges only the manager account area", () => {
    for (const pathname of PUBLIC_PATHS) {
      expect(
        isProtectedRoute(at(pathname)),
        `${pathname} must stay public`,
      ).toBe(false);
    }

    // The live sibling, asserted in the same test: all four returning `false`
    // would also be what a matcher that stopped matching anything looks like.
    expect(isProtectedRoute(at("/conta/assinatura"))).toBe(true);
  });

  it("does run the middleware on assetlinks.json", () => {
    // TAT-176's description claims the matcher "already excludes `.json`
    // files". It does not: `js(?!on)` matches `.js` only when not followed by
    // `on`. So the middleware does run here, and the pass-through is carried
    // by `isProtectedRoute` above rather than by the matcher.
    const matcher = new RegExp(`^${config.matcher[0]}$`);

    expect(matcher.test("/.well-known/assetlinks.json")).toBe(true);
    // A real static asset, by contrast, is excluded.
    expect(matcher.test("/icon.png")).toBe(false);
  });
});
