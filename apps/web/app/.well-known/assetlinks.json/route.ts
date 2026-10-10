/**
 * Android fetches this to verify the App Links for `apptatame.com.br`.
 *
 * `ANDROID_SHA256_CERT_FINGERPRINTS` is comma-separated because there is
 * usually more than one certificate in play: the EAS upload key and the key
 * Play App Signing re-signs with. Listing only one is the classic way App
 * Links silently stop verifying after the first Play release, so both go in.
 */
export const dynamic = "force-dynamic";

const DEFAULT_PACKAGE_NAME = "com.anonymous.tatame";

export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  if (fingerprints.length === 0) {
    return new Response(null, { status: 404 });
  }

  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name:
          process.env.ANDROID_PACKAGE_NAME ?? DEFAULT_PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
}
