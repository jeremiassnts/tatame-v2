import type { Role } from "@tatame/types";
import type { InviteLink } from "@/lib/invite-link";

/**
 * Where a person belongs, given everything the app knows about them.
 *
 * `app/(app)/index.tsx` has always been the single authority on this, and this
 * module is that authority's body lifted out of a `useEffect` — not a second
 * set of rules beside it. The invite does not get its own routing; it changes
 * what these rules decide. Teaching each screen to defend itself instead would
 * put the same auth/role/membership table in five files, which is the drift
 * TAT-191 was written to avoid.
 *
 * It is a pure function with no React, no navigation and no storage for one
 * blunt reason as well: `apps/mobile/vitest.config.ts` runs in `node` with no
 * renderer, so a fourteen-row table living inside a component cannot be
 * asserted at all.
 */

export type GatekeeperUser = {
  activeRole: Role | null;
  /** Non-null for a manager who owns an academy. */
  activeAcademy: { id: string } | null;
  /**
   * `blocked` is in the response schema but `findActiveOrPendingByUser` filters
   * to `["pending", "active"]`, so the API cannot produce it today. It is
   * accepted here, and answered with "stay put", because inventing a
   * destination for it would ship a branch nothing can reach.
   */
  activeMembership: {
    academyId: string;
    status: "pending" | "active" | "blocked";
  } | null;
};

export type GatekeeperInput = {
  isSignedIn: boolean;
  /** `null` while `/users/me` is still in flight. */
  user: GatekeeperUser | null;
  invite: InviteLink | null;
};

export type GatekeeperDecision = {
  /** `null` means "not enough is known yet" — navigate nowhere, keep waiting. */
  route: string | null;
  /**
   * `true` once the invite has done its job or can no longer apply. The caller
   * clears it; this module decides, because the decision is part of the table
   * and not a side effect of arriving somewhere.
   */
  clearInvite: boolean;
};

const MEMBER_HOME = {
  instructor: "/(app)/(instructor)/(home)",
  student: "/(app)/(student)/(home)",
  /**
   * Which redirects straight on to `(guardian)/(onboarding)/register-dependent`
   * when the guardian has no dependents, so a guardian invite ends at
   * registering a child rather than at an empty home. That chain is not ours
   * and is deliberately left alone.
   */
  guardian: "/(app)/(guardian)/(home)",
} as const;

export function resolveGatekeeperRoute({
  isSignedIn,
  user,
  invite,
}: GatekeeperInput): GatekeeperDecision {
  // Sign-out is not the end of an invite. The person may be about to create the
  // account the invite was sent to, which is the whole case this feature exists
  // for, so the invite is kept across the auth detour rather than spent on it.
  if (!isSignedIn) return { route: "/(auth)", clearInvite: false };

  if (!user) return { route: null, clearInvite: false };

  const { activeRole, activeAcademy, activeMembership } = user;

  // The role step cannot be skipped, invite or not: `POST /memberships/requests`
  // takes the role from `req.appAuth!.role` and answers 403 to a user who has
  // none. The invite reaches the step as context, never as a bypass.
  if (!activeRole) {
    return { route: "/(onboarding)/user-type", clearInvite: false };
  }

  // A manager owns an academy rather than joining one, so there is no invite a
  // manager could act on. Discarded rather than carried, or it would sit in
  // storage waiting for a role change that is not a thing this app does.
  if (activeRole === "manager") {
    return {
      route: activeAcademy
        ? "/(app)/(manager)/(home)"
        : "/(app)/create-academy",
      clearInvite: true,
    };
  }

  if (!activeMembership) {
    // The one line this whole epic is about: the academy by id, never the
    // search box.
    return invite
      ? {
          route: `/(app)/(joining)/academy/${invite.academyId}`,
          clearInvite: false,
        }
      : { route: "/(app)/(joining)/search-academy", clearInvite: false };
  }

  // A membership row exists, so the invite is spent either way — this is what
  // stops an invite from months ago pulling someone toward a different academy,
  // with no expiry window needed to say it.
  if (activeMembership.status === "pending") {
    return { route: "/(app)/(joining)/pending-approval", clearInvite: true };
  }

  if (activeMembership.status === "active") {
    if (invite && invite.academyId !== activeMembership.academyId) {
      return { route: "/(app)/(joining)/already-member", clearInvite: true };
    }
    // Including an invite to the academy they already belong to: absorbed in
    // silence, because there is nothing to tell them.
    return { route: MEMBER_HOME[activeRole], clearInvite: true };
  }

  return { route: null, clearInvite: false };
}
