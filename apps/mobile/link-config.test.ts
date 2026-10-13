/**
 * The native half of TAT-177: whether `apptatame.com.br` links are claimed by
 * this app at all.
 *
 * These assertions run against the config **as `@expo/config` resolves it**,
 * not against the bytes of `app.json`. That matters because the resolution is
 * what `eas build` and `expo prebuild` consume: config plugins contribute keys,
 * and a value that survives a raw file read but not the resolution would make
 * every link fall back to the browser with the whole suite still green. The
 * last test here is the negative control that keeps the two distinguishable.
 */

import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = fileURLToPath(new URL("./", import.meta.url));

const resolved = JSON.parse(
  execFileSync(
    join(MOBILE_ROOT, "node_modules/.bin/expo"),
    ["config", "--type", "introspect", "--json"],
    { cwd: MOBILE_ROOT, encoding: "utf-8", maxBuffer: 32 * 1024 * 1024 },
  ),
);

const HOST = "apptatame.com.br";

/** The one filter that claims web links; everything else Android declares is not ours. */
function linkFilter() {
  const filters = resolved.android?.intentFilters ?? [];
  return filters.filter(
    (f: { action?: string; autoVerify?: boolean }) =>
      f.action === "VIEW" && f.autoVerify === true,
  );
}

describe("the iOS domain claim", () => {
  it("claims the invite domain for iOS", () => {
    // Array equality, not `toContain`: a removed entry and an extra one both
    // change which domains iOS will hand to this app, so both have to fail.
    expect(resolved.ios?.associatedDomains).toEqual([`applinks:${HOST}`]);
  });
});

describe("the Android App Links claim", () => {
  it("declares one auto-verified browsable view filter", () => {
    const ours = linkFilter();
    expect(ours).toHaveLength(1);

    const categories = [ours[0].category].flat();
    // Without BROWSABLE the OS never offers the app for a web link, and
    // without DEFAULT it is never the implicit answer — either one missing
    // leaves the user on the browser with no error anywhere.
    expect(categories).toContain("BROWSABLE");
    expect(categories).toContain("DEFAULT");
  });

  it("claims every invite path on Android", () => {
    const data = [linkFilter()[0].data].flat();
    // `pathPrefix` and not `path`: the academy id is a segment we do not know
    // in advance. The trailing slash is what keeps `/conviteX` out.
    expect(data).toContainEqual({
      scheme: "https",
      host: HOST,
      pathPrefix: "/convite/",
    });
  });

  it("claims the download page on Android", () => {
    const data = [linkFilter()[0].data].flat();
    // Exact `path`, mirroring the `/baixar` component TAT-176 already shipped
    // in the apple-app-site-association file.
    expect(data).toContainEqual({ scheme: "https", host: HOST, path: "/baixar" });
  });
});

describe("the custom scheme", () => {
  it("keeps the tatame scheme", () => {
    // `lib/hooks/use-start-sso.ts` builds its redirect with
    // `Linking.createURL`, which reads this. Renaming it breaks sign-in.
    expect(resolved.scheme).toBe("tatame");
  });
});

describe("the level these assertions run at", () => {
  it("reads the config Expo resolves, not the file on disk", () => {
    // Neither of these appears anywhere in `app.json`: `sdkVersion` is derived
    // from the installed `expo` package, and `UILaunchStoryboardName` is
    // contributed by a config plugin. If this test ever starts failing while
    // the five above pass, the object under assertion stopped being the
    // resolution and became a raw file read.
    expect(resolved.sdkVersion).toBe("57.0.0");
    expect(resolved.ios?.infoPlist?.UILaunchStoryboardName).toBe("SplashScreen");
  });
});
