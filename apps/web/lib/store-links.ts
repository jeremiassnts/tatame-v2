/**
 * The two store short links, in one place. They were inlined in
 * `assinatura-confirmada/page.tsx` and `conta/(dashboard)/layout.tsx`, and this
 * feature adds two more consumers — `/baixar` and `/convite/[academyId]`.
 */
export const STORE_LINKS = {
  ios: "https://ios.apptatame.com.br",
  android: "https://android.apptatame.com.br",
} as const;

export type Platform = keyof typeof STORE_LINKS;

/**
 * Which store to put forward, read off the user-agent. Returning `null` is a
 * first-class answer, not a failure: a desktop visitor matches neither, and
 * both buttons render either way — the highlight is a hint, never a filter.
 */
export function detectPlatform(
  userAgent: string | null | undefined,
): Platform | null {
  if (!userAgent) return null;
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return null;
}
