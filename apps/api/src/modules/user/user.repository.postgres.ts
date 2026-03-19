import { and, eq } from "drizzle-orm";
import { users, userRoles, type Database } from "@tatame/db";
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

  async deleteByClerkId(clerkUserId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.clerkUserId, clerkUserId));
  }

  async findByClerkId(clerkUserId: string): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);
    return row;
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
}
