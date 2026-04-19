import { eq } from "drizzle-orm";
import { managerSubscriptions, type Database } from "@tatame/db";
import type {
  IManagerSubscriptionRepository,
  ManagerSubscriptionRow,
  ManagerSubscriptionStore,
} from "./manager-subscription.repository.js";

export class PostgresManagerSubscriptionRepository
  implements IManagerSubscriptionRepository
{
  constructor(private readonly db: Database) {}

  async findByAcademyId(
    academyId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(managerSubscriptions)
      .where(eq(managerSubscriptions.academyId, academyId))
      .limit(1);
    return row;
  }

  async findByRevenueCatAppUserId(
    appUserId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(managerSubscriptions)
      .where(eq(managerSubscriptions.revenuecatAppUserId, appUserId))
      .limit(1);
    return row;
  }

  async create(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "past_due" | "canceled" | "incomplete";
    revenuecatAppUserId?: string | null;
    productId?: string | null;
    originalTransactionId?: string | null;
    store?: ManagerSubscriptionStore | null;
    currentPeriodEnd?: Date | null;
  }): Promise<ManagerSubscriptionRow> {
    const rows = await this.db
      .insert(managerSubscriptions)
      .values({
        academyId: data.academyId,
        plan: data.plan,
        status: data.status,
        revenuecatAppUserId: data.revenuecatAppUserId ?? null,
        productId: data.productId ?? null,
        originalTransactionId: data.originalTransactionId ?? null,
        store: data.store ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create manager subscription");
    }
    return row;
  }

  async update(
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
  ): Promise<ManagerSubscriptionRow | undefined> {
    const rows = await this.db
      .update(managerSubscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(managerSubscriptions.id, id))
      .returning();
    return rows[0];
  }

  async upsertByAcademy(data: {
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
  }): Promise<ManagerSubscriptionRow> {
    const rows = await this.db
      .insert(managerSubscriptions)
      .values({
        academyId: data.academyId,
        plan: data.plan,
        status: data.status,
        revenuecatAppUserId: data.revenuecatAppUserId ?? null,
        productId: data.productId ?? null,
        originalTransactionId: data.originalTransactionId ?? null,
        store: data.store ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        canceledAt: data.canceledAt ?? null,
        ...(data.subscribedAt ? { subscribedAt: data.subscribedAt } : {}),
      })
      .onConflictDoUpdate({
        target: managerSubscriptions.academyId,
        set: {
          plan: data.plan,
          status: data.status,
          revenuecatAppUserId: data.revenuecatAppUserId ?? null,
          productId: data.productId ?? null,
          originalTransactionId: data.originalTransactionId ?? null,
          store: data.store ?? null,
          currentPeriodEnd: data.currentPeriodEnd ?? null,
          canceledAt: data.canceledAt ?? null,
          ...(data.subscribedAt ? { subscribedAt: data.subscribedAt } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error("Failed to upsert manager subscription");
    }
    return row;
  }
}
