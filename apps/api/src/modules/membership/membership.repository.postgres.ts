import { and, eq, inArray, ne } from "drizzle-orm";
import { academyMemberships, users, type Database } from "@tatame/db";
import type {
  IMembershipRepository,
  MembershipRow,
  PendingMembershipWithUser,
} from "./membership.repository.js";

export class PostgresMembershipRepository implements IMembershipRepository {
  constructor(private readonly db: Database) {}

  async findById(membershipId: string): Promise<MembershipRow | undefined> {
    const [row] = await this.db
      .select()
      .from(academyMemberships)
      .where(eq(academyMemberships.id, membershipId))
      .limit(1);
    return row;
  }

  async findActiveByUser(userId: string): Promise<MembershipRow | undefined> {
    const [row] = await this.db
      .select()
      .from(academyMemberships)
      .where(
        and(
          eq(academyMemberships.userId, userId),
          eq(academyMemberships.isActive, true),
        ),
      )
      .limit(1);
    return row;
  }

  async findActiveByUserAndAcademy(
    userId: string,
    academyId: string,
  ): Promise<MembershipRow | undefined> {
    const [row] = await this.db
      .select()
      .from(academyMemberships)
      .where(
        and(
          eq(academyMemberships.userId, userId),
          eq(academyMemberships.academyId, academyId),
          eq(academyMemberships.isActive, true),
          eq(academyMemberships.status, "active"),
        ),
      )
      .limit(1);
    return row;
  }

  async existsBlockedOrRejected(
    userId: string,
    academyId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: academyMemberships.id })
      .from(academyMemberships)
      .where(
        and(
          eq(academyMemberships.userId, userId),
          eq(academyMemberships.academyId, academyId),
          inArray(academyMemberships.status, ["blocked", "rejected"]),
        ),
      )
      .limit(1);
    return !!row;
  }

  async existsPending(userId: string, academyId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: academyMemberships.id })
      .from(academyMemberships)
      .where(
        and(
          eq(academyMemberships.userId, userId),
          eq(academyMemberships.academyId, academyId),
          eq(academyMemberships.status, "pending"),
        ),
      )
      .limit(1);
    return !!row;
  }

  async findPendingByAcademy(
    academyId: string,
  ): Promise<PendingMembershipWithUser[]> {
    const rows = await this.db
      .select({
        membership: academyMemberships,
        userName: users.name,
        userEmail: users.email,
      })
      .from(academyMemberships)
      .innerJoin(users, eq(academyMemberships.userId, users.id))
      .where(
        and(
          eq(academyMemberships.academyId, academyId),
          eq(academyMemberships.status, "pending"),
        ),
      );

    return rows.map((r) => ({
      ...r.membership,
      userName: r.userName,
      userEmail: r.userEmail,
    }));
  }

  async create(data: {
    academyId: string;
    userId: string;
    role: string;
    status: string;
    isActive: boolean;
    joinedAt?: Date | null;
    leftAt?: Date | null;
  }): Promise<MembershipRow> {
    const [row] = await this.db
      .insert(academyMemberships)
      .values({
        academyId: data.academyId,
        userId: data.userId,
        role: data.role as "manager" | "instructor" | "student",
        status: data.status as "pending" | "active" | "rejected" | "blocked",
        isActive: data.isActive,
        joinedAt: data.joinedAt ?? null,
        leftAt: data.leftAt ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to create membership request");
    return row;
  }

  async updateStatus(
    membershipId: string,
    data: {
      status?: string;
      isActive?: boolean;
      joinedAt?: Date | null;
      leftAt?: Date | null;
    },
  ): Promise<MembershipRow | undefined> {
    const [row] = await this.db
      .update(academyMemberships)
      .set({
        ...(data.status !== undefined
          ? {
              status: data.status as
                | "pending"
                | "active"
                | "rejected"
                | "blocked",
            }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.joinedAt !== undefined ? { joinedAt: data.joinedAt } : {}),
        ...(data.leftAt !== undefined ? { leftAt: data.leftAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(academyMemberships.id, membershipId))
      .returning();
    return row;
  }

  async rejectAllPendingExcept(
    userId: string,
    excludeMembershipId: string,
  ): Promise<void> {
    await this.db
      .update(academyMemberships)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(
        and(
          eq(academyMemberships.userId, userId),
          eq(academyMemberships.status, "pending"),
          ne(academyMemberships.id, excludeMembershipId),
        ),
      );
  }

  async deleteById(membershipId: string): Promise<void> {
    await this.db
      .delete(academyMemberships)
      .where(eq(academyMemberships.id, membershipId));
  }

  async withTransaction<T>(
    fn: (txRepo: IMembershipRepository) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      const txRepo = new PostgresMembershipRepository(tx as unknown as Database);
      return fn(txRepo);
    });
  }
}
