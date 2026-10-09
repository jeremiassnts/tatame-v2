import {
  getPendingInviteSnapshot,
  hydratePendingInvite,
  subscribeToPendingInvite,
  type PendingInviteSnapshot,
} from "@/lib/pending-invite";
import { useEffect, useSyncExternalStore } from "react";

/**
 * The pending invite, as React state.
 *
 * A subscription rather than a one-off read, because a link can arrive while
 * the screen reading this is already mounted — `+native-intent.ts` is called on
 * a resume as well as on a cold start, and a `useState` seeded once would miss
 * the warm case entirely.
 *
 * `hydratePendingInvite` is idempotent, so calling it from every consumer is
 * cheap and means no screen depends on another having mounted first.
 */
export function usePendingInvite(): PendingInviteSnapshot {
  const snapshot = useSyncExternalStore(
    subscribeToPendingInvite,
    getPendingInviteSnapshot,
    getPendingInviteSnapshot,
  );

  useEffect(() => {
    void hydratePendingInvite();
  }, []);

  return snapshot;
}
