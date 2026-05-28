import type { Belt, Role } from "@tatame/types";
import { BELT_ORDER, KIDS_BELT_ORDER, MAX_STRIPES_BY_BELT } from "@tatame/config";
import { HttpError } from "../../lib/http-error.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import type { BeltPromotionRow, IGraduationRepository } from "./graduation.repository.js";

function beltIndex(belt: Belt, order: readonly Belt[] = BELT_ORDER): number {
  return order.indexOf(belt);
}

/** Valid (belt, stripes) ranges (Zod also enforces). */
export function assertValidBeltRank(belt: Belt, stripes: number): void {
  const max = MAX_STRIPES_BY_BELT[belt];
  if (stripes < 0 || stripes > max) {
    throw new HttpError(400, `Invalid stripe count for ${belt} belt`);
  }
}

/**
 * Strict progression: higher belt, or same belt with more stripes (spec §6.10 / Belt Rules).
 */
export function assertValidPromotion(
  from: { belt: Belt; stripes: number },
  to: { belt: Belt; stripes: number },
  isDependent = false,
): void {
  assertValidBeltRank(to.belt, to.stripes);
  const order = isDependent ? KIDS_BELT_ORDER : BELT_ORDER;
  const ib = beltIndex(from.belt, order);
  const jb = beltIndex(to.belt, order);
  if (jb > ib) {
    return;
  }
  if (jb === ib && to.stripes > from.stripes) {
    return;
  }
  throw new HttpError(
    400,
    "Invalid belt progression (must move to a higher belt or gain stripes on the same belt)",
  );
}

export class GraduationService {
  constructor(
    private readonly graduationRepo: IGraduationRepository,
    private readonly membershipRepo: IMembershipRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly dispatcher?: NotificationDispatcher,
  ) {}

  async listForUserInAcademy(userId: string, academyId: string) {
    return this.graduationRepo.listByUserInAcademy(userId, academyId);
  }

  async listForDependentInAcademy(dependentId: string, academyId: string) {
    return this.graduationRepo.listByDependentInAcademy(dependentId, academyId);
  }

  /**
   * First belt in the academy for this user (`promotedBy` = own user id).
   * Allowed when: active student membership + global role student; or academy owner
   * (manager membership) / active instructor — so staff can record their own rank.
   */
  async registerInitialBelt(opts: {
    userId: string;
    academyId: string;
    belt: Belt;
    stripes: number;
    notes: string | null;
    globalRole: Role;
  }): Promise<BeltPromotionRow> {
    const m = await this.membershipRepo.findActiveByUserAndAcademy(
      opts.userId,
      opts.academyId,
    );
    if (!m || m.status !== "active") {
      throw new HttpError(403, "Active academy membership required");
    }

    const gr = opts.globalRole;
    let allowed = false;
    if (gr === "student" && m.role === "student") {
      allowed = true;
    } else if (gr === "manager" && m.role === "manager") {
      const academy = await this.academyRepo.findById(opts.academyId);
      if (academy?.ownerId === opts.userId) {
        allowed = true;
      }
    } else if (gr === "instructor" && m.role === "instructor") {
      allowed = true;
    }

    if (!allowed) {
      throw new HttpError(
        403,
        "Initial belt registration requires matching student, owner, or instructor membership",
      );
    }

    assertValidBeltRank(opts.belt, opts.stripes);

    const current = await this.graduationRepo.findCurrentByUserId(opts.userId);
    if (current) {
      throw new HttpError(
        409,
        "Initial belt already set; only instructors or managers can change it now",
      );
    }

    try {
      return await this.graduationRepo.insertInitialCurrent({
        userId: opts.userId,
        academyId: opts.academyId,
        promotedBy: opts.userId,
        belt: opts.belt,
        stripes: opts.stripes,
        notes: opts.notes,
      });
    } catch (e) {
      if (
        e instanceof Error &&
        e.message === "GRADUATION_ALREADY_HAS_CURRENT"
      ) {
        throw new HttpError(
          409,
          "Initial belt already set; only instructors or managers can change it now",
        );
      }
      throw e;
    }
  }

