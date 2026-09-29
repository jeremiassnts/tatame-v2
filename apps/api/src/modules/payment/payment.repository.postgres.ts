import { and, desc, eq, sum } from "drizzle-orm";
import {
  payments,
  pendingAsaasPayments,
  pendingPixPayments,
  users,
  type Database,
} from "@tatame/db";
import type {
  IPaymentRepository,
  PaymentRow,
  PaymentWithUser,
  PendingAsaasPayment,
} from "./payment.repository.js";

const PENDING_ASAAS_COLUMNS = {
  asaasPaymentId: pendingAsaasPayments.asaasPaymentId,
  kind: pendingAsaasPayments.kind,
  subscriptionId: pendingAsaasPayments.subscriptionId,
  userId: pendingAsaasPayments.userId,
  academyId: pendingAsaasPayments.academyId,
  referenceMonth: pendingAsaasPayments.referenceMonth,
  amountCents: pendingAsaasPayments.amountCents,
};

export class PostgresPaymentRepository implements IPaymentRepository {
  constructor(private readonly db: Database) {}

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
    const [row] = await this.db
      .insert(payments)
      .values({
        subscriptionId: data.subscriptionId,
        userId: data.userId,
        academyId: data.academyId,
        amountCents: data.amountCents,
        method: data.method,
        confirmedBy: data.confirmedBy,
        stripePaymentId: data.stripePaymentId,
        referenceMonth: data.referenceMonth,
        notes: data.notes,
        paidAt: data.paidAt,
        dependentId: data.dependentId ?? null,
        asaasPaymentId: data.asaasPaymentId ?? null,
      })
      .returning();
    if (!row) throw new Error("Failed to create payment");
    return row;
  }

  async findByStripePaymentId(
    stripePaymentId: string,
  ): Promise<PaymentRow | undefined> {
    const [row] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.stripePaymentId, stripePaymentId))
      .limit(1);
    return row;
  }

  async findByAcademy(
    academyId: string,
    opts: { subscriptionId?: string; userId?: string; limit?: number },
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
    const query = this.db
      .select({
        id: payments.id,
        subscriptionId: payments.subscriptionId,
        userId: payments.userId,
        academyId: payments.academyId,
        dependentId: payments.dependentId,
        amountCents: payments.amountCents,
        method: payments.method,
        confirmedBy: payments.confirmedBy,
        stripePaymentId: payments.stripePaymentId,
        asaasPaymentId: payments.asaasPaymentId,
        referenceMonth: payments.referenceMonth,
        notes: payments.notes,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(whereClause)
      .orderBy(desc(payments.paidAt));
    if (opts.limit) {
      return query.limit(opts.limit);
    }
    return query;
  }

  async findByAcademyWithUser(
    academyId: string,
    opts: { subscriptionId?: string; userId?: string; limit?: number },
  ): Promise<PaymentWithUser[]> {
    const conditions = [eq(payments.academyId, academyId)];
    if (opts.subscriptionId) {
      conditions.push(eq(payments.subscriptionId, opts.subscriptionId));
    }
    if (opts.userId) {
      conditions.push(eq(payments.userId, opts.userId));
    }
    const whereClause =
      conditions.length === 1 ? conditions[0]! : and(...conditions);

    const query = this.db
      .select({
        id: payments.id,
        subscriptionId: payments.subscriptionId,
        userId: payments.userId,
        academyId: payments.academyId,
        dependentId: payments.dependentId,
        amountCents: payments.amountCents,
        method: payments.method,
        confirmedBy: payments.confirmedBy,
        stripePaymentId: payments.stripePaymentId,
        asaasPaymentId: payments.asaasPaymentId,
        referenceMonth: payments.referenceMonth,
        notes: payments.notes,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        userName: users.name,
      })
      .from(payments)
      .innerJoin(users, eq(payments.userId, users.id))
      .where(whereClause)
      .orderBy(desc(payments.paidAt));
    if (opts.limit) {
      return query.limit(opts.limit);
    }
    return query;
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

  async sumByAcademyForMonth(
    academyId: string,
    referenceMonth: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(payments.amountCents) })
      .from(payments)
      .where(
        and(
          eq(payments.academyId, academyId),
          eq(payments.referenceMonth, referenceMonth),
        ),
      );
    return Number(row?.total ?? 0);
  }

  async createPendingPix(data: {
    pixQrCodeId: string;
    subscriptionId: string;
    userId: string;
    academyId: string;
    referenceMonth: string;
    amountCents: number;
  }): Promise<void> {
    await this.db.insert(pendingPixPayments).values(data).onConflictDoNothing();
  }

  async findPendingPixByQrCodeId(pixQrCodeId: string) {
    const [row] = await this.db
      .select({
        subscriptionId: pendingPixPayments.subscriptionId,
        userId: pendingPixPayments.userId,
        academyId: pendingPixPayments.academyId,
        referenceMonth: pendingPixPayments.referenceMonth,
        amountCents: pendingPixPayments.amountCents,
      })
      .from(pendingPixPayments)
      .where(eq(pendingPixPayments.pixQrCodeId, pixQrCodeId))
      .limit(1);
    return row;
  }

  async deletePendingPix(pixQrCodeId: string): Promise<void> {
    await this.db
      .delete(pendingPixPayments)
      .where(eq(pendingPixPayments.pixQrCodeId, pixQrCodeId));
  }

  async findByAsaasPaymentId(
    asaasPaymentId: string,
  ): Promise<PaymentRow | undefined> {
    const [row] = await this.db
      .select({
        id: payments.id,
        subscriptionId: payments.subscriptionId,
        userId: payments.userId,
        academyId: payments.academyId,
        dependentId: payments.dependentId,
        amountCents: payments.amountCents,
        method: payments.method,
        confirmedBy: payments.confirmedBy,
        stripePaymentId: payments.stripePaymentId,
        asaasPaymentId: payments.asaasPaymentId,
        referenceMonth: payments.referenceMonth,
        notes: payments.notes,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.asaasPaymentId, asaasPaymentId))
      .limit(1);
    return row;
  }

  async createPendingAsaas(data: PendingAsaasPayment): Promise<void> {
    await this.db
      .insert(pendingAsaasPayments)
      .values(data)
      .onConflictDoNothing();
  }

  async findPendingAsaasByPaymentId(
    asaasPaymentId: string,
  ): Promise<PendingAsaasPayment | undefined> {
    const [row] = await this.db
      .select(PENDING_ASAAS_COLUMNS)
      .from(pendingAsaasPayments)
      .where(eq(pendingAsaasPayments.asaasPaymentId, asaasPaymentId))
      .limit(1);
    return row;
  }

  async findPendingAsaasBySubscriptionMonth(
    subscriptionId: string,
    referenceMonth: string,
  ): Promise<PendingAsaasPayment | undefined> {
    const [row] = await this.db
      .select(PENDING_ASAAS_COLUMNS)
      .from(pendingAsaasPayments)
      .where(
        and(
          eq(pendingAsaasPayments.subscriptionId, subscriptionId),
          eq(pendingAsaasPayments.referenceMonth, referenceMonth),
        ),
      )
      .limit(1);
    return row;
  }

  async deletePendingAsaas(asaasPaymentId: string): Promise<void> {
    await this.db
      .delete(pendingAsaasPayments)
      .where(eq(pendingAsaasPayments.asaasPaymentId, asaasPaymentId));
  }

  async findByDependentId(dependentId: string): Promise<PaymentRow[]> {
    return this.db
      .select({
        id: payments.id,
        subscriptionId: payments.subscriptionId,
        userId: payments.userId,
        academyId: payments.academyId,
        dependentId: payments.dependentId,
        amountCents: payments.amountCents,
        method: payments.method,
        confirmedBy: payments.confirmedBy,
        stripePaymentId: payments.stripePaymentId,
        asaasPaymentId: payments.asaasPaymentId,
        referenceMonth: payments.referenceMonth,
        notes: payments.notes,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.dependentId, dependentId))
      .orderBy(desc(payments.paidAt));
  }
}
