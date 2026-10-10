import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const APP_ID = "ABCDE12345.com.anonymous.tatame";

afterEach(() => {
  delete process.env.IOS_APP_ID;
});

describe("/.well-known/apple-app-site-association", () => {
  it("declares the iOS app for the invite paths", async () => {
    process.env.IOS_APP_ID = APP_ID;

    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");

    const body = (await res.json()) as {
      applinks: { details: Array<{ appIDs: string[] }> };
    };
    expect(body.applinks.details[0]!.appIDs).toEqual([APP_ID]);
  });

  it("lists both invite paths in components", async () => {
    process.env.IOS_APP_ID = APP_ID;

    const body = (await GET().json()) as {
      applinks: { details: Array<{ components: Array<{ "/": string }> }> };
    };
    const paths = body.applinks.details[0]!.components.map((c) => c["/"]);

    expect(paths).toContain("/convite/*");
    expect(paths).toContain("/baixar");
  });

  it("answers 404 while the app id is unconfigured", () => {
    delete process.env.IOS_APP_ID;

    // A document naming no app verifies nothing; saying "not here" is honest.
    expect(GET().status).toBe(404);
  });
});
