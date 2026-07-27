import type { users } from "@tatame/db";
import type { InferSelectModel } from "drizzle-orm";

export type UserRow = InferSelectModel<typeof users>;

export interface IUserRepository {
  upsert(data: {
    clerkUserId: string;
    email: string;
    name: string;
    profileImageUrl: string | null;
  }): Promise<void>;

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

  hardDelete(id: string): Promise<void>;

  findActiveRole(userId: string): Promise<string | undefined>;

  hasActiveRole(userId: string): Promise<boolean>;

  /** True if the user has any academy membership with status active or pending. */
  hasActiveOrPendingMembership(userId: string): Promise<boolean>;

  insertRole(data: {
    userId: string;
    role: string;
    isActive: boolean;
    startedAt: Date;
    endedAt: Date | null;
  }): Promise<void>;

  /** Change the role of the user's currently-active user_roles row in place. */
  updateActiveRole(userId: string, role: string): Promise<void>;

  findActiveAcademyForManager(userId: string): Promise<{
    id: string;
    name: string;
    logoUrl: string | null;
  } | undefined>;

  findClerkIdByInternalId(userId: string): Promise<string | undefined>;
  findClerkIdsByInternalIds(userIds: string[]): Promise<Map<string, string>>;
  updatePendingStripe(
    id: string,
    data: {
      pendingStripeCustomerId: string | null;
      pendingStripeSubscriptionId: string | null;
    },
  ): Promise<void>;

  clearPendingStripe(id: string): Promise<void>;
}
