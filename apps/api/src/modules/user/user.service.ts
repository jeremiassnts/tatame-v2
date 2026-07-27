import type { Role } from "@tatame/types";
import type { IUserRepository } from "./user.repository.js";

export class UserService {
  constructor(private readonly userRepo: IUserRepository) {}

  async upsertFromClerk(data: {
    clerkUserId: string;
    email: string;
    name: string;
    profileImageUrl: string | null;
  }): Promise<void> {
    await this.userRepo.upsert(data);
  }

  async getByClerkId(clerkUserId: string) {
    return (await this.userRepo.findByClerkId(clerkUserId)) ?? null;
  }

  async getActiveRole(userId: string): Promise<Role | null> {
    const role = await this.userRepo.findActiveRole(userId);
    return (role as Role) ?? null;
  }

  async assignInitialRole(userId: string, role: Role): Promise<boolean> {
    const exists = await this.userRepo.hasActiveRole(userId);
    if (exists) return false;

    await this.userRepo.insertRole({
      userId,
      role,
      isActive: true,
      startedAt: new Date(),
      endedAt: null,
    });
    return true;
  }

  /**
   * Reconcile a user's active role to "manager" when they pay for Pro.
   *
   * Paying for Pro is a clear declaration of manager intent, so:
   * - no active role      → assign manager
   * - already manager     → nothing (unchanged)
   * - orphan non-manager  → promote to manager (e.g. picked "student" in the
   *                         app by mistake but never joined an academy)
   * - real member         → leave untouched (they belong to an academy); we
   *                         return "skipped-member" so the caller can flag it.
   */
  async ensureManagerRole(
    userId: string,
  ): Promise<"assigned" | "unchanged" | "promoted" | "skipped-member"> {
    const active = await this.userRepo.findActiveRole(userId);

    if (active === "manager") return "unchanged";

    if (!active) {
      await this.userRepo.insertRole({
        userId,
        role: "manager",
        isActive: true,
        startedAt: new Date(),
        endedAt: null,
      });
      return "assigned";
    }

    const isRealMember =
      await this.userRepo.hasActiveOrPendingMembership(userId);
    if (isRealMember) return "skipped-member";

    await this.userRepo.updateActiveRole(userId, "manager");
    return "promoted";
  }

  async getActiveAcademyForManager(userId: string) {
    return (await this.userRepo.findActiveAcademyForManager(userId)) ?? null;
  }

  async updateProfile(
    userId: string,
    data: {
      name?: string;
      phone?: string | null;
      instagram?: string | null;
      birthDate?: string | null;
    },
  ) {
    return (await this.userRepo.update(userId, data)) ?? null;
  }

  async hardDelete(userId: string): Promise<void> {
    await this.userRepo.hardDelete(userId);
  }
}
