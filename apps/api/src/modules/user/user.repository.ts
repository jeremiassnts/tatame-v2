import type { InferSelectModel } from "drizzle-orm";
import type { users } from "@tatame/db";

export type UserRow = InferSelectModel<typeof users>;

export interface IUserRepository {
  upsert(data: {
    clerkUserId: string;
    email: string;
    name: string;
    profileImageUrl: string | null;
  }): Promise<void>;

  deleteByClerkId(clerkUserId: string): Promise<void>;

  findByClerkId(clerkUserId: string): Promise<UserRow | undefined>;

  findActiveRole(userId: string): Promise<string | undefined>;

  hasActiveRole(userId: string): Promise<boolean>;

  insertRole(data: {
    userId: string;
    role: string;
    isActive: boolean;
    startedAt: Date;
    endedAt: Date | null;
  }): Promise<void>;

  findActiveAcademyForManager(userId: string): Promise<{
    id: string;
    name: string;
    logoUrl: string | null;
  } | undefined>;
}