  /** Manager (owner) or active instructor in the academy may list a member's promotion history (students; managers also instructors). */
  async assertStaffCanListMember(
    actorUserId: string,
    actorRole: Role,
    academyId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.assertActorCanPromoteInAcademy(
      actorUserId,
      actorRole,
      academyId,
    );
    const m = await this.membershipRepo.findActiveByUserAndAcademy(
      targetUserId,
      academyId,
    );
    if (!m || m.status !== "active") {
      throw new HttpError(404, "Member not found in this academy");
    }
    // Instructors can only view student graduations
    if (actorRole === "instructor" && m.role !== "student") {
      throw new HttpError(404, "Member not found in this academy");
    }
    // Managers can view student, instructor, and guardian graduations
    if (
      actorRole === "manager" &&
      m.role !== "student" &&
      m.role !== "instructor" &&
      m.role !== "guardian"
    ) {
      throw new HttpError(404, "Member not found in this academy");
    }
  }

  async promoteMember(opts: {
    actorUserId: string;
    actorRole: Role;
    academyId: string;
    targetUserId: string;
    belt: Belt;
    stripes: number;
    notes: string | null;
    dependentId?: string | null;
  }): Promise<BeltPromotionRow> {
    await this.assertActorCanPromoteInAcademy(
      opts.actorUserId,
      opts.actorRole,
      opts.academyId,
    );

    if (opts.targetUserId === opts.actorUserId && !opts.dependentId) {
      throw new HttpError(400, "Use the initial belt endpoint for your own belt");
    }

    const m = await this.membershipRepo.findActiveByUserAndAcademy(
      opts.targetUserId,
      opts.academyId,
    );
    if (!m || m.status !== "active") {
      throw new HttpError(404, "Member not found in this academy");
    }

    // Instructors can only promote students
    if (opts.actorRole === "instructor" && m.role !== "student") {
      throw new HttpError(404, "Member not found in this academy");
    }
    // Managers can promote students, instructors, and dependents of guardians
    if (
      opts.actorRole === "manager" &&
      m.role !== "student" &&
      m.role !== "instructor" &&
      m.role !== "guardian"
    ) {
      throw new HttpError(404, "Member not found in this academy");
    }

    const current = opts.dependentId
      ? await this.graduationRepo.findCurrentByDependentId(opts.dependentId)
      : await this.graduationRepo.findCurrentByUserId(opts.targetUserId);
    if (!current) {
      throw new HttpError(
        409,
        "Member has no current belt; they must register their initial belt first",
      );
    }

    assertValidPromotion(
      { belt: current.belt as Belt, stripes: current.stripes },
      { belt: opts.belt, stripes: opts.stripes },
      !!opts.dependentId,
    );

    const result = await this.graduationRepo.replaceCurrentPromotion({
      userId: opts.targetUserId,
      academyId: opts.academyId,
      promotedBy: opts.actorUserId,
      belt: opts.belt,
      stripes: opts.stripes,
      notes: opts.notes,
      dependentId: opts.dependentId,
    });

    if (this.dispatcher) {
      const beltNames: Record<string, string> = {
        white: "branca", blue: "azul", purple: "roxa", brown: "marrom", black: "preta",
      };
      void this.dispatcher.notifyUsers(
        "belt_promotion",
        [opts.targetUserId],
        [beltNames[opts.belt] ?? opts.belt, String(opts.stripes)],
        { academyId: opts.academyId },
      );
    }

    return result;
  }

  private async assertActorCanPromoteInAcademy(
    actorUserId: string,
    actorRole: Role,
    academyId: string,
  ): Promise<void> {
    if (actorRole === "manager") {
      const academy = await this.academyRepo.findById(academyId);
      if (!academy) {
        throw new HttpError(404, "Academy not found");
      }
      if (academy.ownerId !== actorUserId) {
        throw new HttpError(403, "You do not manage this academy");
      }
      return;
    }

    if (actorRole === "instructor") {
      const row = await this.membershipRepo.findActiveByUserAndAcademy(
        actorUserId,
        academyId,
      );
      if (!row || row.status !== "active" || row.role !== "instructor") {
        throw new HttpError(403, "Active instructor membership required");
      }
      return;
    }

    throw new HttpError(403, "Forbidden");
  }
}
