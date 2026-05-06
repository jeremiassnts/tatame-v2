import type { Role } from "@tatame/types";
import type {
  CreateSubscriptionPlanBody,
  UpdateSubscriptionPlanBody,
} from "@tatame/validators";
import { HttpError } from "../../lib/http-error.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.js";
import { FREE_PLAN_LIMITS } from "../manager-subscription/plan-limits.js";
import type {
  AcademySubscriptionItem,
  IStudentSubscriptionRepository,
  ISubscriptionPlanRepository,
  StudentSubscriptionRow,
  SubscriptionPlanRow,
} from "./subscription.repository.js";

export function utcTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addCalendarMonths(isoDate: string, months: number): string {
  const parts = isoDate.split("-");
  const y = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 1);
  const d = Number(parts[2] ?? 1);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

export function isExpiredByDate(expiresAt: string, today = utcTodayDateString()): boolean {
  return expiresAt < today;
}

export type SubscriptionMePayload = {
  subscription: (StudentSubscriptionRow & {
    expiredByDate: boolean;
    effectiveStatus: "active" | "expired" | "cancelled";
  }) | null;
  plan: SubscriptionPlanRow | null;
};

export class SubscriptionService {
  constructor(
    private readonly planRepo: ISubscriptionPlanRepository,
    private readonly studentSubRepo: IStudentSubscriptionRepository,
    private readonly academyRepo: IAcademyRepository,
    private readonly managerSubRepo?: IManagerSubscriptionRepository,
  ) {}

  async listPlans(
    academyId: string,
    opts: { includeInactive: boolean; requesterRole: Role },
  ): Promise<SubscriptionPlanRow[]> {
    const includeInactive =
      opts.requesterRole === "manager" ? opts.includeInactive : false;
    return this.planRepo.findByAcademy(academyId, { includeInactive });
  }

  async getPlan(academyId: string, planId: string): Promise<SubscriptionPlanRow> {
    const plan = await this.planRepo.findById(planId);
    if (!plan || plan.academyId !== academyId) {
      throw new HttpError(404, "Subscription plan not found");
    }
    return plan;
  }

  async createPlan(
    managerUserId: string,
    academyId: string,
    body: CreateSubscriptionPlanBody,
  ): Promise<SubscriptionPlanRow> {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);

    // Plan limit enforcement
    if (this.managerSubRepo) {
      const sub = await this.managerSubRepo.findByAcademyId(academyId);
      if (sub?.plan === "free") {
        const plans = await this.planRepo.findByAcademy(academyId, {
          includeInactive: false,
        });
        if (plans.length >= FREE_PLAN_LIMITS.maxPlans) {
          throw new HttpError(403, "Limite de planos atingido para o plano atual", {
            code: "PLAN_LIMIT_PLANS",
          });
        }
      }
    }

