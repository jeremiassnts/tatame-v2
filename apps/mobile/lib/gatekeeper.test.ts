import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Role } from "@tatame/types";
import {
  resolveGatekeeperRoute,
  type GatekeeperUser,
} from "@/lib/gatekeeper";

const INVITE_A1 = { academyId: "a1", role: "instructor" } as const;
const INVITE_A2 = { academyId: "a2", role: "student" } as const;

const MEMBER_ROLES = ["instructor", "student", "guardian"] as const;

function user(over: Partial<GatekeeperUser> = {}): GatekeeperUser {
  return {
    activeRole: "student",
    activeAcademy: null,
    activeMembership: null,
    ...over,
  };
}

function membership(
  status: "pending" | "active" | "blocked",
  academyId = "a1",
) {
  return { academyId, status } as const;
}

describe("resolveGatekeeperRoute", () => {
  it("sends a signed-out person to the auth stack", () => {
    // And keeps the invite. Signing up *is* the detour the invite has to
    // survive, so spending it here would break the feature's main case.
    for (const invite of [null, INVITE_A1]) {
      expect(
        resolveGatekeeperRoute({ isSignedIn: false, user: user(), invite }),
      ).toEqual({ route: "/(auth)", clearInvite: false });
    }
  });

  it("stays put while the user is unknown", () => {
    expect(
      resolveGatekeeperRoute({
        isSignedIn: true,
        user: null,
        invite: INVITE_A1,
      }),
    ).toEqual({ route: null, clearInvite: false });
  });

  it("sends someone with no role to the role step", () => {
    // Never past it. `POST /memberships/requests` reads the role from
    // `req.appAuth!.role` and answers 403 when there is none, so an invite that
    // skipped this screen would land on a 403 it could not explain.
    for (const invite of [null, INVITE_A1]) {
      expect(
        resolveGatekeeperRoute({
          isSignedIn: true,
          user: user({ activeRole: null }),
          invite,
        }),
      ).toEqual({ route: "/(onboarding)/user-type", clearInvite: false });
    }
  });

  it("sends a manager with no academy to create one", () => {
    expect(
      resolveGatekeeperRoute({
        isSignedIn: true,
        user: user({ activeRole: "manager" }),
        invite: INVITE_A1,
      }),
    ).toEqual({ route: "/(app)/create-academy", clearInvite: true });
  });

  it("sends a manager with an academy home", () => {
    expect(
      resolveGatekeeperRoute({
        isSignedIn: true,
        user: user({ activeRole: "manager", activeAcademy: { id: "own" } }),
        invite: INVITE_A1,
      }),
    ).toEqual({ route: "/(app)/(manager)/(home)", clearInvite: true });
  });

  it("sends every member role with no invite to the academy search", () => {
    for (const activeRole of MEMBER_ROLES) {
      expect(
        resolveGatekeeperRoute({
          isSignedIn: true,
          user: user({ activeRole }),
          invite: null,
        }),
        activeRole,
      ).toEqual({
        route: "/(app)/(joining)/search-academy",
        clearInvite: false,
      });
    }
  });

  it("sends every member role with an invite straight to that academy", () => {
    // The line the whole epic is about: the academy by id, never the search box.
    for (const activeRole of MEMBER_ROLES) {
      expect(
        resolveGatekeeperRoute({
          isSignedIn: true,
          user: user({ activeRole }),
          invite: INVITE_A1,
        }),
        activeRole,
      ).toEqual({
        route: "/(app)/(joining)/academy/a1",
        clearInvite: false,
      });
    }
  });

  it("sends a pending request to the waiting screen and spends the invite", () => {
    for (const invite of [null, INVITE_A1, INVITE_A2]) {
      expect(
        resolveGatekeeperRoute({
          isSignedIn: true,
          user: user({ activeMembership: membership("pending") }),
          invite,
        }),
      ).toEqual({
        route: "/(app)/(joining)/pending-approval",
        clearInvite: true,
      });
    }
  });

  it("sends an active student to the student home", () => {
    expect(
      resolveGatekeeperRoute({
        isSignedIn: true,
        user: user({
          activeRole: "student",
          activeMembership: membership("active"),
        }),
        invite: null,
      }),
    ).toEqual({ route: "/(app)/(student)/(home)", clearInvite: true });
  });

  it("sends an active instructor to the instructor home", () => {
    expect(
      resolveGatekeeperRoute({
        isSignedIn: true,
        user: user({
          activeRole: "instructor",
          activeMembership: membership("active"),
        }),
        invite: null,
      }),
    ).toEqual({ route: "/(app)/(instructor)/(home)", clearInvite: true });
  });

  it("sends an active guardian to the guardian home", () => {
    // Which redirects on to `register-dependent` when there are no dependents.
    // That chain belongs to the guardian home and is not touched here.
    expect(
      resolveGatekeeperRoute({
        isSignedIn: true,
        user: user({
          activeRole: "guardian",
          activeMembership: membership("active"),
        }),
        invite: null,
      }),
    ).toEqual({ route: "/(app)/(guardian)/(home)", clearInvite: true });
  });

  it("sends someone invited elsewhere to the already-a-member screen", () => {
    for (const activeRole of MEMBER_ROLES) {
      expect(
        resolveGatekeeperRoute({
          isSignedIn: true,
          user: user({ activeRole, activeMembership: membership("active", "a1") }),
          invite: INVITE_A2,
        }),
        activeRole,
      ).toEqual({
        route: "/(app)/(joining)/already-member",
        clearInvite: true,
      });
    }
  });

  it("absorbs an invite to the academy the person already belongs to", () => {
    // No screen and no message: there is nothing to tell them.
    const homes = {
      instructor: "/(app)/(instructor)/(home)",
      student: "/(app)/(student)/(home)",
      guardian: "/(app)/(guardian)/(home)",
    } as const;

    for (const activeRole of MEMBER_ROLES) {
      expect(
        resolveGatekeeperRoute({
          isSignedIn: true,
          user: user({ activeRole, activeMembership: membership("active", "a1") }),
          invite: { academyId: "a1", role: "student" },
        }),
        activeRole,
      ).toEqual({ route: homes[activeRole], clearInvite: true });
    }
  });

  it("leaves a blocked membership where it is today", () => {
    // `findActiveOrPendingByUser` filters to pending and active, so the API
    // cannot produce this. Answered with "stay put" — today's behaviour —
    // rather than with a screen nothing could reach.
    expect(
      resolveGatekeeperRoute({
        isSignedIn: true,
        user: user({ activeMembership: membership("blocked") }),
        invite: INVITE_A1,
      }),
    ).toEqual({ route: null, clearInvite: false });
  });

  it("never throws and always answers", () => {
    // The full cross product, because this runs on every app start and a throw
    // here is a white screen with no way out.
    const roles: Array<Role | null> = [
      null,
      "manager",
      "instructor",
      "student",
      "guardian",
    ];
    const memberships = [
      null,
      membership("pending"),
      membership("active"),
      membership("blocked"),
    ];
    const invites = [null, INVITE_A1, INVITE_A2];

    let seen = 0;
    for (const isSignedIn of [true, false]) {
      for (const activeRole of roles) {
        for (const activeAcademy of [null, { id: "own" }]) {
          for (const activeMembership of memberships) {
            for (const invite of invites) {
              const decision = resolveGatekeeperRoute({
                isSignedIn,
                user: { activeRole, activeAcademy, activeMembership },
                invite,
              });
              expect(
                decision.route === null || typeof decision.route === "string",
              ).toBe(true);
              expect(typeof decision.clearInvite).toBe("boolean");
              seen += 1;
            }
          }
        }
      }
    }

    expect(seen).toBe(2 * 5 * 2 * 4 * 3);
  });

  it("has exactly one importer", () => {
    // The criterion is one module deciding the route, and a module with two
    // consumers is two places that can disagree about where someone belongs.
    const root = new URL("../", import.meta.url).pathname;
    const importers: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry) || entry.includes(".test.")) continue;
        if (readFileSync(full, "utf8").includes("@/lib/gatekeeper")) {
          importers.push(full.slice(root.length));
        }
      }
    };

    walk(join(root, "app"));
    walk(join(root, "lib"));

    expect(importers).toEqual(["app/(app)/index.tsx"]);
  });
});
