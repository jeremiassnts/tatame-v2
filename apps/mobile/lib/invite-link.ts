import { resolvePapelToRole, type InviteRole } from "@tatame/types";

/**
 * The only host this app claims. `apps/web` serves
 * `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`
 * on the apex alone, so no other host can ever hand a link to this app — a
 * second accepted host would be a branch nothing could exercise.
 */
const HOST = "apptatame.com.br";

/** Fixed by TAT-175 and shipped in TAT-176's links; not ours to rename. */
const INVITE_SEGMENT = "convite";

/** Expo Go wraps the real path after `/--/`. Mirrors expo-router's own regex. */
const EXPO_GO_RE = /^exps?:\/\/.*?\/--\/(.*)$/;

export type InviteLink = {
  academyId: string;
  /** A suggestion the invited person can change, never a lock. */
  role: InviteRole | null;
};

/**
 * Reduce every URL form this app can receive to a leading-slash path with its
 * query string, or `null` when the URL is not one of ours.
 *
 * Four forms reach `redirectSystemPath`, and they are not interchangeable:
 *
 * - `https://apptatame.com.br/convite/x?papel=aluno` — a verified universal /
 *   app link, which is the whole point of TAT-177
 * - `tatame:///convite/x?papel=aluno` — the custom scheme, which is what
 *   `Linking.createURL` builds and the only form testable without a store build
 * - `exp://10.0.0.2:8081/--/convite/x?papel=aluno` — Expo Go, where native
 *   configuration does not exist at all, so this is the only way to exercise
 *   the parse on the phone this project is developed on
 * - `/convite/x?papel=aluno` — already a path, which is what expo-router hands
 *   back when a redirect has already run
 *
 * The non-`http` branch concatenates host and pathname the way expo-router's
 * own `fromDeepLink` does, so `tatame://convite/x` and `tatame:///convite/x`
 * read the same.
 */
function extractLinkPath(url: string | null | undefined): string | null {
  if (typeof url !== "string" || url.length === 0) return null;
  if (url.startsWith("/")) return url;

  const expoGo = url.match(EXPO_GO_RE);
  if (expoGo) return `/${expoGo[1]}`;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol === "https:" || parsed.protocol === "http:") {
    // Exact host, never a suffix match: `apptatame.com.br.evil.com` ends with
    // our domain and is not our domain.
    if (parsed.hostname !== HOST) return null;
    return `${parsed.pathname}${parsed.search}`;
  }

  const host = parsed.host ? `/${parsed.host}` : "";
  return `${host}${parsed.pathname}${parsed.search}`;
}

/**
 * Turn an inbound URL into the academy it names and the role it suggests, or
 * `null` when it is not an invite link.
 *
 * `null` is the common case, not the error case: this runs on every URL the app
 * ever receives, including the SSO redirect, so "not mine" has to be ordinary.
 */
export function parseInviteLink(
  url: string | null | undefined,
): InviteLink | null {
  const path = extractLinkPath(url);
  if (path === null) return null;

  const queryAt = path.indexOf("?");
  const pathname = queryAt === -1 ? path : path.slice(0, queryAt);
  const queryString = queryAt === -1 ? "" : path.slice(queryAt + 1);

  // Empty segments are dropped, which is what makes `/convite//` fail the
  // length check below rather than yielding an empty academy id.
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  if (segments.length !== 2 || segments[0] !== INVITE_SEGMENT) return null;

  let academyId: string;
  try {
    academyId = decodeURIComponent(segments[1]);
  } catch {
    return null;
  }
  if (academyId.length === 0) return null;

  // `getAll` rather than `get`: a repeated `?papel=` arrives as two values, and
  // resolving to whichever one won would be a silent coin flip. An array is not
  // a token, so it degrades to no suggested role.
  const papel = new URLSearchParams(queryString).getAll("papel");

  return {
    academyId,
    role: resolvePapelToRole(papel.length === 1 ? papel[0] : papel),
  };
}

/** `true` for the download page, which is pointless to someone who has the app. */
export function isDownloadLink(url: string | null | undefined): boolean {
  return extractLinkPath(url)?.replace(/\?.*$/, "") === "/baixar";
}
