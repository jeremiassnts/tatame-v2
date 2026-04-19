import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  makeAcademy,
  makeManagerSubscription,
  makeMembership,
  makeClass,
  makeSubscriptionPlan,
} from "../../testing/factories/index.js";
import { InMemoryAcademyRepository } from "../academy/academy.repository.in-memory.js";
import type { AcademyRow } from "../academy/academy.repository.js";
import { InMemoryMembershipRepository } from "../membership/membership.repository.in-memory.js";
import type { MembershipRow } from "../membership/membership.repository.js";
import { InMemoryClassRepository } from "../class/class.repository.in-memory.js";
import type { ClassRow } from "../class/class.repository.js";
import { InMemorySubscriptionPlanRepository } from "../subscription/subscription.repository.in-memory.js";
import type { SubscriptionPlanRow } from "../subscription/subscription.repository.js";
import { InMemoryManagerSubscriptionRepository } from "./manager-subscription.repository.in-memory.js";
import type { ManagerSubscriptionRow } from "./manager-subscription.repository.js";
import { ManagerSubscriptionService } from "./manager-subscription.service.js";

function makeSvc(opts: {
  academies?: AcademyRow[];
  memberships?: MembershipRow[];
  classes?: ClassRow[];
  plans?: SubscriptionPlanRow[];
  subscriptions?: ManagerSubscriptionRow[];
}) {
  const acadRepo = new InMemoryAcademyRepository(opts.academies ?? []);
  const memRepo = new InMemoryMembershipRepository(opts.memberships ?? []);
  const classRepo = new InMemoryClassRepository(opts.classes ?? []);
  const planRepo = new InMemorySubscriptionPlanRepository(opts.plans ?? []);
  const subRepo = new InMemoryManagerSubscriptionRepository(
    opts.subscriptions ?? [],
  );
  return {
    svc: new ManagerSubscriptionService(
      subRepo,
      acadRepo,
      memRepo,
      classRepo,
      planRepo,
    ),
    subRepo,
  };
}

