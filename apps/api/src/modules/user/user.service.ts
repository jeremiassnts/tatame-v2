import { and, eq } from "drizzle-orm";
import type { UserJSON } from "@clerk/backend";
import type { Role } from "@tatame/types";
import { userRoles, users, type Database } from "@tatame/db";

function primaryEmail(data: UserJSON): string | undefined {
  const list = data.email_addresses ?? [];
  const primaryId = data.primary_email_address_id;
  const chosen = primaryId
    ? list.find((e) => e.id === primaryId)
    : list[0];
  return chosen?.email_address;
}

function displayName(data: UserJSON): string {
  const parts = [data.first_name, data.last_name].filter(
    (x): x is string => Boolean(x?.trim()),
  );
  if (parts.length) return parts.join(" ");
  if (data.username) return data.username;
  return primaryEmail(data) ?? "User";
}

/** Idempotent upsert for Clerk retries (spec §13). */
export async function upsertUserFromClerk(
  db: Database,
  data: UserJSON,
): Promise<void> {
  const email = primaryEmail(data);
  if (!email) {
    throw new Error("Clerk user has no email; cannot upsert into users");
  }
  await db
    .insert(users)
    .values({
      clerkUserId: data.id,
      email,
      name: displayName(data),
      profileImageUrl: data.image_url ?? null,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        email,
        name: displayName(data),
        profileImageUrl: data.image_url ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function deleteUserByClerkId(
  db: Database,
  clerkUserId: string,
): Promise<void> {
  await db.delete(users).where(eq(users.clerkUserId, clerkUserId));
}

export async function getUserByClerkId(
  db: Database,
  clerkUserId: string,
) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return row ?? null;
}

export async function getActiveRoleForUser(
  db: Database,
  internalUserId: string,
): Promise<Role | null> {
  const [row] = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(
      and(eq(userRoles.userId, internalUserId), eq(userRoles.isActive, true)),
    )
    .limit(1);
  if (!row?.role) return null;
  return row.role as Role;
}

/**
 * MVP: one active role per user (spec §2). Rejects if an active row already exists.
 * @returns whether a new row was inserted
 */
export async function assignInitialUserRole(
  db: Database,
  internalUserId: string,
  role: Role,
): Promise<boolean> {
  const existing = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(
      and(eq(userRoles.userId, internalUserId), eq(userRoles.isActive, true)),
    )
    .limit(1);
  if (existing.length > 0) return false;

  await db.insert(userRoles).values({
    userId: internalUserId,
    role,
    isActive: true,
    startedAt: new Date(),
    endedAt: null,
  });
  return true;
}
