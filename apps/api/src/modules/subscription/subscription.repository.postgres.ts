import { and, desc, eq, inArray } from "drizzle-orm";
import {
  payments,
  studentSubscriptions,
  subscriptionPlans,
  users,
  type Database,
} from "@tatame/db";
import type {
  AcademySubscriptionItem,
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
      dependentId?: string | null;
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
        dependentId: newRow.dependentId ?? null,
      });
    });
  }

  async create(data: {
    userId: string;
    planId: string;
    status: "active" | "expired" | "cancelled";
    startsAt: string;
    expiresAt: string;
    dependentId?: string | null;
  }): Promise<StudentSubscriptionRow> {
    const [row] = await this.db
      .insert(studentSubscriptions)
      .values({
        userId: data.userId,
        planId: data.planId,
        status: data.status,
        startsAt: data.startsAt,
        expiresAt: data.expiresAt,
        dependentId: data.dependentId ?? null,
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

  async listByAcademy(
    academyId: string,
    opts: { status?: string; planId?: string },
  ): Promise<AcademySubscriptionItem[]> {
    const conditions = [eq(subscriptionPlans.academyId, academyId)];
    if (opts.status) {
      conditions.push(
        eq(
          studentSubscriptions.status,
          opts.status as "active" | "expired" | "cancelled",
        ),
      );
    }
    if (opts.planId) {
      conditions.push(eq(studentSubscriptions.planId, opts.planId));
    }

    const rows = await this.db
      .select({
        subscription: studentSubscriptions,
        plan: subscriptionPlans,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(studentSubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(studentSubscriptions.planId, subscriptionPlans.id),
      )
      .innerJoin(users, eq(studentSubscriptions.userId, users.id))
      .where(conditions.length === 1 ? conditions[0]! : and(...conditions))
      .orderBy(desc(studentSubscriptions.createdAt));

    const subIds = rows.map((r) => r.subscription.id);
    const lastPayments =
      subIds.length > 0
        ? await this.db
            .selectDistinctOn([payments.subscriptionId], {
              subscriptionId: payments.subscriptionId,
              referenceMonth: payments.referenceMonth,
              paidAt: payments.paidAt,
              amountCents: payments.amountCents,
            })
            .from(payments)
            .where(inArray(payments.subscriptionId, subIds))
            .orderBy(payments.subscriptionId, desc(payments.paidAt))
        : [];

    const paymentMap = new Map(lastPayments.map((p) => [p.subscriptionId, p]));

    return rows.map((r) => {
      const lp = paymentMap.get(r.subscription.id);
      return {
        subscription: r.subscription,
        plan: r.plan,
        user: r.user,
        lastPayment: lp
          ? {
              referenceMonth: lp.referenceMonth,
              paidAt: lp.paidAt,
              amountCents: lp.amountCents,
            }
          : null,
      };
    });
  }

  async findByDependentIdWithPlan(
    dependentId: string,
  ): Promise<StudentSubscriptionWithPlan | undefined> {
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
          eq(studentSubscriptions.dependentId, dependentId),
          inArray(studentSubscriptions.status, ["active", "expired"]),
        ),
      )
      .orderBy(desc(studentSubscriptions.createdAt))
      .limit(1);
    return rows[0];
  }

  async findByIdForManager(
    subscriptionId: string,
    academyId: string,
  ): Promise<AcademySubscriptionItem | undefined> {
    const [row] = await this.db
      .select({
        subscription: studentSubscriptions,
        plan: subscriptionPlans,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(studentSubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(studentSubscriptions.planId, subscriptionPlans.id),
      )
      .innerJoin(users, eq(studentSubscriptions.userId, users.id))
      .where(
        and(
          eq(studentSubscriptions.id, subscriptionId),
          eq(subscriptionPlans.academyId, academyId),
        ),
      )
      .limit(1);

    if (!row) return undefined;

    const lastPayments = await this.db
      .select({
        referenceMonth: payments.referenceMonth,
        paidAt: payments.paidAt,
        amountCents: payments.amountCents,
      })
      .from(payments)
      .where(eq(payments.subscriptionId, subscriptionId))
      .orderBy(desc(payments.paidAt))
      .limit(1);

    return {
      subscription: row.subscription,
      plan: row.plan,
      user: row.user,
      lastPayment: lastPayments[0]
        ? {
            referenceMonth: lastPayments[0].referenceMonth,
            paidAt: lastPayments[0].paidAt,
            amountCents: lastPayments[0].amountCents,
          }
        : null,
    };
  }
}
