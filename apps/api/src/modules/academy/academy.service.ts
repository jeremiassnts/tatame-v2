import { eq, ilike } from "drizzle-orm";
import {
  academies,
  academyMemberships,
  type Database,
} from "@tatame/db";
import type { CreateAcademyBody, UpdateAcademyBody } from "@tatame/validators";
import { HttpError } from "../../lib/http-error.js";

export async function createAcademyWithManagerMembership(
  db: Database,
  ownerUserId: string,
  body: CreateAcademyBody,
) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(academies)
      .values({
        ownerId: ownerUserId,
        name: body.name,
        logoUrl: body.logoUrl ?? null,
        address: body.address ?? null,
        contactEmail: body.contactEmail ?? null,
        contactPhone: body.contactPhone ?? null,
        foundedAt: body.foundedAt ?? null,
      })
      .returning();

    if (!created) {
      throw new HttpError(500, "Failed to create academy");
    }

    await tx.insert(academyMemberships).values({
      academyId: created.id,
      userId: ownerUserId,
      role: "manager",
      status: "active",
      isActive: true,
      joinedAt: new Date(),
      leftAt: null,
    });

    return created;
  });
}

export async function getAcademyById(db: Database, academyId: string) {
  const [row] = await db
    .select()
    .from(academies)
    .where(eq(academies.id, academyId))
    .limit(1);
  return row ?? null;
}

export async function searchAcademiesByName(db: Database, q: string, limit = 50) {
  const term = q.trim();
  if (!term) return [];
  return db
    .select()
    .from(academies)
    .where(ilike(academies.name, `%${term}%`))
    .limit(limit);
}

export async function assertManagerOwnsAcademy(
  db: Database,
  managerUserId: string,
  academyId: string,
): Promise<void> {
  const academy = await getAcademyById(db, academyId);
  if (!academy) {
    throw new HttpError(404, "Academy not found");
  }
  if (academy.ownerId !== managerUserId) {
    throw new HttpError(403, "You do not manage this academy");
  }
}

export async function updateAcademy(
  db: Database,
  academyId: string,
  ownerUserId: string,
  body: UpdateAcademyBody,
) {
  await assertManagerOwnsAcademy(db, ownerUserId, academyId);
  const [updated] = await db
    .update(academies)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.contactEmail !== undefined ? { contactEmail: body.contactEmail } : {}),
      ...(body.contactPhone !== undefined ? { contactPhone: body.contactPhone } : {}),
      ...(body.foundedAt !== undefined ? { foundedAt: body.foundedAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(academies.id, academyId))
    .returning();
  if (!updated) {
    throw new HttpError(404, "Academy not found");
  }
  return updated;
}
