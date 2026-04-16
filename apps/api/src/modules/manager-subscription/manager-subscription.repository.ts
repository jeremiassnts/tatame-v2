import type { InferSelectModel } from "drizzle-orm";
import type { managerSubscriptions } from "@tatame/db";

export type ManagerSubscriptionRow = InferSelectModel<
  typeof managerSubscriptions
>;

export type ManagerSubscriptionStore = "app_store" | "play_store";

export interface IManagerSubscriptionRepository {
  findByAcademyId(
    academyId: string,
  ): Promise<ManagerSubscriptionRow | undefined>;

  findByRevenueCatAppUserId(
    appUserId: string,
  ): Promise<ManagerSubscriptionRow | undefined>;

  create(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "past_due" | "canceled" | "incomplete";
    revenuecatAppUserId?: string | null;
    productId?: string | null;
    originalTransactionId?: string | null;
    store?: ManagerSubscriptionStore | null;
    currentPeriodEnd?: Date | null;
  }): Promise<ManagerSubscriptionRow>;

  update(
    id: string,
    data: Partial<{
      plan: "free" | "pro";
      status: "active" | "past_due" | "canceled" | "incomplete";
      revenuecatAppUserId: string | null;
      productId: string | null;
      originalTransactionId: string | null;
      store: ManagerSubscriptionStore | null;
      currentPeriodEnd: Date | null;
      canceledAt: Date | null;
      subscribedAt: Date;
    }>,
  ): Promise<ManagerSubscriptionRow | undefined>;

  upsertByAcademy(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "past_due" | "canceled" | "incomplete";
    revenuecatAppUserId?: string | null;
    productId?: string | null;
    originalTransactionId?: string | null;
    store?: ManagerSubscriptionStore | null;
    currentPeriodEnd?: Date | null;
    canceledAt?: Date | null;
    subscribedAt?: Date;
  }): Promise<ManagerSubscriptionRow>;
}
