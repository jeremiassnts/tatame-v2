import { resolvePapelToRole, type InviteRole } from "@tatame/types";

export type { InviteRole };

export type PublicAcademy = {
  id: string;
  name: string;
  logoUrl: string | null;
};

export const ROLE_LABELS: Record<InviteRole, string> = {
  student: "Aluno",
  instructor: "Instrutor",
  guardian: "Responsável",
};

/**
 * The table and the exact-match rule live in `@tatame/types`, because the
 * mobile app parses the same token out of the same link (TAT-177). This stays
 * as the name the page already imports.
 */
export const resolveInviteRole = resolvePapelToRole;

export type InviteView =
  | { kind: "ok"; academy: PublicAcademy; role: InviteRole | null }
  | { kind: "not-found" }
  | { kind: "unavailable"; role: InviteRole | null };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

/**
 * Three outcomes, and the split between the last two is the point. A `400` or
 * `404` means this academy does not exist, so the visitor gets the
 * invalid-link page. Anything else — the API down, a `500`, a DNS failure —
 * means we do not know, and telling someone their academy is gone during an
 * outage is worse than showing them the store buttons without a name.
 */
export async function resolveInviteView(
  academyId: string,
  papel: string | string[] | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<InviteView> {
  const role = resolveInviteRole(papel);

  let res: Response;
  try {
    res = await fetchImpl(`${API_URL}/academies/${academyId}/public`, {
      cache: "no-store",
    });
  } catch {
    return { kind: "unavailable", role };
  }

  if (res.status === 400 || res.status === 404) return { kind: "not-found" };
  if (!res.ok) return { kind: "unavailable", role };

  try {
    const academy = (await res.json()) as PublicAcademy;
    return { kind: "ok", academy, role };
  } catch {
    return { kind: "unavailable", role };
  }
}
