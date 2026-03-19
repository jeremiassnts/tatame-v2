import { HttpError } from "../../lib/http-error.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IMembershipRepository } from "./membership.repository.js";

export class MembershipService {
  constructor(
    private readonly membershipRepo: IMembershipRepository,
    private readonly academyRepo: IAcademyRepository,
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

    return this.membershipRepo.create({
      academyId,
      userId,
      role,
      status: "pending",
      isActive: false,
      joinedAt: null,
      leftAt: null,
    });
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

    const targetActive = await this.membershipRepo.findActiveByUser(m.userId);
    if (targetActive) {
      throw new HttpError(
        409,
        "User already has an active membership elsewhere",
      );
    }

    return this.membershipRepo.withTransaction(async (txRepo) => {
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
    if (!active) {
      throw new HttpError(404, "No active membership to leave");
    }

    const academy = await this.academyRepo.findById(active.academyId);
    if (academy?.ownerId === userId) {
      throw new HttpError(
        403,
        "Academy owners cannot leave their own academy in MVP",
      );
    }

    const updated = await this.membershipRepo.updateStatus(active.id, {
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
}
