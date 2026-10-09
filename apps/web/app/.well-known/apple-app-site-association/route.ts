/**
 * iOS fetches this at install time to decide whether `apptatame.com.br` links
 * may open the app. Served with no file extension and `application/json`,
 * which is what Apple requires.
 *
 * `IOS_APP_ID` is `<TeamID>.<bundle identifier>`, e.g.
 * `ABCDE12345.com.anonymous.tatame`. It lives in the environment rather than
 * in a committed file because the value is account-specific, and a wrong one
 * fails silently — the link just opens the browser. Unset means "not
 * configured yet", and a `404` says that honestly instead of publishing a
 * document naming no app.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const appId = process.env.IOS_APP_ID;
  if (!appId) {
    return new Response(null, { status: 404 });
  }

  const body = {
    applinks: {
      details: [
        {
          appIDs: [appId],
          components: [
            { "/": "/convite/*", comment: "Invite links for an academy" },
            { "/": "/baixar", comment: "App download page" },
          ],
        },
      ],
    },
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
}
