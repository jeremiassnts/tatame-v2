import { randomUUID } from "node:crypto";
import type {
  IManagerSubscriptionRepository,
  ManagerSubscriptionRow,
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

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    return this.rows.find((r) => r.stripeCustomerId === stripeCustomerId);
  }

  async findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    return this.rows.find((r) => r.stripeSubscriptionId === stripeSubscriptionId);
  }

  async create(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "past_due" | "canceled" | "incomplete";
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    currentPeriodEnd?: Date | null;
  }): Promise<ManagerSubscriptionRow> {
    const t = new Date();
    const row: ManagerSubscriptionRow = {
      id: randomUUID(),
      academyId: data.academyId,
      plan: data.plan,
      status: data.status,
      stripeCustomerId: data.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
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
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      currentPeriodEnd: Date | null;
      canceledAt: Date | null;
    }>,
  ): Promise<ManagerSubscriptionRow | undefined> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return undefined;
    if (data.plan !== undefined) row.plan = data.plan;
    if (data.status !== undefined) row.status = data.status;
    if (data.stripeCustomerId !== undefined)
      row.stripeCustomerId = data.stripeCustomerId;
    if (data.stripeSubscriptionId !== undefined)
      row.stripeSubscriptionId = data.stripeSubscriptionId;
    if (data.currentPeriodEnd !== undefined)
      row.currentPeriodEnd = data.currentPeriodEnd;
    if (data.canceledAt !== undefined) row.canceledAt = data.canceledAt;
    row.updatedAt = new Date();
    return row;
  }
}

