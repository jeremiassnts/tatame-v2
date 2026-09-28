import type { Database } from "@tatame/db";
import {
  academyPayoutAccounts,
  managerSubscriptions,
  userRoles,
  users,
} from "@tatame/db/schema";
import { makeUser, makeUserRole } from "./factories/index.js";

export async function insertUserWithGlobalRole(
  db: Database,
  clerkUserId: string,
  role: "manager" | "instructor" | "student",
) {
  const u = makeUser({ clerkUserId });
  const ur = makeUserRole({ userId: u.id, role, isActive: true });
  await db.insert(users).values(u);
  await db.insert(userRoles).values(ur);
  return u;
}

export async function insertFreeSubscription(
  db: Database,
  academyId: string,
) {
  await db.insert(managerSubscriptions).values({
    academyId,
    plan: "free",
    status: "active",
  });
}

/**
 * A manager subscription in an arbitrary state, for tests that care about the
 * plan gate rather than about having any subscription at all.
 */
export async function insertSubscription(
  db: Database,
  academyId: string,
  opts: {
    plan?: "free" | "pro";
    status?: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  } = {},
) {
  await db.insert(managerSubscriptions).values({
    academyId,
    plan: opts.plan ?? "pro",
    status: opts.status ?? "active",
  });
}

export async function insertUserWithoutRole(db: Database, clerkUserId: string) {
  const u = makeUser({ clerkUserId });
  await db.insert(users).values(u);
  return u;
}

/**
 * An academy that can already receive money. Plan creation and enrolment are
 * gated on it, so any test that reaches either needs one — the same way they
 * already need a manager subscription.
 */
export async function insertApprovedPayoutAccount(
  db: Database,
  academyId: string,
) {
  await db.insert(academyPayoutAccounts).values({
    academyId,
    externalAccountId: `acc_${academyId.slice(0, 8)}`,
    walletId: `wal_${academyId.slice(0, 8)}`,
    apiKeyEncrypted: "test-sealed-key",
    status: "approved",
    generalStatus: "APPROVED",
    approvedAt: new Date(),
  });
}
