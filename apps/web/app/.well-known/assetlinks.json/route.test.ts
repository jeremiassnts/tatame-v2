import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const UPLOAD_CERT =
  "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99";
const PLAY_CERT =
  "11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00";

type AssetLink = {
  relation: string[];
  target: {
    namespace: string;
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
};

afterEach(() => {
  delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS;
  delete process.env.ANDROID_PACKAGE_NAME;
});

describe("/.well-known/assetlinks.json", () => {
  it("delegates both signing certificates to the Android package", async () => {
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS = `${UPLOAD_CERT}, ${PLAY_CERT}`;

    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");

    const body = (await res.json()) as AssetLink[];
    expect(body).toHaveLength(1);
    expect(body[0]!.relation).toEqual([
      "delegate_permission/common.handle_all_urls",
    ]);
    expect(body[0]!.target.namespace).toBe("android_app");
    expect(body[0]!.target.package_name).toBe("com.anonymous.tatame");
    // Both, in order, with the whitespace after the comma trimmed. One
    // fingerprint is how App Links quietly stop verifying after the first
    // Play release re-signs the bundle.
    expect(body[0]!.target.sha256_cert_fingerprints).toEqual([
      UPLOAD_CERT,
      PLAY_CERT,
    ]);
  });

  it("answers 404 while the fingerprints are unconfigured", () => {
    delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS;

    expect(GET().status).toBe(404);
  });
});
