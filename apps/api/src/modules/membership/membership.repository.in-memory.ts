import { randomUUID } from "node:crypto";
import type { InMemoryUserRepository } from "../user/user.repository.in-memory.js";
import type {
  ActiveOrPendingMembershipRow,
  IMembershipRepository,
  MemberDetailRow,
  MemberListItemRow,
  MembershipRow,
  PendingMembershipWithUser,
} from "./membership.repository.js";

export class InMemoryMembershipRepository implements IMembershipRepository {
  constructor(
    private readonly rows: MembershipRow[] = [],
    private readonly users: InMemoryUserRepository | null = null,
  ) {}

  async findById(membershipId: string): Promise<MembershipRow | undefined> {
    return this.rows.find((r) => r.id === membershipId);
  }

  async findActiveByUser(userId: string): Promise<MembershipRow | undefined> {
    return this.rows.find((r) => r.userId === userId && r.isActive);
  }

  async findActiveByUserAndAcademy(
    userId: string,
    academyId: string,
  ): Promise<MembershipRow | undefined> {
    return this.rows.find(
      (r) =>
        r.userId === userId &&
        r.academyId === academyId &&
        r.isActive &&
        r.status === "active",
    );
  }

  async existsBlockedOrRejected(
    userId: string,
    academyId: string,
  ): Promise<boolean> {
    return this.rows.some(
      (r) =>
        r.userId === userId &&
        r.academyId === academyId &&
        (r.status === "blocked" || r.status === "rejected"),
    );
  }

  async existsPending(userId: string, academyId: string): Promise<boolean> {
    return this.rows.some(
      (r) =>
        r.userId === userId &&
        r.academyId === academyId &&
        r.status === "pending",
    );
  }

  async findPendingByAcademy(
    academyId: string,
  ): Promise<PendingMembershipWithUser[]> {
    const pending = this.rows.filter(
      (r) => r.academyId === academyId && r.status === "pending",
    );
    return pending.map((m) => {
      const u = this.users?.getById(m.userId);
      return {
        ...m,
        userName: u?.name ?? "Unknown user",
        userEmail: u?.email ?? "unknown@example.com",
      };
    });
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
    const t = new Date();
    const row: MembershipRow = {
      id: randomUUID(),
      academyId: data.academyId,
      userId: data.userId,
      role: data.role as MembershipRow["role"],
      status: data.status as MembershipRow["status"],
      isActive: data.isActive,
      joinedAt: data.joinedAt ?? null,
      leftAt: data.leftAt ?? null,
      createdAt: t,
      updatedAt: t,
    };
    this.rows.push(row);
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
    const row = this.rows.find((r) => r.id === membershipId);
    if (!row) return undefined;
    if (data.status !== undefined) {
      row.status = data.status as MembershipRow["status"];
    }
    if (data.isActive !== undefined) row.isActive = data.isActive;
    if (data.joinedAt !== undefined) row.joinedAt = data.joinedAt;
    if (data.leftAt !== undefined) row.leftAt = data.leftAt;
    row.updatedAt = new Date();
    return row;
  }

  async rejectAllPendingExcept(
    userId: string,
    excludeMembershipId: string,
  ): Promise<void> {
    const t = new Date();
    for (const r of this.rows) {
      if (
        r.userId === userId &&
        r.status === "pending" &&
        r.id !== excludeMembershipId
      ) {
        r.status = "rejected";
        r.updatedAt = t;
      }
    }
  }

  async findByAcademy(
    academyId: string,
    filters: { role?: string; status?: string; q?: string },
  ): Promise<MemberListItemRow[]> {
    let results = this.rows.filter((r) => r.academyId === academyId);
    if (filters.role) results = results.filter((r) => r.role === filters.role);
    if (filters.status)
      results = results.filter((r) => r.status === filters.status);
    return results.map((r) => ({
      id: r.id,
      userId: r.userId,
      role: r.role,
      status: r.status,
      joinedAt: r.joinedAt,
      createdAt: r.createdAt,
      userName: "",
      userEmail: "",
      userProfileImageUrl: null,
      currentBelt: null,
      currentStripes: null,
    }));
  }

  async findDetailById(
    membershipId: string,
  ): Promise<MemberDetailRow | null> {
    const row = this.rows.find((r) => r.id === membershipId);
    if (!row) return null;
    const history = this.rows
      .filter((r) => r.userId === row.userId && r.academyId === row.academyId)
      .map((r) => ({
        id: r.id,
        role: r.role,
        status: r.status,
        joinedAt: r.joinedAt,
        leftAt: r.leftAt,
        createdAt: r.createdAt,
      }));
    return {
      id: row.id,
      userId: row.userId,
      academyId: row.academyId,
      role: row.role,
      status: row.status,
      joinedAt: row.joinedAt,
      createdAt: row.createdAt,
      userName: "",
      userEmail: "",
      userPhone: null,
      userInstagram: null,
      userBirthDate: null,
      userProfileImageUrl: null,
      history,
    };
  }

  async findActiveOrPendingByUser(
    userId: string,
  ): Promise<ActiveOrPendingMembershipRow | null> {
    const row = this.rows.find(
      (r) =>
        r.userId === userId &&
        (r.status === "pending" || r.status === "active"),
    );
    if (!row) return null;
    return {
      id: row.id,
      academyId: row.academyId,
      academyName: "",
      academyLogoUrl: null,
      role: row.role,
      status: row.status,
      joinedAt: row.joinedAt,
    };
  }

  async deleteById(membershipId: string): Promise<void> {
    const i = this.rows.findIndex((r) => r.id === membershipId);
    if (i >= 0) this.rows.splice(i, 1);
  }

  async findManagerClerkIdsByAcademy(_academyId: string): Promise<string[]> {
    return [];
  }

  async findActiveStudentClerkIdsByAcademy(_academyId: string): Promise<string[]> {
    return [];
  }

  async findActiveInstructorClerkIdsByAcademy(_academyId: string): Promise<string[]> {
    return [];
  }

  async findAllActiveClerkIdsByAcademy(_academyId: string): Promise<string[]> {
    return [];
  }

  async withTransaction<T>(
    fn: (txRepo: IMembershipRepository) => Promise<T>,
  ): Promise<T> {
    return fn(this);
  }
}
