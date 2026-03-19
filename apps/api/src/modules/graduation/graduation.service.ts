import type { Belt, Role } from "@tatame/types";
import { BELT_ORDER, MAX_STRIPES_BY_BELT } from "@tatame/config";
import { HttpError } from "../../lib/http-error.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { BeltPromotionRow, IGraduationRepository } from "./graduation.repository.js";

function beltIndex(belt: Belt): number {
  return BELT_ORDER.indexOf(belt);
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
): void {
  assertValidBeltRank(to.belt, to.stripes);
  const ib = beltIndex(from.belt);
  const jb = beltIndex(to.belt);
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
  ) {}

  async listForUserInAcademy(userId: string, academyId: string) {
    return this.graduationRepo.listByUserInAcademy(userId, academyId);
  }

  /**
   * Student registers first belt after approval (spec: initial belt by student).
   * `promotedBy` is the student's own id (DB column non-null).
   */
  async registerInitialBelt(opts: {
    studentUserId: string;
    academyId: string;
    belt: Belt;
    stripes: number;
    notes: string | null;
  }): Promise<BeltPromotionRow> {
    const m = await this.membershipRepo.findActiveByUserAndAcademy(
      opts.studentUserId,
      opts.academyId,
    );
    if (!m || m.status !== "active" || m.role !== "student") {
      throw new HttpError(403, "Active student membership required");
    }

    assertValidBeltRank(opts.belt, opts.stripes);

    const current = await this.graduationRepo.findCurrentByUserId(
      opts.studentUserId,
    );
    if (current) {
      throw new HttpError(
        409,
        "Initial belt already set; only instructors or managers can change it now",
      );
    }

    try {
      return await this.graduationRepo.insertInitialCurrent({
        userId: opts.studentUserId,
        academyId: opts.academyId,
        promotedBy: opts.studentUserId,
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

  /** Manager (owner) or active instructor in the academy may list a student's promotion history. */
  async assertStaffCanListStudent(
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
    if (!m || m.status !== "active" || m.role !== "student") {
      throw new HttpError(404, "Student not found in this academy");
    }
  }

  async promoteStudent(opts: {
    actorUserId: string;
    actorRole: Role;
    academyId: string;
    studentUserId: string;
    belt: Belt;
    stripes: number;
    notes: string | null;
  }): Promise<BeltPromotionRow> {
    await this.assertActorCanPromoteInAcademy(
      opts.actorUserId,
      opts.actorRole,
      opts.academyId,
    );

    if (opts.studentUserId === opts.actorUserId) {
      throw new HttpError(400, "Use the initial belt endpoint for your own belt");
    }

    const m = await this.membershipRepo.findActiveByUserAndAcademy(
      opts.studentUserId,
      opts.academyId,
    );
    if (!m || m.status !== "active" || m.role !== "student") {
      throw new HttpError(404, "Student not found in this academy");
    }

    const current = await this.graduationRepo.findCurrentByUserId(
      opts.studentUserId,
    );
    if (!current) {
      throw new HttpError(
        409,
        "Student has no current belt; they must register their initial belt first",
      );
    }

    assertValidPromotion(
      { belt: current.belt as Belt, stripes: current.stripes },
      { belt: opts.belt, stripes: opts.stripes },
    );

    return this.graduationRepo.replaceCurrentPromotion({
      userId: opts.studentUserId,
      academyId: opts.academyId,
      promotedBy: opts.actorUserId,
      belt: opts.belt,
      stripes: opts.stripes,
      notes: opts.notes,
    });
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
