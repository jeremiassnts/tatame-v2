import type { InferSelectModel } from "drizzle-orm";
import type { payments } from "@tatame/db";

export type PaymentRow = InferSelectModel<typeof payments>;

export type PaymentWithUser = PaymentRow & {
  userName: string;
};

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
    opts: { subscriptionId?: string; userId?: string; limit?: number },
  ): Promise<PaymentRow[]>;

  findByAcademyWithUser(
    academyId: string,
    opts: { limit?: number },
  ): Promise<PaymentWithUser[]>;

  /** `referenceMonth` is YYYY-MM-01 (billing period). */
  existsForSubscriptionReferenceMonth(
    subscriptionId: string,
    referenceMonth: string,
  ): Promise<boolean>;

  sumByAcademyForMonth(
    academyId: string,
    referenceMonth: string,
  ): Promise<number>;
}
