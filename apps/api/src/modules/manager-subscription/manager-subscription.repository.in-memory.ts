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
    return this.rows.find(
      (r) => r.stripeSubscriptionId === stripeSubscriptionId,
    );
  }

  async create(data: {
    academyId: string;
    plan: "free" | "pro";
    status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    currentPeriodEnd?: Date | null;
    trialEndsAt?: Date | null;
  }): Promise<ManagerSubscriptionRow> {
    const t = new Date();
    const row: ManagerSubscriptionRow = {
      id: randomUUID(),
      academyId: data.academyId,
      plan: data.plan,
      status: data.status,
      stripeCustomerId: data.stripeCustomerId ?? null,
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      stripePriceId: data.stripePriceId ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      trialEndsAt: data.trialEndsAt ?? null,
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
      status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      stripePriceId: string | null;
      currentPeriodEnd: Date | null;
      trialEndsAt: Date | null;
      canceledAt: Date | null;
      subscribedAt: Date;
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
    if (data.stripePriceId !== undefined) row.stripePriceId = data.stripePriceId;
    if (data.currentPeriodEnd !== undefined)
      row.currentPeriodEnd = data.currentPeriodEnd;
    if (data.trialEndsAt !== undefined) row.trialEndsAt = data.trialEndsAt;
    if (data.canceledAt !== undefined) row.canceledAt = data.canceledAt;
    if (data.subscribedAt !== undefined) row.subscribedAt = data.subscribedAt;
    row.updatedAt = new Date();
    return row;
  }

  async upsertByAcademy(data: {
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
  }): Promise<ManagerSubscriptionRow> {
    const existing = await this.findByAcademyId(data.academyId);
    if (existing) {
      const updated = await this.update(existing.id, {
        plan: data.plan,
        status: data.status,
        stripeCustomerId: data.stripeCustomerId ?? null,
        stripeSubscriptionId: data.stripeSubscriptionId ?? null,
        stripePriceId: data.stripePriceId ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        trialEndsAt: data.trialEndsAt ?? null,
        canceledAt: data.canceledAt ?? null,
        ...(data.subscribedAt ? { subscribedAt: data.subscribedAt } : {}),
      });
      return updated!;
    }
    return this.create({
      academyId: data.academyId,
      plan: data.plan,
      status: data.status,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      stripePriceId: data.stripePriceId,
      currentPeriodEnd: data.currentPeriodEnd,
      trialEndsAt: data.trialEndsAt,
    });
  }
}
