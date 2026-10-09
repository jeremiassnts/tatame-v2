import type { InviteLink } from "@/lib/invite-link";

/**
 * The invite an inbound link left behind, waiting for something to act on it.
 *
 * TAT-177 only delivers it: nothing in the app reads this yet. TAT-191 is its
 * consumer, and it is the ticket that decides what the invite has to survive —
 * a sign-up round trip, a process restart, the store detour. Those three need
 * very different storage, so this holds the value in module state and keeps
 * the three signatures stable instead of guessing.
 *
 * Module state is correct for what TAT-177 claims and nothing more: it lives
 * for one JS context, which is exactly long enough for the cold-start URL to
 * reach `app/index.tsx`.
 */
export type PendingInvite = InviteLink;

let pending: PendingInvite | null = null;

/**
 * Last write wins. Two invite links in one session means the person tapped
 * twice, and the second tap is the one they meant — an error or a queue here
 * would both be inventions nobody asked for.
 */
export function setPendingInvite(invite: PendingInvite): void {
  pending = invite;
}

export function readPendingInvite(): PendingInvite | null {
  return pending;
}

export function clearPendingInvite(): void {
  pending = null;
}
