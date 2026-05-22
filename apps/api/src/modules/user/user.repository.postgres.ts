import {
  academies,
  academyMemberships,
  announcements,
  beltPromotions,
  classes,
  customNotificationSends,
  userRoles,
  users,
  type Database,
} from "@tatame/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { IUserRepository, UserRow } from "./user.repository.js";

export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly db: Database) { }

  async upsert(data: {
    clerkUserId: string;
    email: string;
    name: string;
    profileImageUrl: string | null;
  }): Promise<void> {
    await this.db
      .insert(users)
      .values({
        clerkUserId: data.clerkUserId,
        email: data.email,
        name: data.name,
        profileImageUrl: data.profileImageUrl,
      })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: {
          email: data.email,
          name: data.name,
          profileImageUrl: data.profileImageUrl,
          updatedAt: new Date(),
        },
      });
  }

  async findById(userId: string): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    return row;
  }

  async findByClerkId(clerkUserId: string): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.clerkUserId, clerkUserId), isNull(users.deletedAt)))
      .limit(1);
    return row;
  }

  async update(
    id: string,
    data: {
      name?: string;
      phone?: string | null;
      instagram?: string | null;
      birthDate?: string | null;
    },
  ): Promise<UserRow | undefined> {
    const [row] = await this.db
      .update(users)
      .set(data)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();
    return row;
  }

  async hardDelete(id: string): Promise<void> {
    // Clean up tables with "restrict" FK before deleting the user.
    // Tables with "cascade" FK are handled automatically by Postgres.
    await this.db.delete(announcements).where(eq(announcements.authorId, id));
    await this.db.delete(customNotificationSends).where(eq(customNotificationSends.senderId, id));
    await this.db.delete(beltPromotions).where(eq(beltPromotions.promotedBy, id));
    await this.db.delete(classes).where(eq(classes.instructorId, id));
    // If user owns an academy, delete it (cascades members, classes, plans, etc.)
    await this.db.delete(academies).where(eq(academies.ownerId, id));
    // Finally delete the user row — remaining cascades clean up the rest
    await this.db.delete(users).where(eq(users.id, id));
  }

  async findActiveRole(userId: string): Promise<string | undefined> {
    const [row] = await this.db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(
        and(eq(userRoles.userId, userId), eq(userRoles.isActive, true)),
      )
      .limit(1);
    return row?.role;
  }

  async hasActiveRole(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(
        and(eq(userRoles.userId, userId), eq(userRoles.isActive, true)),
      )
      .limit(1);
    return !!row;
  }

  async insertRole(data: {
    userId: string;
    role: string;
    isActive: boolean;
    startedAt: Date;
    endedAt: Date | null;
  }): Promise<void> {
    await this.db.insert(userRoles).values({
      userId: data.userId,
      role: data.role as "manager" | "instructor" | "student",
      isActive: data.isActive,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
    });
  }

  async findClerkIdByInternalId(userId: string): Promise<string | undefined> {
    const [row] = await this.db
      .select({ clerkUserId: users.clerkUserId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.clerkUserId;
  }

  async findClerkIdsByInternalIds(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: users.id, clerkUserId: users.clerkUserId })
      .from(users)
      .where(inArray(users.id, userIds));
    return new Map(rows.map((r) => [r.id, r.clerkUserId]));
  }
  async updatePendingStripe(
    id: string,
    data: {
      pendingStripeCustomerId: string | null;
      pendingStripeSubscriptionId: string | null;
    },
  ): Promise<void> {
    await this.db
      .update(users)
      .set({
        pendingStripeCustomerId: data.pendingStripeCustomerId,
        pendingStripeSubscriptionId: data.pendingStripeSubscriptionId,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
  }

  async clearPendingStripe(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        pendingStripeCustomerId: null,
        pendingStripeSubscriptionId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
  }

  async findActiveAcademyForManager(userId: string): Promise<{
    id: string;
    name: string;
    logoUrl: string | null;
  } | undefined> {
    const [row] = await this.db
      .select({
        id: academies.id,
        name: academies.name,
        logoUrl: academies.logoUrl,
      })
      .from(academyMemberships)
      .innerJoin(academies, eq(academies.id, academyMemberships.academyId))
      .where(
        and(
          eq(academyMemberships.userId, userId),
          eq(academyMemberships.role, "manager"),
          eq(academyMemberships.status, "active"),
          eq(academyMemberships.isActive, true),
        ),
      )
      .limit(1);
    return row ?? undefined;
  }
}
