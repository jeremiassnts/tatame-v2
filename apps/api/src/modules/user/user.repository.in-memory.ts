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
      deletedAt: null,
    });
  }

  async findDeletedByEmail(email: string): Promise<UserRow | undefined> {
    return this.users.find((u) => u.email === email && u.deletedAt !== null);
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
    const user = this.users.find((u) => u.id === id);
    if (user) {
      user.clerkUserId = data.clerkUserId;
      user.email = data.email;
      user.name = data.name;
      user.profileImageUrl = data.profileImageUrl;
      user.deletedAt = null;
      user.updatedAt = new Date();
    }
  }

  async findById(userId: string): Promise<UserRow | undefined> {
    return this.users.find((u) => u.id === userId && !u.deletedAt);
  }

  async findByClerkId(clerkUserId: string): Promise<UserRow | undefined> {
    return this.users.find((u) => u.clerkUserId === clerkUserId && !u.deletedAt);
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
    const user = this.users.find((u) => u.id === id && !u.deletedAt);
    if (!user) return undefined;
    if (data.name !== undefined) user.name = data.name;
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.instagram !== undefined) user.instagram = data.instagram;
    if (data.birthDate !== undefined) user.birthDate = data.birthDate;
    user.updatedAt = new Date();
    return { ...user };
  }

  async softDelete(id: string): Promise<void> {
    const user = this.users.find((u) => u.id === id);
    if (user) user.deletedAt = new Date();
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
