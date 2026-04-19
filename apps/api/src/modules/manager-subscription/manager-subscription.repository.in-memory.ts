import { randomUUID } from "node:crypto";
import type {
  IManagerSubscriptionRepository,
  ManagerSubscriptionRow,
  ManagerSubscriptionStore,
} from "./manager-subscription.repository.js";

export class InMemoryManagerSubscriptionRepository
  implements IManagerSubscriptionRepository
{
  constructor(private readonly rows: ManagerSubscriptionRow[] = []) {}

  async findByAcademyId(
    academyId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    return this.rows.find((r) => r.academyId === academyId);
  }

  async findByRevenueCatAppUserId(
    appUserId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    return this.rows.find((r) => r.revenuecatAppUserId === appUserId);
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
    const t = new Date();
    const row: ManagerSubscriptionRow = {
      id: randomUUID(),
      academyId: data.academyId,
      plan: data.plan,
      status: data.status,
      revenuecatAppUserId: data.revenuecatAppUserId ?? null,
      productId: data.productId ?? null,
      originalTransactionId: data.originalTransactionId ?? null,
      store: data.store ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      subscribedAt: t,
      canceledAt: null,
      createdAt: t,
      updatedAt: t,
    };
    this.rows.push(row);
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
    const row = this.rows.find((r) => r.id === id);
    if (!row) return undefined;
    if (data.plan !== undefined) row.plan = data.plan;
    if (data.status !== undefined) row.status = data.status;
    if (data.revenuecatAppUserId !== undefined)
      row.revenuecatAppUserId = data.revenuecatAppUserId;
    if (data.productId !== undefined) row.productId = data.productId;
    if (data.originalTransactionId !== undefined)
      row.originalTransactionId = data.originalTransactionId;
    if (data.store !== undefined) row.store = data.store;
    if (data.currentPeriodEnd !== undefined)
      row.currentPeriodEnd = data.currentPeriodEnd;
    if (data.canceledAt !== undefined) row.canceledAt = data.canceledAt;
    if (data.subscribedAt !== undefined) row.subscribedAt = data.subscribedAt;
    row.updatedAt = new Date();
    return row;
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
    const existing = await this.findByAcademyId(data.academyId);
    if (existing) {
      const updated = await this.update(existing.id, {
        plan: data.plan,
        status: data.status,
        revenuecatAppUserId: data.revenuecatAppUserId ?? null,
        productId: data.productId ?? null,
        originalTransactionId: data.originalTransactionId ?? null,
        store: data.store ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        canceledAt: data.canceledAt ?? null,
        ...(data.subscribedAt ? { subscribedAt: data.subscribedAt } : {}),
      });
      return updated!;
    }
    return this.create({
      academyId: data.academyId,
      plan: data.plan,
      status: data.status,
      revenuecatAppUserId: data.revenuecatAppUserId,
      productId: data.productId,
      originalTransactionId: data.originalTransactionId,
      store: data.store,
      currentPeriodEnd: data.currentPeriodEnd,
    });
  }
}