    return this.planRepo.create({
      academyId,
      name: body.name,
      recurrenceMonths: body.recurrenceMonths,
      priceCents: body.priceCents,
      weeklyCheckinLimit: body.weeklyCheckinLimit ?? null,
      isActive: body.isActive ?? true,
    });
  }

  async updatePlan(
    managerUserId: string,
    academyId: string,
    planId: string,
    body: UpdateSubscriptionPlanBody,
  ): Promise<SubscriptionPlanRow> {
    if (Object.keys(body).length === 0) {
      throw new HttpError(400, "At least one field is required");
    }
    const existing = await this.getPlan(academyId, planId);
    await this.assertManagerOwnsAcademy(managerUserId, existing.academyId);

    const updated = await this.planRepo.update(planId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.recurrenceMonths !== undefined
        ? { recurrenceMonths: body.recurrenceMonths }
        : {}),
      ...(body.priceCents !== undefined ? { priceCents: body.priceCents } : {}),
      ...(body.weeklyCheckinLimit !== undefined
        ? { weeklyCheckinLimit: body.weeklyCheckinLimit }
        : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    });
    if (!updated) {
      throw new HttpError(404, "Subscription plan not found");
    }
    return updated;
  }

  async getMySubscription(
    userId: string,
    academyId: string,
  ): Promise<SubscriptionMePayload> {
    const rows = await this.studentSubRepo.listWithPlanByUserAndAcademy(
      userId,
      academyId,
    );

    for (const row of rows) {
      if (
        row.subscription.status === "active" &&
        isExpiredByDate(row.subscription.expiresAt)
      ) {
        await this.studentSubRepo.update(row.subscription.id, {
          status: "expired",
        });
        row.subscription.status = "expired";
      }
    }

    const candidate = rows.find((r) => r.subscription.status !== "cancelled");
    if (!candidate) {
      return { subscription: null, plan: null };
    }

    const { subscription: sub, plan } = candidate;
    const expiredByDate = isExpiredByDate(sub.expiresAt);
    let effectiveStatus: "active" | "expired" | "cancelled" = sub.status;
    if (sub.status === "active" && expiredByDate) {
      effectiveStatus = "expired";
    }

    return {
      subscription: {
        ...sub,
        expiredByDate,
        effectiveStatus,
      },
      plan,
    };
  }

  async selectPlan(
    userId: string,
    academyId: string,
    planId: string,
  ): Promise<{ subscription: StudentSubscriptionRow; plan: SubscriptionPlanRow }> {
    const plan = await this.planRepo.findById(planId);
    if (!plan || plan.academyId !== academyId) {
      throw new HttpError(404, "Subscription plan not found");
    }
    if (!plan.isActive) {
      throw new HttpError(409, "This subscription plan is no longer available");
    }

    const startsAt = utcTodayDateString();
    const expiresAt = addCalendarMonths(startsAt, plan.recurrenceMonths);

    const subscription =
      await this.studentSubRepo.replaceActiveSubscriptionForAcademy(
        userId,
        academyId,
        {
          planId: plan.id,
          status: "active",
          startsAt,
          expiresAt,
        },
      );

    return { subscription, plan };
  }

  async listAcademySubscriptions(
    managerUserId: string,
    academyId: string,
    opts: { status?: string; planId?: string; pendingPayment?: boolean },
  ): Promise<
    (AcademySubscriptionItem & {
      effectiveStatus: "active" | "expired" | "cancelled";
      hasPaidCurrentMonth: boolean;
    })[]
  > {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);

    const items = await this.studentSubRepo.listByAcademy(academyId, {
      status: opts.status,
      planId: opts.planId,
    });

    const today = utcTodayDateString();
    const currentMonth = today.slice(0, 7) + "-01";

    const enriched = items.map((item) => {
      const expiredByDate = isExpiredByDate(item.subscription.expiresAt, today);
      let effectiveStatus: "active" | "expired" | "cancelled" =
        item.subscription.status as "active" | "expired" | "cancelled";
      if (item.subscription.status === "active" && expiredByDate) {
        effectiveStatus = "expired";
      }
      const hasPaidCurrentMonth =
        item.lastPayment?.referenceMonth === currentMonth;
      return { ...item, effectiveStatus, hasPaidCurrentMonth };
    });

    if (opts.pendingPayment) {
      return enriched.filter(
        (e) => e.effectiveStatus === "active" && !e.hasPaidCurrentMonth,
      );
    }

    return enriched;
  }

  async getAcademySubscription(
    managerUserId: string,
    academyId: string,
    subscriptionId: string,
  ): Promise<
    AcademySubscriptionItem & {
      effectiveStatus: "active" | "expired" | "cancelled";
      hasPaidCurrentMonth: boolean;
    }
  > {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);

    const item = await this.studentSubRepo.findByIdForManager(
      subscriptionId,
      academyId,
    );
    if (!item) {
      throw new HttpError(404, "Subscription not found");
    }

    const today = utcTodayDateString();
    const currentMonth = today.slice(0, 7) + "-01";
    const expiredByDate = isExpiredByDate(item.subscription.expiresAt, today);
    let effectiveStatus: "active" | "expired" | "cancelled" =
      item.subscription.status as "active" | "expired" | "cancelled";
    if (item.subscription.status === "active" && expiredByDate) {
      effectiveStatus = "expired";
    }
    const hasPaidCurrentMonth =
      item.lastPayment?.referenceMonth === currentMonth;

    return { ...item, effectiveStatus, hasPaidCurrentMonth };
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
