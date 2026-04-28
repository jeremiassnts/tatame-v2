import type { InferSelectModel } from "drizzle-orm";
import type { managerSubscriptions } from "@tatame/db";

export type ManagerSubscriptionRow = InferSelectModel<
  typeof managerSubscriptions
>;

export interface IManagerSubscriptionRepository {
  findByAcademyId(
    academyId: string,
  ): Promise<ManagerSubscriptionRow | undefined>;

  findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<ManagerSubscriptionRow | undefined>;

  findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<ManagerSubscriptionRow | undefined>;

  create(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    currentPeriodEnd?: Date | null;
    trialEndsAt?: Date | null;
  }): Promise<ManagerSubscriptionRow>;

  update(
    id: string,
    data: Partial<{
      plan: "free" | "pro";
      status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      stripePriceId: string | null;
      currentPeriodEnd: Date | null;
      trialEndsAt: Date | null;
      canceledAt: Date | null;
      subscribedAt: Date;
    }>,
  ): Promise<ManagerSubscriptionRow | undefined>;

  upsertByAcademy(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    currentPeriodEnd?: Date | null;
    trialEndsAt?: Date | null;
    canceledAt?: Date | null;
    subscribedAt?: Date;
  }): Promise<ManagerSubscriptionRow>;
}
