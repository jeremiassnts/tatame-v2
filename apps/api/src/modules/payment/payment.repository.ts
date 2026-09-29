import type { InferSelectModel } from "drizzle-orm";
import type { payments } from "@tatame/db";

export type PaymentRow = Omit<InferSelectModel<typeof payments>, "transferredAt">;

export type PaymentWithUser = PaymentRow & {
  userName: string;
};

/**
 * What an Asaas charge has to leave behind to be reconcilable. The webhook
 * carries the Asaas payment id and nothing else worth trusting, so everything
 * needed to write the payment row is stored when the charge is created.
 */
export type PendingAsaasPayment = {
  asaasPaymentId: string;
  subscriptionId: string;
  userId: string;
  academyId: string;
  referenceMonth: string;
  amountCents: number;
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
    dependentId?: string | null;
    asaasPaymentId?: string | null;
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

  findByAsaasPaymentId(asaasPaymentId: string): Promise<PaymentRow | undefined>;

  /** Idempotent: Asaas can answer a charge creation that already happened. */
  createPendingAsaas(data: PendingAsaasPayment): Promise<void>;

  findPendingAsaasByPaymentId(
    asaasPaymentId: string,
  ): Promise<PendingAsaasPayment | undefined>;

  /**
   * The open charge for a month, so a student asking twice is handed the
   * charge they already have instead of a second one.
   */
  findPendingAsaasBySubscriptionMonth(
    subscriptionId: string,
    referenceMonth: string,
  ): Promise<PendingAsaasPayment | undefined>;

  deletePendingAsaas(asaasPaymentId: string): Promise<void>;

  findByDependentId(dependentId: string): Promise<PaymentRow[]>;
}
