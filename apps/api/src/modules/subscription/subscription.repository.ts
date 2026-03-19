import type { InferSelectModel } from "drizzle-orm";
import type { studentSubscriptions, subscriptionPlans } from "@tatame/db";

export type SubscriptionPlanRow = InferSelectModel<typeof subscriptionPlans>;
export type StudentSubscriptionRow = InferSelectModel<
  typeof studentSubscriptions
>;

export type StudentSubscriptionWithPlan = {
  subscription: StudentSubscriptionRow;
  plan: SubscriptionPlanRow;
};

export interface ISubscriptionPlanRepository {
  findByAcademy(
    academyId: string,
    opts: { includeInactive: boolean },
  ): Promise<SubscriptionPlanRow[]>;

  findById(planId: string): Promise<SubscriptionPlanRow | undefined>;

  create(data: {
    academyId: string;
    name: string;
    recurrenceMonths: number;
    priceCents: number;
    weeklyCheckinLimit: number | null;
    isActive: boolean;
  }): Promise<SubscriptionPlanRow>;

  update(
    planId: string,
    data: Partial<{
      name: string;
      recurrenceMonths: number;
      priceCents: number;
      weeklyCheckinLimit: number | null;
      isActive: boolean;
    }>,
  ): Promise<SubscriptionPlanRow | undefined>;
}

export interface IStudentSubscriptionRepository {
  listWithPlanByUserAndAcademy(
    userId: string,
    academyId: string,
  ): Promise<StudentSubscriptionWithPlan[]>;

  findByIdWithPlan(
    subscriptionId: string,
  ): Promise<StudentSubscriptionWithPlan | undefined>;

  cancelActiveForUserInAcademy(userId: string, academyId: string): Promise<void>;

  /**
   * Cancels active subscriptions for the user in this academy and inserts a new row — single transaction.
   */
  replaceActiveSubscriptionForAcademy(
    userId: string,
    academyId: string,
    newRow: {
      planId: string;
      status: "active" | "expired" | "cancelled";
      startsAt: string;
      expiresAt: string;
    },
  ): Promise<StudentSubscriptionRow>;

  create(data: {
    userId: string;
    planId: string;
    status: "active" | "expired" | "cancelled";
    startsAt: string;
    expiresAt: string;
  }): Promise<StudentSubscriptionRow>;

  update(
    subscriptionId: string,
    data: Partial<{
      status: "active" | "expired" | "cancelled";
      startsAt: string;
      expiresAt: string;
    }>,
  ): Promise<StudentSubscriptionRow | undefined>;
}
