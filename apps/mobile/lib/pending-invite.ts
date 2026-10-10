import AsyncStorage from "@react-native-async-storage/async-storage";
import { PAPEL_TO_ROLE, type InviteRole } from "@tatame/types";
import type { InviteLink } from "@/lib/invite-link";

/**
 * The invite an inbound link left behind, and the thing TAT-191 built the rest
 * of itself around.
 *
 * Two storage layers, and the split is the whole design. `redirectSystemPath`
 * is synchronous and returns a string, so it cannot await a write — and the
 * gatekeeper reads the invite on the very next hop. Module state is therefore
 * the **synchronous source of truth**, which is what makes that hop safe with
 * nothing ordering it. The AsyncStorage key is a **mirror**, and it exists for
 * the one case module state cannot cover: the process dying during the Clerk
 * sign-up detour, which on Android is an ordinary thing for the system to do.
 *
 * Not `SecureStore` — an academy id is not a secret, and that module is the
 * Clerk token cache's.
 */
export type PendingInvite = InviteLink;

/**
 * `hydrated` is not a loading flag for a spinner. It is what stops the
 * gatekeeper deciding against an empty store before the mirror has been read:
 * a person with a pending invite would be sent to `search-academy`, which is
 * the exact screen this feature exists to remove.
 */
export type PendingInviteSnapshot = {
  invite: PendingInvite | null;
  hydrated: boolean;
};

const STORAGE_KEY = "tatame.pending-invite";

/**
 * The roles a persisted invite may name, taken from the one table that defines
 * them rather than written out a fourth time. `null` is also valid and means
 * the link suggested no role.
 */
const PERSISTABLE_ROLES = new Set<string>(Object.values(PAPEL_TO_ROLE));

const EMPTY: PendingInviteSnapshot = { invite: null, hydrated: false };

let snapshot: PendingInviteSnapshot = EMPTY;
const listeners = new Set<() => void>();

/**
 * A new object only on a real change, so two reads with nothing between them
 * are `toBe`-identical. `useSyncExternalStore` re-renders forever against a
 * snapshot that is a fresh object every call.
 */
function emit(next: PendingInviteSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

async function mirror(invite: PendingInvite | null): Promise<void> {
  try {
    if (invite) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(invite));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // The device refused to persist. Module state still holds the invite, so
    // the invite survives everything except the process dying — which is
    // strictly better than losing it now, and there is nobody to tell.
  }
}

/**
 * Anything we did not write ourselves resolves to no invite at all, never to
 * half of one: a `{ academyId }` with no usable role would send someone into a
 * join flow for an academy nobody named, and an unknown role string would
 * reach `ROLE_LABELS` as a missing key.
 */
export function parsePersistedInvite(
  raw: string | null | undefined,
): PendingInvite | null {
  if (typeof raw !== "string" || raw.length === 0) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  // `typeof [] === "object"`, and an array's `.academyId` is `undefined`, so
  // the array check is belt-and-braces rather than load-bearing. It is here
  // because the next person reading this should not have to work that out.
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const { academyId, role } = value as { academyId?: unknown; role?: unknown };
  if (typeof academyId !== "string" || academyId.length === 0) return null;

  if (role === null || role === undefined) return { academyId, role: null };
  if (typeof role !== "string" || !PERSISTABLE_ROLES.has(role)) return null;

  return { academyId, role: role as InviteRole };
}

export function getPendingInviteSnapshot(): PendingInviteSnapshot {
  return snapshot;
}

export function subscribeToPendingInvite(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readPendingInvite(): PendingInvite | null {
  return snapshot.invite;
}

/**
 * Last write wins. Two invite links in one session means the person tapped
 * twice, and the second tap is the one they meant — an error or a queue here
 * would both be inventions nobody asked for.
 *
 * Stays `void`-returning and synchronous in its visible effect:
 * `+native-intent.ts` calls it from a function that has to return a string.
 */
export function setPendingInvite(invite: PendingInvite): void {
  emit({ invite, hydrated: true });
  void mirror(invite);
}

/**
 * Both layers, and in that order. The invite is gone for this session before
 * the key is gone from the device, because the caller is about to navigate.
 */
export async function clearPendingInvite(): Promise<void> {
  emit({ invite: null, hydrated: true });
  await mirror(null);
}

/**
 * Reads the mirror once per process. A second call is a no-op by `hydrated`,
 * not by a cached promise: every writer sets `hydrated`, so an invite that
 * arrived by link before anyone hydrated is never overwritten by a stale read.
 */
export async function hydratePendingInvite(): Promise<void> {
  if (snapshot.hydrated) return;

  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }

  // Re-checked: a link can arrive while the read is in flight, and that invite
  // is newer than anything on disk.
  if (snapshot.hydrated) return;
  emit({ invite: parsePersistedInvite(raw), hydrated: true });
}
