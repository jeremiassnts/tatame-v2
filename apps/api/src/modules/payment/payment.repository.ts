import type { InferSelectModel } from "drizzle-orm";
import type { payments } from "@tatame/db";

export type PaymentRow = InferSelectModel<typeof payments>;

export interface IPaymentRepository {
  create(data: {
    subscriptionId: string;
    userId: string;
    academyId: string;
    amountCents: number;
    method: "manual";
    confirmedBy: string;
    referenceMonth: string;
    notes: string | null;
    paidAt: Date;
  }): Promise<PaymentRow>;

  findByAcademy(
    academyId: string,
    opts: { subscriptionId?: string; userId?: string },
  ): Promise<PaymentRow[]>;

  /** `referenceMonth` is YYYY-MM-01 (billing period). */
  existsForSubscriptionReferenceMonth(
    subscriptionId: string,
    referenceMonth: string,
  ): Promise<boolean>;
}
