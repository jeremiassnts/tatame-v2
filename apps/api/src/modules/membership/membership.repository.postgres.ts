import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  academies,
  academyMemberships,
  beltPromotions,
  users,
  type Database,
} from "@tatame/db";
import type {
  ActiveOrPendingMembershipRow,
  IMembershipRepository,
  MemberDetailRow,
  MemberListItemRow,
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
        role: data.role as "manager" | "instructor" | "student" | "guardian",
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

  async findByAcademy(
    academyId: string,
    filters: { role?: string; status?: string; q?: string },
  ): Promise<MemberListItemRow[]> {
    const conditions: ReturnType<typeof eq>[] = [
      eq(academyMemberships.academyId, academyId),
    ];

    if (filters.role) {
      conditions.push(
        eq(academyMemberships.role, filters.role as "instructor" | "student" | "guardian"),
      );
    }
    if (filters.status) {
      conditions.push(
        eq(
          academyMemberships.status,
          filters.status as "pending" | "active" | "blocked",
        ),
      );
    }

    const beltRank = sql<number>`case
      when ${beltPromotions.belt} = 'black' then 5
      when ${beltPromotions.belt} = 'brown' then 4
      when ${beltPromotions.belt} = 'purple' then 3
      when ${beltPromotions.belt} = 'blue' then 2
      when ${beltPromotions.belt} = 'white' then 1
      else 0
    end`;

    const rows = await this.db
      .select({
        id: academyMemberships.id,
        userId: academyMemberships.userId,
        role: academyMemberships.role,
        status: academyMemberships.status,
        joinedAt: academyMemberships.joinedAt,
        createdAt: academyMemberships.createdAt,
        userName: users.name,
        userEmail: users.email,
        userProfileImageUrl: users.profileImageUrl,
        currentBelt: beltPromotions.belt,
        currentStripes: beltPromotions.stripes,
      })
      .from(academyMemberships)
      .innerJoin(users, eq(academyMemberships.userId, users.id))
      .leftJoin(
        beltPromotions,
        and(
          eq(beltPromotions.userId, academyMemberships.userId),
          eq(beltPromotions.academyId, academyMemberships.academyId),
          eq(beltPromotions.isCurrent, true),
        ),
      )
      .where(and(...conditions))
      .orderBy(desc(beltRank), desc(beltPromotions.stripes), asc(users.name));

    if (filters.q) {
      const lower = filters.q.toLowerCase();
      return rows.filter(
        (r) =>
          r.userName.toLowerCase().includes(lower) ||
          r.userEmail.toLowerCase().includes(lower),
      );
    }

    return rows;
  }

  async findDetailById(membershipId: string): Promise<MemberDetailRow | null> {
    const [row] = await this.db
      .select({
        id: academyMemberships.id,
        userId: academyMemberships.userId,
        academyId: academyMemberships.academyId,
        role: academyMemberships.role,
        status: academyMemberships.status,
        joinedAt: academyMemberships.joinedAt,
        createdAt: academyMemberships.createdAt,
        userName: users.name,
        userEmail: users.email,
        userPhone: users.phone,
        userInstagram: users.instagram,
        userBirthDate: users.birthDate,
        userProfileImageUrl: users.profileImageUrl,
      })
      .from(academyMemberships)
      .innerJoin(users, eq(academyMemberships.userId, users.id))
      .where(eq(academyMemberships.id, membershipId))
      .limit(1);

    if (!row) return null;

    const history = await this.db
      .select({
        id: academyMemberships.id,
        role: academyMemberships.role,
        status: academyMemberships.status,
        joinedAt: academyMemberships.joinedAt,
        leftAt: academyMemberships.leftAt,
        createdAt: academyMemberships.createdAt,
      })
      .from(academyMemberships)
      .where(
        and(
          eq(academyMemberships.userId, row.userId),
          eq(academyMemberships.academyId, row.academyId),
        ),
      )
      .orderBy(desc(academyMemberships.createdAt));

    return {
      id: row.id,
      userId: row.userId,
      academyId: row.academyId,
      role: row.role,
      status: row.status,
      joinedAt: row.joinedAt,
      createdAt: row.createdAt,
      userName: row.userName,
      userEmail: row.userEmail,
      userPhone: row.userPhone,
      userInstagram: row.userInstagram,
      userBirthDate: row.userBirthDate,
      userProfileImageUrl: row.userProfileImageUrl,
      history,
    };
  }

  async findActiveOrPendingByUser(
    userId: string,
  ): Promise<ActiveOrPendingMembershipRow | null> {
    const [row] = await this.db
      .select({
        id: academyMemberships.id,
        academyId: academyMemberships.academyId,
        academyName: academies.name,
        academyLogoUrl: academies.logoUrl,
        role: academyMemberships.role,
        status: academyMemberships.status,
        joinedAt: academyMemberships.joinedAt,
      })
      .from(academyMemberships)
      .innerJoin(academies, eq(academyMemberships.academyId, academies.id))
      .where(
        and(
          eq(academyMemberships.userId, userId),
          inArray(academyMemberships.status, ["pending", "active"]),
        ),
      )
      .orderBy(desc(academyMemberships.createdAt))
      .limit(1);

    return row ?? null;
  }

  async deleteById(membershipId: string): Promise<void> {
    await this.db
      .delete(academyMemberships)
      .where(eq(academyMemberships.id, membershipId));
  }

  async findManagerClerkIdsByAcademy(academyId: string): Promise<string[]> {
    const rows = await this.db
      .select({ clerkUserId: users.clerkUserId })
      .from(academyMemberships)
      .innerJoin(users, eq(users.id, academyMemberships.userId))
      .where(
        and(
          eq(academyMemberships.academyId, academyId),
          eq(academyMemberships.role, "manager"),
          eq(academyMemberships.isActive, true),
        ),
      );
    return rows.map((r) => r.clerkUserId);
  }

  async findActiveStudentClerkIdsByAcademy(academyId: string): Promise<string[]> {
    const rows = await this.db
      .select({ clerkUserId: users.clerkUserId })
      .from(academyMemberships)
      .innerJoin(users, eq(users.id, academyMemberships.userId))
      .where(
        and(
          eq(academyMemberships.academyId, academyId),
          eq(academyMemberships.role, "student"),
          eq(academyMemberships.isActive, true),
        ),
      );
    return rows.map((r) => r.clerkUserId);
  }

  async findActiveInstructorClerkIdsByAcademy(academyId: string): Promise<string[]> {
    const rows = await this.db
      .select({ clerkUserId: users.clerkUserId })
      .from(academyMemberships)
      .innerJoin(users, eq(users.id, academyMemberships.userId))
      .where(
        and(
          eq(academyMemberships.academyId, academyId),
          eq(academyMemberships.role, "instructor"),
          eq(academyMemberships.status, "active"),
          eq(academyMemberships.isActive, true),
        ),
      );
    return rows.map((r) => r.clerkUserId);
  }

  async findAllActiveClerkIdsByAcademy(academyId: string): Promise<string[]> {
    const rows = await this.db
      .select({ clerkUserId: users.clerkUserId })
      .from(academyMemberships)
      .innerJoin(users, eq(users.id, academyMemberships.userId))
      .where(
        and(
          eq(academyMemberships.academyId, academyId),
          eq(academyMemberships.status, "active"),
          eq(academyMemberships.isActive, true),
        ),
      );
    return rows.map((r) => r.clerkUserId);
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
