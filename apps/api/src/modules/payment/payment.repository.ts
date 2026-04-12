import type { InferSelectModel } from "drizzle-orm";
import type { payments } from "@tatame/db";

export type PaymentRow = Omit<InferSelectModel<typeof payments>, "transferredAt">;

export type PaymentWithUser = PaymentRow & {
  userName: string;
};

export interface IPaymentRepository {
  create(data: {
    subscriptionId: string;
    userId: string;
    academyId: string;
    amountCents: number;
    method: "manual" | "stripe" | "pix";
    confirmedBy: string | null;
    stripePaymentId: string | null;
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
    opts: { subscriptionId?: string; userId?: string; limit?: number },
  ): Promise<PaymentWithUser[]>;

  findByStripePaymentId(stripePaymentId: string): Promise<PaymentRow | undefined>;

  /** `referenceMonth` is YYYY-MM-01 (billing period). */
  existsForSubscriptionReferenceMonth(
    subscriptionId: string,
    referenceMonth: string,
  ): Promise<boolean>;

  sumByAcademyForMonth(
    academyId: string,
    referenceMonth: string,
  ): Promise<number>;

  createPendingPix(data: {
    pixQrCodeId: string;
    subscriptionId: string;
    userId: string;
    academyId: string;
    referenceMonth: string;
    amountCents: number;
  }): Promise<void>;

  findPendingPixByQrCodeId(pixQrCodeId: string): Promise<{
    subscriptionId: string;
    userId: string;
    academyId: string;
    referenceMonth: string;
    amountCents: number;
  } | undefined>;

  deletePendingPix(pixQrCodeId: string): Promise<void>;
}
