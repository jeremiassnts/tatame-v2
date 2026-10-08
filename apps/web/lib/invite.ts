export type InviteRole = "student" | "instructor" | "guardian";

export type PublicAcademy = {
  id: string;
  name: string;
  logoUrl: string | null;
};

/**
 * The link vocabulary, fixed by TAT-175: `?papel=aluno|instrutor|responsavel`.
 * It is Portuguese because the manager pastes the link and the invited person
 * reads it, and it is closed because TAT-177 and TAT-191 parse the same token
 * — once links are circulating in group chats, neither the names nor the
 * spelling can change.
 */
const PAPEL_TO_ROLE: Record<string, InviteRole> = {
  aluno: "student",
  instrutor: "instructor",
  responsavel: "guardian",
};

export const ROLE_LABELS: Record<InviteRole, string> = {
  student: "Aluno",
  instructor: "Instrutor",
  guardian: "Responsável",
};

/**
 * A suggestion, never a lock: an unrecognised token degrades to "no suggested
 * role" and the invite still works. Matching is exact — the token is always
 * produced by the app, never typed by hand, so accepting `ALUNO` would only
 * widen what the three other tickets have to agree on.
 */
export function resolveInviteRole(
  papel: string | string[] | undefined,
): InviteRole | null {
  if (typeof papel !== "string") return null;
  return PAPEL_TO_ROLE[papel] ?? null;
}

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
