import { and, eq, inArray, ne } from "drizzle-orm";
import {
  academies,
  academyMemberships,
  users,
  type Database,
} from "@tatame/db";
import { HttpError } from "../../lib/http-error.js";
import { assertManagerOwnsAcademy } from "../academy/academy.service.js";

export async function getActiveMembership(db: Database, userId: string) {
  const [row] = await db
    .select()
    .from(academyMemberships)
    .where(
      and(
        eq(academyMemberships.userId, userId),
        eq(academyMemberships.isActive, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function loadMembership(db: Database, membershipId: string) {
  const [row] = await db
    .select()
    .from(academyMemberships)
    .where(eq(academyMemberships.id, membershipId))
    .limit(1);
  return row ?? null;
}

export async function requestMembership(
  db: Database,
  userId: string,
  role: "instructor" | "student",
  academyId: string,
) {
  const [academy] = await db
    .select({ id: academies.id })
    .from(academies)
    .where(eq(academies.id, academyId))
    .limit(1);
  if (!academy) {
    throw new HttpError(404, "Academy not found");
  }

  const active = await getActiveMembership(db, userId);
  if (active) {
    throw new HttpError(
      409,
      "You already have an active academy membership; leave before joining another",
    );
  }

  const [blocked] = await db
    .select({ id: academyMemberships.id })
    .from(academyMemberships)
    .where(
      and(
        eq(academyMemberships.userId, userId),
        eq(academyMemberships.academyId, academyId),
        inArray(academyMemberships.status, ["blocked", "rejected"]),
      ),
    )
    .limit(1);
  if (blocked) {
    throw new HttpError(
      403,
      "Cannot request again for this academy until a manager unblocks you",
    );
  }

  const [pending] = await db
    .select({ id: academyMemberships.id })
    .from(academyMemberships)
    .where(
      and(
        eq(academyMemberships.userId, userId),
        eq(academyMemberships.academyId, academyId),
        eq(academyMemberships.status, "pending"),
      ),
    )
    .limit(1);
  if (pending) {
    throw new HttpError(409, "You already have a pending request for this academy");
  }

  const [created] = await db
    .insert(academyMemberships)
    .values({
      academyId,
      userId,
      role,
      status: "pending",
      isActive: false,
      joinedAt: null,
      leftAt: null,
    })
    .returning();

  if (!created) {
    throw new HttpError(500, "Failed to create membership request");
  }
  return created;
}

export async function listPendingMembershipsForAcademy(
  db: Database,
  academyId: string,
  managerUserId: string,
) {
  await assertManagerOwnsAcademy(db, managerUserId, academyId);

  const rows = await db
    .select({
      membership: academyMemberships,
      userName: users.name,
      userEmail: users.email,
    })
    .from(academyMemberships)
    .innerJoin(users, eq(academyMemberships.userId, users.id))
    .where(
      and(
        eq(academyMemberships.academyId, academyId),
        eq(academyMemberships.status, "pending"),
      ),
    );

  return rows.map((r) => ({
    ...r.membership,
    userName: r.userName,
    userEmail: r.userEmail,
  }));
}

export async function approveMembership(
  db: Database,
  membershipId: string,
  managerUserId: string,
) {
  const m = await loadMembership(db, membershipId);
  if (!m) {
    throw new HttpError(404, "Membership not found");
  }
  await assertManagerOwnsAcademy(db, managerUserId, m.academyId);

  if (m.status !== "pending") {
    throw new HttpError(409, "Only pending memberships can be approved");
  }

  const targetActive = await getActiveMembership(db, m.userId);
  if (targetActive) {
    throw new HttpError(
      409,
      "User already has an active membership elsewhere",
    );
  }

  return db.transaction(async (tx) => {
    await tx
      .update(academyMemberships)
      .set({
        status: "rejected",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(academyMemberships.userId, m.userId),
          eq(academyMemberships.status, "pending"),
          ne(academyMemberships.id, membershipId),
        ),
      );

    const [updated] = await tx
      .update(academyMemberships)
      .set({
        status: "active",
        isActive: true,
        joinedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(academyMemberships.id, membershipId))
      .returning();

    if (!updated) {
      throw new HttpError(500, "Failed to approve membership");
    }
    return updated;
  });
}

export async function rejectMembership(
  db: Database,
  membershipId: string,
  managerUserId: string,
) {
  const m = await loadMembership(db, membershipId);
  if (!m) {
    throw new HttpError(404, "Membership not found");
  }
  await assertManagerOwnsAcademy(db, managerUserId, m.academyId);

  if (m.status !== "pending") {
    throw new HttpError(409, "Only pending memberships can be rejected");
  }

  const [updated] = await db
    .update(academyMemberships)
    .set({
      status: "rejected",
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(academyMemberships.id, membershipId))
    .returning();

  if (!updated) {
    throw new HttpError(500, "Failed to reject membership");
  }
  return updated;
}

export async function blockMembership(
  db: Database,
  membershipId: string,
  managerUserId: string,
) {
  const m = await loadMembership(db, membershipId);
  if (!m) {
    throw new HttpError(404, "Membership not found");
  }
  await assertManagerOwnsAcademy(db, managerUserId, m.academyId);

  if (m.status !== "pending" && m.status !== "active") {
    throw new HttpError(409, "Only pending or active memberships can be blocked");
  }

  const now = new Date();
  const [updated] = await db
    .update(academyMemberships)
    .set({
      status: "blocked",
      isActive: false,
      leftAt: m.isActive ? now : m.leftAt,
      updatedAt: now,
    })
    .where(eq(academyMemberships.id, membershipId))
    .returning();

  if (!updated) {
    throw new HttpError(500, "Failed to block membership");
  }
  return updated;
}

/** Removes blocked/rejected row so the user may send a new request (spec §3). */
export async function unblockMembership(
  db: Database,
  membershipId: string,
  managerUserId: string,
) {
  const m = await loadMembership(db, membershipId);
  if (!m) {
    throw new HttpError(404, "Membership not found");
  }
  await assertManagerOwnsAcademy(db, managerUserId, m.academyId);

  if (m.status !== "blocked" && m.status !== "rejected") {
    throw new HttpError(409, "Only blocked or rejected memberships can be unblocked");
  }

  await db
    .delete(academyMemberships)
    .where(eq(academyMemberships.id, membershipId));
}

export async function leaveActiveMembership(db: Database, userId: string) {
  const active = await getActiveMembership(db, userId);
  if (!active) {
    throw new HttpError(404, "No active membership to leave");
  }

  const academy = await db
    .select({ ownerId: academies.ownerId })
    .from(academies)
    .where(eq(academies.id, active.academyId))
    .limit(1)
    .then((r) => r[0]);

  if (academy?.ownerId === userId) {
    throw new HttpError(
      403,
      "Academy owners cannot leave their own academy in MVP",
    );
  }

  const [updated] = await db
    .update(academyMemberships)
    .set({
      isActive: false,
      leftAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(academyMemberships.id, active.id))
    .returning();

  if (!updated) {
    throw new HttpError(500, "Failed to leave membership");
  }
  return updated;
}
