import { randomUUID } from "node:crypto";
import type { IPaymentRepository, PaymentRow } from "./payment.repository.js";

export class InMemoryPaymentRepository implements IPaymentRepository {
  constructor(private readonly rows: PaymentRow[] = []) {}

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
    const t = new Date();
    const row: PaymentRow = {
      id: randomUUID(),
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
      createdAt: t,
    };
    this.rows.push(row);
    return row;
  }

  async findByAcademy(
    academyId: string,
    opts: { subscriptionId?: string; userId?: string },
  ): Promise<PaymentRow[]> {
    return this.rows
      .filter((p) => p.academyId === academyId)
      .filter(
        (p) =>
          !opts.subscriptionId || p.subscriptionId === opts.subscriptionId,
      )
      .filter((p) => !opts.userId || p.userId === opts.userId)
      .sort(
        (a, b) =>
          new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
      );
  }

  async existsForSubscriptionReferenceMonth(
    subscriptionId: string,
    referenceMonth: string,
  ): Promise<boolean> {
    return this.rows.some(
      (p) =>
        p.subscriptionId === subscriptionId &&
        p.referenceMonth === referenceMonth,
    );
  }
}
