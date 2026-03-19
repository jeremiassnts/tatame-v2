import { and, desc, eq } from "drizzle-orm";
import { payments, type Database } from "@tatame/db";
import type { IPaymentRepository, PaymentRow } from "./payment.repository.js";

export class PostgresPaymentRepository implements IPaymentRepository {
  constructor(private readonly db: Database) {}

  async create(data: {
    subscriptionId: string;
    userId: string;
    academyId: string;
    amountCents: number;
    method: "manual";
    confirmedBy: string;
    referenceMonth: string;
    notes: string | null;
    paidAt: Date;
  }): Promise<PaymentRow> {
    const [row] = await this.db
      .insert(payments)
      .values({
        subscriptionId: data.subscriptionId,
        userId: data.userId,
        academyId: data.academyId,
        amountCents: data.amountCents,
        method: data.method,
        confirmedBy: data.confirmedBy,
        stripePaymentId: null,
        referenceMonth: data.referenceMonth,
        notes: data.notes,
        paidAt: data.paidAt,
      })
      .returning();
    if (!row) throw new Error("Failed to create payment");
    return row;
  }

  async findByAcademy(
    academyId: string,
    opts: { subscriptionId?: string; userId?: string },
  ): Promise<PaymentRow[]> {
    const conditions = [eq(payments.academyId, academyId)];
    if (opts.subscriptionId) {
      conditions.push(eq(payments.subscriptionId, opts.subscriptionId));
    }
    if (opts.userId) {
      conditions.push(eq(payments.userId, opts.userId));
    }
    const whereClause =
      conditions.length === 1 ? conditions[0]! : and(...conditions);
    return this.db
      .select()
      .from(payments)
      .where(whereClause)
      .orderBy(desc(payments.paidAt));
  }

  async existsForSubscriptionReferenceMonth(
    subscriptionId: string,
    referenceMonth: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.subscriptionId, subscriptionId),
          eq(payments.referenceMonth, referenceMonth),
        ),
      )
      .limit(1);
    return !!row;
  }
}
