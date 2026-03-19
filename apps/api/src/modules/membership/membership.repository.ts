import type { InferSelectModel } from "drizzle-orm";
import type { academyMemberships } from "@tatame/db";

export type MembershipRow = InferSelectModel<typeof academyMemberships>;

export type PendingMembershipWithUser = MembershipRow & {
  userName: string;
  userEmail: string;
};

export interface IMembershipRepository {
  findById(membershipId: string): Promise<MembershipRow | undefined>;
  findActiveByUser(userId: string): Promise<MembershipRow | undefined>;
  findActiveByUserAndAcademy(
    userId: string,
    academyId: string,
  ): Promise<MembershipRow | undefined>;

  existsBlockedOrRejected(userId: string, academyId: string): Promise<boolean>;
  existsPending(userId: string, academyId: string): Promise<boolean>;

  findPendingByAcademy(academyId: string): Promise<PendingMembershipWithUser[]>;

  create(data: {
    academyId: string;
    userId: string;
    role: string;
    status: string;
    isActive: boolean;
    joinedAt?: Date | null;
    leftAt?: Date | null;
  }): Promise<MembershipRow>;

  updateStatus(
    membershipId: string,
    data: {
      status?: string;
      isActive?: boolean;
      joinedAt?: Date | null;
      leftAt?: Date | null;
    },
  ): Promise<MembershipRow | undefined>;

  rejectAllPendingExcept(userId: string, excludeMembershipId: string): Promise<void>;

  deleteById(membershipId: string): Promise<void>;

  withTransaction<T>(fn: (txRepo: IMembershipRepository) => Promise<T>): Promise<T>;
}
