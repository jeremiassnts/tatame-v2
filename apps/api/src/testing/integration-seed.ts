import type { Database } from "@tatame/db";
import { managerSubscriptions, userRoles, users } from "@tatame/db/schema";
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

export async function insertUserWithoutRole(db: Database, clerkUserId: string) {
  const u = makeUser({ clerkUserId });
  await db.insert(users).values(u);
  return u;
}