describe("ManagerSubscriptionService", () => {
  describe("selectFree", () => {
    it("creates a free subscription for academy", async () => {
      const ownerId = randomUUID();
      const academy = makeAcademy({ ownerId });
      const { svc } = makeSvc({ academies: [academy] });

      const result = await svc.selectFree(ownerId, academy.id);
      expect(result.plan).toBe("free");
      expect(result.status).toBe("active");
      expect(result.revenuecatAppUserId).toBeNull();
    });

    it("rejects if academy already has subscription", async () => {
      const ownerId = randomUUID();
      const academy = makeAcademy({ ownerId });
      const existing = makeManagerSubscription({ academyId: academy.id });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [existing],
      });

      await expect(svc.selectFree(ownerId, academy.id)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("rejects if user does not own academy", async () => {
      const academy = makeAcademy();
      const { svc } = makeSvc({ academies: [academy] });

      await expect(
        svc.selectFree(randomUUID(), academy.id),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe("getSubscription", () => {
    it("returns subscription for academy", async () => {
      const ownerId = randomUUID();
      const academy = makeAcademy({ ownerId });
      const sub = makeManagerSubscription({ academyId: academy.id });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
      });

      const result = await svc.getSubscription(academy.id);
      expect(result).toBeDefined();
      expect(result!.academyId).toBe(academy.id);
    });

    it("returns undefined when no subscription", async () => {
      const { svc } = makeSvc({});
      const result = await svc.getSubscription(randomUUID());
      expect(result).toBeUndefined();
    });
  });

  describe("getLimits", () => {
    it("returns free plan limits with current usage", async () => {
      const ownerId = randomUUID();
      const academy = makeAcademy({ ownerId });
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "free",
        status: "active",
      });
      const students = Array.from({ length: 5 }, () =>
        makeMembership({
          academyId: academy.id,
          role: "student",
          status: "active",
          isActive: true,
        }),
      );
      const plan = makeSubscriptionPlan({ academyId: academy.id });
      const cls = makeClass({ academyId: academy.id, dayOfWeek: 1 });

      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        memberships: students,
        plans: [plan],
        classes: [cls],
      });

      const limits = await svc.getLimits(academy.id);
      expect(limits.plan).toBe("free");
      expect(limits.students.used).toBe(5);
      expect(limits.students.limit).toBe(50);
      expect(limits.plans.used).toBe(1);
      expect(limits.plans.limit).toBe(1);
      expect(limits.instructors.allowed).toBe(false);
      expect(limits.blocked).toBe(false);
    });

    it("returns pro plan with no limits", async () => {
      const ownerId = randomUUID();
      const academy = makeAcademy({ ownerId });
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "pro",
        status: "active",
      });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
      });

      const limits = await svc.getLimits(academy.id);
      expect(limits.plan).toBe("pro");
      expect(limits.students.limit).toBeNull();
      expect(limits.plans.limit).toBeNull();
      expect(limits.instructors.allowed).toBe(true);
      expect(limits.blocked).toBe(false);
    });

    it("returns blocked=true for canceled pro with students over free limit", async () => {
      const ownerId = randomUUID();
      const academy = makeAcademy({ ownerId });
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "pro",
        status: "canceled",
        revenuecatAppUserId: "user_test_123",
      });
      const students = Array.from({ length: 51 }, () =>
        makeMembership({
          academyId: academy.id,
          role: "student",
          status: "active",
          isActive: true,
        }),
      );
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        memberships: students,
      });

      const limits = await svc.getLimits(academy.id);
      expect(limits.blocked).toBe(true);
    });
  });

  describe("canApproveStudent", () => {
    it("allows approval under 50 student limit", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "free",
        status: "active",
      });
      const students = Array.from({ length: 49 }, () =>
        makeMembership({
          academyId: academy.id,
          role: "student",
          status: "active",
          isActive: true,
        }),
      );
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        memberships: students,
      });

      await expect(svc.canApproveStudent(academy.id)).resolves.not.toThrow();
    });

    it("blocks approval at 50 students on free plan", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "free",
        status: "active",
      });
      const students = Array.from({ length: 50 }, () =>
        makeMembership({
          academyId: academy.id,
          role: "student",
          status: "active",
          isActive: true,
        }),
      );
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        memberships: students,
      });

      await expect(svc.canApproveStudent(academy.id)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe("canApproveInstructor", () => {
    it("blocks instructor approval on free plan", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "free",
        status: "active",
      });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
      });

      await expect(svc.canApproveInstructor(academy.id)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("allows instructor approval on pro plan", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "pro",
        status: "active",
      });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
      });

      await expect(svc.canApproveInstructor(academy.id)).resolves.not.toThrow();
    });
  });

  describe("canCreatePlan", () => {
    it("blocks second plan on free", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "free",
        status: "active",
      });
      const plan = makeSubscriptionPlan({ academyId: academy.id });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        plans: [plan],
      });

      await expect(svc.canCreatePlan(academy.id)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe("canCreateClass", () => {
    it("blocks third class on same day on free", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "free",
        status: "active",
      });
      const cls1 = makeClass({ academyId: academy.id, dayOfWeek: 1 });
      const cls2 = makeClass({ academyId: academy.id, dayOfWeek: 1 });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        classes: [cls1, cls2],
      });

      await expect(svc.canCreateClass(academy.id, 1)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("allows class on different day on free", async () => {
      const academy = makeAcademy();
      const sub = makeManagerSubscription({
        academyId: academy.id,
        plan: "free",
        status: "active",
      });
      const cls1 = makeClass({ academyId: academy.id, dayOfWeek: 1 });
      const cls2 = makeClass({ academyId: academy.id, dayOfWeek: 1 });
      const { svc } = makeSvc({
        academies: [academy],
        subscriptions: [sub],
        classes: [cls1, cls2],
      });

      await expect(svc.canCreateClass(academy.id, 2)).resolves.not.toThrow();
    });
  });
});

