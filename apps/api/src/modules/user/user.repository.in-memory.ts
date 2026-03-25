import { randomUUID } from "node:crypto";
import type { InferSelectModel } from "drizzle-orm";
import type { userRoles } from "@tatame/db";
import type { IUserRepository, UserRow } from "./user.repository.js";

type UserRoleRow = InferSelectModel<typeof userRoles>;

export class InMemoryUserRepository implements IUserRepository {
  private readonly users: UserRow[] = [];
  private readonly roles: UserRoleRow[] = [];

  /** For membership / other in-memory repos that need name + email by id. */
  getById(userId: string): UserRow | undefined {
    return this.users.find((u) => u.id === userId);
  }

  async upsert(data: {
    clerkUserId: string;
    email: string;
    name: string;
    profileImageUrl: string | null;
  }): Promise<void> {
    const t = new Date();
    const existing = this.users.find((u) => u.clerkUserId === data.clerkUserId);
    if (existing) {
      existing.email = data.email;
      existing.name = data.name;
      existing.profileImageUrl = data.profileImageUrl;
      existing.updatedAt = t;
      return;
    }
    this.users.push({
      id: randomUUID(),
      clerkUserId: data.clerkUserId,
      email: data.email,
      name: data.name,
      profileImageUrl: data.profileImageUrl,
      phone: null,
      instagram: null,
      birthDate: null,
      createdAt: t,
      updatedAt: t,
    });
  }

  async findByClerkId(clerkUserId: string): Promise<UserRow | undefined> {
    return this.users.find((u) => u.clerkUserId === clerkUserId);
  }

  async findActiveRole(userId: string): Promise<string | undefined> {
    const row = this.roles.find((r) => r.userId === userId && r.isActive);
    return row?.role;
  }

  async hasActiveRole(userId: string): Promise<boolean> {
    return this.roles.some((r) => r.userId === userId && r.isActive);
  }

  async insertRole(data: {
    userId: string;
    role: string;
    isActive: boolean;
    startedAt: Date;
    endedAt: Date | null;
  }): Promise<void> {
    this.roles.push({
      id: randomUUID(),
      userId: data.userId,
      role: data.role as UserRoleRow["role"],
      isActive: data.isActive,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
    });
  }

  async findActiveAcademyForManager(_userId: string): Promise<undefined> {
    return undefined;
  }
}
