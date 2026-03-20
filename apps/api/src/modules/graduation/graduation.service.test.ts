import { randomUUID } from "node:crypto";
import { Belt } from "@tatame/types";
import { describe, expect, it } from "vitest";
import { HttpError } from "../../lib/http-error.js";
import {
  makeAcademy,
  makeBeltPromotion,
  makeMembership,
} from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import { InMemoryMembershipRepository } from "../membership/membership.repository.in-memory.js";
import type { MembershipRow } from "../membership/membership.repository.js";
import { InMemoryGraduationRepository } from "./graduation.repository.in-memory.js";
import type { BeltPromotionRow } from "./graduation.repository.js";
import {
  assertValidBeltRank,
  assertValidPromotion,
  GraduationService,
} from "./graduation.service.js";

describe("assertValidBeltRank", () => {
  it("rejects stripes above max for white", () => {
    expect(() => assertValidBeltRank(Belt.White, 5)).toThrow(HttpError);
  });

  it("accepts black belt 10 stripes", () => {
    expect(() => assertValidBeltRank(Belt.Black, 10)).not.toThrow();
  });
});

describe("assertValidPromotion", () => {
  it("allows next belt with fewer stripes", () => {
    expect(() =>
      assertValidPromotion(
        { belt: Belt.Blue, stripes: 4 },
        { belt: Belt.Purple, stripes: 0 },
      ),
    ).not.toThrow();
  });

  it("allows more stripes on same belt", () => {
    expect(() =>
      assertValidPromotion(
        { belt: Belt.Blue, stripes: 1 },
        { belt: Belt.Blue, stripes: 3 },
      ),
    ).not.toThrow();
  });

  it("rejects lower belt", () => {
    expect(() =>
      assertValidPromotion(
        { belt: Belt.Purple, stripes: 0 },
        { belt: Belt.Blue, stripes: 4 },
      ),
    ).toThrow(HttpError);
  });

  it("rejects fewer stripes on same belt", () => {
    expect(() =>
      assertValidPromotion(
        { belt: Belt.Brown, stripes: 3 },
        { belt: Belt.Brown, stripes: 2 },
      ),
    ).toThrow(HttpError);
  });
});

describe("GraduationService", () => {
  function makeGraduationSvc(
    promotions: BeltPromotionRow[],
    memberships: MembershipRow[],
    academy = makeAcademy(),
  ) {
    return new GraduationService(
      new InMemoryGraduationRepository(promotions),
      new InMemoryMembershipRepository(memberships),
      new InMemoryAcademyRepository([academy]),
    );
  }

  it("registerInitialBelt inserts first promotion for student", async () => {
    const studentId = randomUUID();
    const academy = makeAcademy();
    const mem = makeMembership({
      userId: studentId,
      academyId: academy.id,
      role: "student",
      status: "active",
      isActive: true,
    });
    const promos: BeltPromotionRow[] = [];
    const svc = makeGraduationSvc(promos, [mem], academy);

    const row = await svc.registerInitialBelt({
      studentUserId: studentId,
      academyId: academy.id,
      belt: Belt.White,
      stripes: 0,
      notes: null,
    });
    expect(row.belt).toBe("white");
    expect(row.isCurrent).toBe(true);
    expect(promos).toHaveLength(1);
  });

  it("registerInitialBelt returns 409 when current already exists", async () => {
    const studentId = randomUUID();
    const academy = makeAcademy();
    const mem = makeMembership({
      userId: studentId,
      academyId: academy.id,
      role: "student",
      status: "active",
      isActive: true,
    });
    const promos = [
      makeBeltPromotion({
        userId: studentId,
        academyId: academy.id,
        isCurrent: true,
        belt: "white",
        stripes: 0,
      }),
    ];
    const svc = makeGraduationSvc(promos, [mem], academy);

    await expect(
      svc.registerInitialBelt({
        studentUserId: studentId,
        academyId: academy.id,
        belt: Belt.Blue,
        stripes: 0,
        notes: null,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("promoteStudent replaces current belt", async () => {
    const managerId = randomUUID();
    const studentId = randomUUID();
    const academy = makeAcademy({ ownerId: managerId });
    const memStudent = makeMembership({
      userId: studentId,
      academyId: academy.id,
      role: "student",
      status: "active",
      isActive: true,
    });
    const promos = [
      makeBeltPromotion({
        userId: studentId,
        academyId: academy.id,
        isCurrent: true,
        belt: "white",
        stripes: 0,
        promotedBy: studentId,
      }),
    ];
    const svc = makeGraduationSvc(promos, [memStudent], academy);

    const row = await svc.promoteStudent({
      actorUserId: managerId,
      actorRole: "manager",
      academyId: academy.id,
      studentUserId: studentId,
      belt: Belt.Blue,
      stripes: 0,
      notes: null,
    });
    expect(row.belt).toBe("blue");
    const currents = promos.filter((p) => p.isCurrent);
    expect(currents).toHaveLength(1);
    expect(currents[0]!.id).toBe(row.id);
  });
});
