import { randomUUID } from "node:crypto";
import type {
  IStudentSubscriptionRepository,
  ISubscriptionPlanRepository,
  StudentSubscriptionRow,
  StudentSubscriptionWithPlan,
  SubscriptionPlanRow,
} from "./subscription.repository.js";

export class InMemorySubscriptionPlanRepository
  implements ISubscriptionPlanRepository
{
  constructor(private readonly rows: SubscriptionPlanRow[] = []) {}

  async findByAcademy(
    academyId: string,
    opts: { includeInactive: boolean },
  ): Promise<SubscriptionPlanRow[]> {
    return this.rows
      .filter((p) => p.academyId === academyId)
      .filter((p) => opts.includeInactive || p.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findById(planId: string): Promise<SubscriptionPlanRow | undefined> {
    return this.rows.find((p) => p.id === planId);
  }

  async create(data: {
    academyId: string;
    name: string;
    recurrenceMonths: number;
    priceCents: number;
    weeklyCheckinLimit: number | null;
    isActive: boolean;
  }): Promise<SubscriptionPlanRow> {
    const t = new Date();
    const row: SubscriptionPlanRow = {
      id: randomUUID(),
      ...data,
      createdAt: t,
      updatedAt: t,
    };
    this.rows.push(row);
    return row;
  }

  async update(
    planId: string,
    data: Partial<{
      name: string;
      recurrenceMonths: number;
      priceCents: number;
      weeklyCheckinLimit: number | null;
      isActive: boolean;
    }>,
  ): Promise<SubscriptionPlanRow | undefined> {
    const row = this.rows.find((p) => p.id === planId);
    if (!row) return undefined;
    Object.assign(row, data, { updatedAt: new Date() });
    return row;
  }
}

export class InMemoryStudentSubscriptionRepository
  implements IStudentSubscriptionRepository
{
  constructor(
    private readonly planRepo: InMemorySubscriptionPlanRepository,
    private readonly rows: StudentSubscriptionRow[] = [],
  ) {}

  async listWithPlanByUserAndAcademy(
    userId: string,
    academyId: string,
  ): Promise<StudentSubscriptionWithPlan[]> {
    const out: StudentSubscriptionWithPlan[] = [];
    for (const sub of this.rows) {
      if (sub.userId !== userId) continue;
      const plan = await this.planRepo.findById(sub.planId);
      if (!plan || plan.academyId !== academyId) continue;
      out.push({ subscription: sub, plan });
    }
    return out.sort(
      (a, b) =>
        new Date(b.subscription.createdAt).getTime() -
        new Date(a.subscription.createdAt).getTime(),
    );
  }

  async findByIdWithPlan(
    subscriptionId: string,
  ): Promise<StudentSubscriptionWithPlan | undefined> {
    const sub = this.rows.find((r) => r.id === subscriptionId);
    if (!sub) return undefined;
    const plan = await this.planRepo.findById(sub.planId);
    if (!plan) return undefined;
    return { subscription: sub, plan };
  }

  async cancelActiveForUserInAcademy(
    userId: string,
    academyId: string,
  ): Promise<void> {
    const planRows = await this.planRepo.findByAcademy(academyId, {
      includeInactive: true,
    });
    const planIds = new Set(planRows.map((p) => p.id));
    const t = new Date();
    for (const sub of this.rows) {
      if (
        sub.userId === userId &&
        sub.status === "active" &&
        planIds.has(sub.planId)
      ) {
        sub.status = "cancelled";
        sub.updatedAt = t;
      }
    }
  }

  async replaceActiveSubscriptionForAcademy(
    userId: string,
    academyId: string,
    newRow: {
      planId: string;
      status: "active" | "expired" | "cancelled";
      startsAt: string;
      expiresAt: string;
    },
  ): Promise<StudentSubscriptionRow> {
    await this.cancelActiveForUserInAcademy(userId, academyId);
    return this.create({
      userId,
      planId: newRow.planId,
      status: newRow.status,
      startsAt: newRow.startsAt,
      expiresAt: newRow.expiresAt,
    });
  }

  async create(data: {
    userId: string;
    planId: string;
    status: "active" | "expired" | "cancelled";
    startsAt: string;
    expiresAt: string;
  }): Promise<StudentSubscriptionRow> {
    const t = new Date();
    const row: StudentSubscriptionRow = {
      id: randomUUID(),
      userId: data.userId,
      planId: data.planId,
      status: data.status,
      startsAt: data.startsAt,
      expiresAt: data.expiresAt,
      createdAt: t,
      updatedAt: t,
    };
    this.rows.push(row);
    return row;
  }

  async update(
    subscriptionId: string,
    data: Partial<{
      status: "active" | "expired" | "cancelled";
      startsAt: string;
      expiresAt: string;
    }>,
  ): Promise<StudentSubscriptionRow | undefined> {
    const row = this.rows.find((r) => r.id === subscriptionId);
    if (!row) return undefined;
    Object.assign(row, data, { updatedAt: new Date() });
    return row;
  }
}
