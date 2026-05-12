import { HttpError } from "../../lib/http-error.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.js";
import { FREE_PLAN_LIMITS } from "../manager-subscription/plan-limits.js";
import type { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import type { IMembershipRepository } from "./membership.repository.js";

export class MembershipService {
  constructor(
    private readonly membershipRepo: IMembershipRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly dispatcher?: NotificationDispatcher,
    private readonly managerSubRepo?: IManagerSubscriptionRepository,
  ) {}

  async getActive(userId: string) {
    return (await this.membershipRepo.findActiveByUser(userId)) ?? null;
  }

  async request(
    userId: string,
    role: "instructor" | "student",
    academyId: string,
  ) {
    const academy = await this.academyRepo.findById(academyId);
    if (!academy) {
      throw new HttpError(404, "Academy not found");
    }

    const active = await this.membershipRepo.findActiveByUser(userId);
    if (active) {
      throw new HttpError(
        409,
        "You already have an active academy membership; leave before joining another",
      );
    }

    const blocked = await this.membershipRepo.existsBlockedOrRejected(
      userId,
      academyId,
    );
    if (blocked) {
      throw new HttpError(
        403,
        "Cannot request again for this academy until a manager unblocks you",
      );
    }

    const pending = await this.membershipRepo.existsPending(userId, academyId);
    if (pending) {
      throw new HttpError(409, "You already have a pending request for this academy");
    }

    const autoApproveAcademyId = process.env.AUTO_APPROVE_ACADEMY_ID;
    const shouldAutoApprove = autoApproveAcademyId === academyId;

    const result = await this.membershipRepo.create({
      academyId,
      userId,
      role,
      status: shouldAutoApprove ? "active" : "pending",
      isActive: shouldAutoApprove,
      joinedAt: shouldAutoApprove ? new Date() : null,
      leftAt: null,
    });

    // Notify managers about the new request
    if (!shouldAutoApprove && this.dispatcher) {
      const detail = await this.membershipRepo.findDetailById(result.id);
      this.dispatcher.notifyAcademyManagers(
        "membership_request",
        academyId,
        [detail?.userName ?? "Novo membro", role],
      );
    }

    return result;
  }

  async listMembers(
    academyId: string,
    requesterUserId: string,
    requesterRole: "manager" | "instructor" | "student",
    filters: { role?: string; status?: string; q?: string },
  ) {
    if (requesterRole === "manager") {
      await this.assertManagerOwnsAcademy(requesterUserId, academyId);
      return this.membershipRepo.findByAcademy(academyId, filters);
    }

    await this.assertActiveMemberInAcademy(requesterUserId, academyId);
    return this.membershipRepo.findByAcademy(academyId, {
      ...filters,
      status: "active",
    });
  }

  async getMemberDetail(
    membershipId: string,
    requesterUserId: string,
    requesterRole: "manager" | "instructor",
  ) {
    const m = await this.membershipRepo.findById(membershipId);
    if (!m) {
      throw new HttpError(404, "Membership not found");
    }

    if (requesterRole === "manager") {
      await this.assertManagerOwnsAcademy(requesterUserId, m.academyId);
    } else {
      await this.assertActiveMemberInAcademy(requesterUserId, m.academyId);
      if (m.status !== "active") {
        throw new HttpError(403, "Forbidden");
      }
    }

    const detail = await this.membershipRepo.findDetailById(membershipId);
    if (!detail) {
      throw new HttpError(404, "Membership not found");
    }
    return detail;
  }

  async listPending(academyId: string, managerUserId: string) {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);
    return this.membershipRepo.findPendingByAcademy(academyId);
  }

  async approve(membershipId: string, managerUserId: string) {
    const m = await this.membershipRepo.findById(membershipId);
    if (!m) {
      throw new HttpError(404, "Membership not found");
    }
    await this.assertManagerOwnsAcademy(managerUserId, m.academyId);

    if (m.status !== "pending") {
      throw new HttpError(409, "Only pending memberships can be approved");
    }

    // Plan limit enforcement
    if (this.managerSubRepo) {
      const sub = await this.managerSubRepo.findByAcademyId(m.academyId);
      if (sub?.plan === "free") {
        if (m.role === "student") {
          const members = await this.membershipRepo.findByAcademy(m.academyId, {
            role: "student",
            status: "active",
          });
          if (members.length >= FREE_PLAN_LIMITS.maxStudents) {
            throw new HttpError(403, "Limite de alunos atingido para o plano atual", {
              code: "PLAN_LIMIT_STUDENTS",
            });
          }
        } else if (m.role === "instructor") {
          const instructors = await this.membershipRepo.findByAcademy(m.academyId, {
            role: "instructor",
            status: "active",
          });
          if (instructors.length >= FREE_PLAN_LIMITS.maxInstructors) {
            throw new HttpError(403, "Limite de instrutores atingido para o plano atual", {
              code: "PLAN_LIMIT_INSTRUCTORS",
            });
          }
        }
      }
    }

    const targetActive = await this.membershipRepo.findActiveByUser(m.userId);
    if (targetActive) {
      throw new HttpError(
        409,
        "User already has an active membership elsewhere",
      );
    }

    const result = await this.membershipRepo.withTransaction(async (txRepo) => {
      await txRepo.rejectAllPendingExcept(m.userId, membershipId);
      const updated = await txRepo.updateStatus(membershipId, {
        status: "active",
        isActive: true,
        joinedAt: new Date(),
      });
      if (!updated) {
        throw new HttpError(500, "Failed to approve membership");
      }
      return updated;
    });

    if (this.dispatcher) {
      // Notify managers about new member
      const detail = await this.membershipRepo.findDetailById(membershipId);
      this.dispatcher.notifyAcademyManagers(
        "new_member",
        m.academyId,
        [detail?.userName ?? "Novo membro"],
      );

      // Notify the member they were approved
      const academy = await this.academyRepo.findById(m.academyId);
      this.dispatcher.notifyUsers(
        "membership_approved",
        [m.userId],
        [academy?.name ?? "academia"],
      );
    }

    return result;
  }

  async reject(membershipId: string, managerUserId: string) {
    const m = await this.membershipRepo.findById(membershipId);
    if (!m) {
      throw new HttpError(404, "Membership not found");
    }
    await this.assertManagerOwnsAcademy(managerUserId, m.academyId);

    if (m.status !== "pending") {
      throw new HttpError(409, "Only pending memberships can be rejected");
    }

    const updated = await this.membershipRepo.updateStatus(membershipId, {
      status: "rejected",
      isActive: false,
    });
    if (!updated) {
      throw new HttpError(500, "Failed to reject membership");
    }

    // Notify the member they were rejected
    if (this.dispatcher) {
      const academy = await this.academyRepo.findById(m.academyId);
      this.dispatcher.notifyUsers(
        "membership_rejected",
        [m.userId],
        [academy?.name ?? "academia"],
      );
    }

    return updated;
  }

  async block(membershipId: string, managerUserId: string) {
    const m = await this.membershipRepo.findById(membershipId);
    if (!m) {
      throw new HttpError(404, "Membership not found");
    }
    await this.assertManagerOwnsAcademy(managerUserId, m.academyId);

    if (m.status !== "pending" && m.status !== "active") {
      throw new HttpError(409, "Only pending or active memberships can be blocked");
    }

    const now = new Date();
    const updated = await this.membershipRepo.updateStatus(membershipId, {
      status: "blocked",
      isActive: false,
      leftAt: m.isActive ? now : m.leftAt,
    });
    if (!updated) {
      throw new HttpError(500, "Failed to block membership");
    }
    return updated;
  }

  async unblock(membershipId: string, managerUserId: string) {
    const m = await this.membershipRepo.findById(membershipId);
    if (!m) {
      throw new HttpError(404, "Membership not found");
    }
    await this.assertManagerOwnsAcademy(managerUserId, m.academyId);

    if (m.status !== "blocked" && m.status !== "rejected") {
      throw new HttpError(409, "Only blocked or rejected memberships can be unblocked");
    }

    await this.membershipRepo.deleteById(membershipId);
  }

  async leave(userId: string) {
    const active = await this.membershipRepo.findActiveByUser(userId);
    const pending = active
      ? null
      : await this.membershipRepo.findActiveOrPendingByUser(userId);
    const membership = active ?? pending;

    if (!membership) {
      throw new HttpError(404, "No active membership to leave");
    }

    const academy = await this.academyRepo.findById(membership.academyId);
    if (academy?.ownerId === userId) {
      throw new HttpError(
        403,
        "Academy owners cannot leave their own academy in MVP",
      );
    }

    if (!active && pending) {
      await this.membershipRepo.deleteById(membership.id);
      return { id: membership.id, deleted: true };
    }

    const updated = await this.membershipRepo.updateStatus(membership.id, {
      isActive: false,
      leftAt: new Date(),
    });
    if (!updated) {
      throw new HttpError(500, "Failed to leave membership");
    }
    return updated;
  }

  private async assertManagerOwnsAcademy(userId: string, academyId: string) {
    const academy = await this.academyRepo.findById(academyId);
    if (!academy) {
      throw new HttpError(404, "Academy not found");
    }
    if (academy.ownerId !== userId) {
      throw new HttpError(403, "You do not manage this academy");
    }
  }

  private async assertActiveMemberInAcademy(userId: string, academyId: string) {
    const membership = await this.membershipRepo.findActiveByUserAndAcademy(
      userId,
      academyId,
    );

    if (!membership) {
      throw new HttpError(403, "You are not an active member of this academy");
    }
  }
}
