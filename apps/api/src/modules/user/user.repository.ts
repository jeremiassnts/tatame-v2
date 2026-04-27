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

  findDeletedByEmail(email: string): Promise<UserRow | undefined>;

  reactivate(
    id: string,
    data: {
      clerkUserId: string;
      email: string;
      name: string;
      profileImageUrl: string | null;
    },
  ): Promise<void>;

  findById(userId: string): Promise<UserRow | undefined>;

  findByClerkId(clerkUserId: string): Promise<UserRow | undefined>;

  update(
    id: string,
    data: {
      name?: string;
      phone?: string | null;
      instagram?: string | null;
      birthDate?: string | null;
    },
  ): Promise<UserRow | undefined>;

  softDelete(id: string): Promise<void>;

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

  updatePendingStripe(
    id: string,
    data: {
      pendingStripeCustomerId: string | null;
      pendingStripeSubscriptionId: string | null;
    },
  ): Promise<void>;

  clearPendingStripe(id: string): Promise<void>;
}
