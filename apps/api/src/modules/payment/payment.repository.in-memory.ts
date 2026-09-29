import { randomUUID } from "node:crypto";
import type {
  IPaymentRepository,
  PaymentRow,
  PaymentWithUser,
  PendingAsaasPayment,
} from "./payment.repository.js";

export class InMemoryPaymentRepository implements IPaymentRepository {
  constructor(private readonly rows: PaymentRow[] = []) {}

  async create(data: {
    subscriptionId: string;
    userId: string;
    academyId: string;
    amountCents: number;
    method: "manual" | "card" | "pix";
    confirmedBy: string | null;
    stripePaymentId: string | null;
    referenceMonth: string;
    notes: string | null;
    paidAt: Date;
    dependentId?: string | null;
    asaasPaymentId?: string | null;
  }): Promise<PaymentRow> {
    const t = new Date();
    const row: PaymentRow = {
      id: randomUUID(),
      subscriptionId: data.subscriptionId,
      userId: data.userId,
      academyId: data.academyId,
      dependentId: data.dependentId ?? null,
      amountCents: data.amountCents,
      method: data.method,
      confirmedBy: data.confirmedBy,
      stripePaymentId: data.stripePaymentId,
      asaasPaymentId: data.asaasPaymentId ?? null,
      referenceMonth: data.referenceMonth,
      notes: data.notes,
      paidAt: data.paidAt,
      createdAt: t,
    };
    this.rows.push(row);
    return row;
  }

  async findByStripePaymentId(
    stripePaymentId: string,
  ): Promise<PaymentRow | undefined> {
    return this.rows.find((p) => p.stripePaymentId === stripePaymentId);
  }

  async findByAcademy(
    academyId: string,
    opts: { subscriptionId?: string; userId?: string; limit?: number },
  ): Promise<PaymentRow[]> {
    const sorted = this.rows
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
    if (opts.limit) {
      return sorted.slice(0, opts.limit);
    }
    return sorted;
  }

  async findByAcademyWithUser(
    _academyId: string,
    _opts: { limit?: number },
  ): Promise<PaymentWithUser[]> {
    return [];
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

  async sumByAcademyForMonth(
    academyId: string,
    referenceMonth: string,
  ): Promise<number> {
    return this.rows
      .filter(
        (p) =>
          p.academyId === academyId && p.referenceMonth === referenceMonth,
      )
      .reduce((acc, p) => acc + p.amountCents, 0);
  }

  private pendingPix = new Map<string, { subscriptionId: string; userId: string; academyId: string; referenceMonth: string; amountCents: number }>();

  async createPendingPix(data: {
    pixQrCodeId: string;
    subscriptionId: string;
    userId: string;
    academyId: string;
    referenceMonth: string;
    amountCents: number;
  }): Promise<void> {
    this.pendingPix.set(data.pixQrCodeId, data);
  }

  async findPendingPixByQrCodeId(pixQrCodeId: string) {
    return this.pendingPix.get(pixQrCodeId);
  }

  async deletePendingPix(pixQrCodeId: string): Promise<void> {
    this.pendingPix.delete(pixQrCodeId);
  }

  async findByAsaasPaymentId(
    asaasPaymentId: string,
  ): Promise<PaymentRow | undefined> {
    return this.rows.find((p) => p.asaasPaymentId === asaasPaymentId);
  }

  private pendingAsaas = new Map<string, PendingAsaasPayment>();

  async createPendingAsaas(data: PendingAsaasPayment): Promise<void> {
    // Mirrors `onConflictDoNothing`: the first write for an id wins.
    if (this.pendingAsaas.has(data.asaasPaymentId)) return;
    this.pendingAsaas.set(data.asaasPaymentId, data);
  }

  async findPendingAsaasByPaymentId(
    asaasPaymentId: string,
  ): Promise<PendingAsaasPayment | undefined> {
    return this.pendingAsaas.get(asaasPaymentId);
  }

  async findPendingAsaasBySubscriptionMonth(
    subscriptionId: string,
    referenceMonth: string,
  ): Promise<PendingAsaasPayment | undefined> {
    return [...this.pendingAsaas.values()].find(
      (p) =>
        p.subscriptionId === subscriptionId &&
        p.referenceMonth === referenceMonth,
    );
  }

  async deletePendingAsaas(asaasPaymentId: string): Promise<void> {
    this.pendingAsaas.delete(asaasPaymentId);
  }

  async findByDependentId(dependentId: string): Promise<PaymentRow[]> {
    return this.rows
      .filter((p) => p.dependentId === dependentId)
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  }
}
