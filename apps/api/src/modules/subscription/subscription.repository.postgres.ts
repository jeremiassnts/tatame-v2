import { and, desc, eq, inArray } from "drizzle-orm";
import {
  studentSubscriptions,
  subscriptionPlans,
  type Database,
} from "@tatame/db";
import type {
  IStudentSubscriptionRepository,
  ISubscriptionPlanRepository,
  StudentSubscriptionRow,
  StudentSubscriptionWithPlan,
  SubscriptionPlanRow,
} from "./subscription.repository.js";

export class PostgresSubscriptionPlanRepository
  implements ISubscriptionPlanRepository
{
  constructor(private readonly db: Database) {}

  async findByAcademy(
    academyId: string,
    opts: { includeInactive: boolean },
  ): Promise<SubscriptionPlanRow[]> {
    const conditions = [eq(subscriptionPlans.academyId, academyId)];
    if (!opts.includeInactive) {
      conditions.push(eq(subscriptionPlans.isActive, true));
    }
    const whereClause =
      conditions.length === 1 ? conditions[0]! : and(...conditions);
    return this.db
      .select()
      .from(subscriptionPlans)
      .where(whereClause)
      .orderBy(subscriptionPlans.name);
  }

  async findById(planId: string): Promise<SubscriptionPlanRow | undefined> {
    const [row] = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);
    return row;
  }

  async create(data: {
    academyId: string;
    name: string;
    recurrenceMonths: number;
    priceCents: number;
    weeklyCheckinLimit: number | null;
    isActive: boolean;
  }): Promise<SubscriptionPlanRow> {
    const [row] = await this.db
      .insert(subscriptionPlans)
      .values({
        academyId: data.academyId,
        name: data.name,
        recurrenceMonths: data.recurrenceMonths,
        priceCents: data.priceCents,
        weeklyCheckinLimit: data.weeklyCheckinLimit,
        isActive: data.isActive,
      })
      .returning();
    if (!row) throw new Error("Failed to create subscription plan");
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
    const [row] = await this.db
      .update(subscriptionPlans)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.recurrenceMonths !== undefined
          ? { recurrenceMonths: data.recurrenceMonths }
          : {}),
        ...(data.priceCents !== undefined ? { priceCents: data.priceCents } : {}),
        ...(data.weeklyCheckinLimit !== undefined
          ? { weeklyCheckinLimit: data.weeklyCheckinLimit }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(subscriptionPlans.id, planId))
      .returning();
    return row;
  }
}

export class PostgresStudentSubscriptionRepository
  implements IStudentSubscriptionRepository
{
  constructor(private readonly db: Database) {}

  async listWithPlanByUserAndAcademy(
    userId: string,
    academyId: string,
  ): Promise<StudentSubscriptionWithPlan[]> {
    const rows = await this.db
      .select({
        subscription: studentSubscriptions,
        plan: subscriptionPlans,
      })
      .from(studentSubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(studentSubscriptions.planId, subscriptionPlans.id),
      )
      .where(
        and(
          eq(studentSubscriptions.userId, userId),
          eq(subscriptionPlans.academyId, academyId),
        ),
      )
      .orderBy(desc(studentSubscriptions.createdAt));

    return rows;
  }

  async findByIdWithPlan(
    subscriptionId: string,
  ): Promise<StudentSubscriptionWithPlan | undefined> {
    const [row] = await this.db
      .select({
        subscription: studentSubscriptions,
        plan: subscriptionPlans,
      })
      .from(studentSubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(studentSubscriptions.planId, subscriptionPlans.id),
      )
      .where(eq(studentSubscriptions.id, subscriptionId))
      .limit(1);
    return row;
  }

  async cancelActiveForUserInAcademy(
    userId: string,
    academyId: string,
  ): Promise<void> {
    const planRows = await this.db
      .select({ id: subscriptionPlans.id })
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.academyId, academyId));
    const planIds = planRows.map((p) => p.id);
    if (planIds.length === 0) return;

    await this.db
      .update(studentSubscriptions)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(studentSubscriptions.userId, userId),
          eq(studentSubscriptions.status, "active"),
          inArray(studentSubscriptions.planId, planIds),
        ),
      );
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
    return this.db.transaction(async (tx) => {
      const inner = new PostgresStudentSubscriptionRepository(
        tx as unknown as Database,
      );
      await inner.cancelActiveForUserInAcademy(userId, academyId);
      return inner.create({
        userId,
        planId: newRow.planId,
        status: newRow.status,
        startsAt: newRow.startsAt,
        expiresAt: newRow.expiresAt,
      });
    });
  }

  async create(data: {
    userId: string;
    planId: string;
    status: "active" | "expired" | "cancelled";
    startsAt: string;
    expiresAt: string;
  }): Promise<StudentSubscriptionRow> {
    const [row] = await this.db
      .insert(studentSubscriptions)
      .values({
        userId: data.userId,
        planId: data.planId,
        status: data.status,
        startsAt: data.startsAt,
        expiresAt: data.expiresAt,
      })
      .returning();
    if (!row) throw new Error("Failed to create student subscription");
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
    const [row] = await this.db
      .update(studentSubscriptions)
      .set({
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.startsAt !== undefined ? { startsAt: data.startsAt } : {}),
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(studentSubscriptions.id, subscriptionId))
      .returning();
    return row;
  }
}
