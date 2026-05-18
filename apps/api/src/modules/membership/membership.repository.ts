import type { InferSelectModel } from "drizzle-orm";
import type { academyMemberships } from "@tatame/db";

export type MembershipRow = InferSelectModel<typeof academyMemberships>;

export type PendingMembershipWithUser = MembershipRow & {
  userName: string;
  userEmail: string;
};

export type MemberListItemRow = {
  id: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: Date | null;
  createdAt: Date;
  userName: string;
  userEmail: string;
  userProfileImageUrl: string | null;
  currentBelt: string | null;
  currentStripes: number | null;
};

export type MemberDetailRow = {
  id: string;
  userId: string;
  academyId: string;
  role: string;
  status: string;
  joinedAt: Date | null;
  createdAt: Date;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  userInstagram: string | null;
  userBirthDate: string | null;
  userProfileImageUrl: string | null;
  history: {
    id: string;
    role: string;
    status: string;
    joinedAt: Date | null;
    leftAt: Date | null;
    createdAt: Date;
  }[];
};

export type ActiveOrPendingMembershipRow = {
  id: string;
  academyId: string;
  academyName: string;
  academyLogoUrl: string | null;
  role: string;
  status: string;
  joinedAt: Date | null;
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

  findByAcademy(
    academyId: string,
    filters: { role?: string; status?: string; q?: string },
  ): Promise<MemberListItemRow[]>;

  findDetailById(membershipId: string): Promise<MemberDetailRow | null>;

  findActiveOrPendingByUser(userId: string): Promise<ActiveOrPendingMembershipRow | null>;

  withTransaction<T>(fn: (txRepo: IMembershipRepository) => Promise<T>): Promise<T>;

  findManagerClerkIdsByAcademy(academyId: string): Promise<string[]>;
  findActiveStudentClerkIdsByAcademy(academyId: string): Promise<string[]>;
  findActiveInstructorClerkIdsByAcademy(academyId: string): Promise<string[]>;
  findAllActiveClerkIdsByAcademy(academyId: string): Promise<string[]>;
}
