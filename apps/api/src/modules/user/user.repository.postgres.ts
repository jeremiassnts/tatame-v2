import { and, eq, isNotNull, isNull } from "drizzle-orm";
import {
  academies,
  academyMemberships,
  users,
  userRoles,
  type Database,
} from "@tatame/db";
import type { IUserRepository, UserRow } from "./user.repository.js";

export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly db: Database) {}

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

  async findDeletedByEmail(email: string): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNotNull(users.deletedAt)))
      .limit(1);
    return row;
  }

  async reactivate(
    id: string,
    data: {
      clerkUserId: string;
      email: string;
      name: string;
      profileImageUrl: string | null;
    },
  ): Promise<void> {
    await this.db
      .update(users)
      .set({
        clerkUserId: data.clerkUserId,
        email: data.email,
        name: data.name,
        profileImageUrl: data.profileImageUrl,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
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

  async softDelete(id: string): Promise<void> {
    await this.db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));
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
