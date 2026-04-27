import { eq } from "drizzle-orm";
import { managerSubscriptions, type Database } from "@tatame/db";
import type {
  IManagerSubscriptionRepository,
  ManagerSubscriptionRow,
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

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(managerSubscriptions)
      .where(eq(managerSubscriptions.stripeCustomerId, stripeCustomerId))
      .limit(1);
    return row;
  }

  async findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(managerSubscriptions)
      .where(eq(managerSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .limit(1);
    return row;
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
    const rows = await this.db
      .insert(managerSubscriptions)
      .values({
        academyId: data.academyId,
        plan: data.plan,
        status: data.status,
        stripeCustomerId: data.stripeCustomerId ?? null,
        stripeSubscriptionId: data.stripeSubscriptionId ?? null,
        stripePriceId: data.stripePriceId ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        trialEndsAt: data.trialEndsAt ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Failed to create manager subscription");
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
    status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    currentPeriodEnd?: Date | null;
    trialEndsAt?: Date | null;
    canceledAt?: Date | null;
    subscribedAt?: Date;
  }): Promise<ManagerSubscriptionRow> {
    const rows = await this.db
      .insert(managerSubscriptions)
      .values({
        academyId: data.academyId,
        plan: data.plan,
        status: data.status,
        stripeCustomerId: data.stripeCustomerId ?? null,
        stripeSubscriptionId: data.stripeSubscriptionId ?? null,
        stripePriceId: data.stripePriceId ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        trialEndsAt: data.trialEndsAt ?? null,
        canceledAt: data.canceledAt ?? null,
        ...(data.subscribedAt ? { subscribedAt: data.subscribedAt } : {}),
      })
      .onConflictDoUpdate({
        target: managerSubscriptions.academyId,
        set: {
          plan: data.plan,
          status: data.status,
          stripeCustomerId: data.stripeCustomerId ?? null,
          stripeSubscriptionId: data.stripeSubscriptionId ?? null,
          stripePriceId: data.stripePriceId ?? null,
          currentPeriodEnd: data.currentPeriodEnd ?? null,
          trialEndsAt: data.trialEndsAt ?? null,
          canceledAt: data.canceledAt ?? null,
          ...(data.subscribedAt ? { subscribedAt: data.subscribedAt } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Failed to upsert manager subscription");
    return row;
  }
}
