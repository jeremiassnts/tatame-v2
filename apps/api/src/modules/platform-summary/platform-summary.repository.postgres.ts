import {
  academies,
  academyMemberships,
  checkins,
  classes,
  managerSubscriptions,
  payments,
  pendingAsaasPayments,
  pendingPixPayments,
  studentSubscriptions,
  subscriptionPlans,
  users,
  type Database,
} from "@tatame/db";
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  isNull,
  lt,
  lte,
  notExists,
  sql,
  sum,
} from "drizzle-orm";
import type {
  AcademyClassAttendance,
  AcademyAmount,
  AcademyCount,
  AcademyMethodAmount,
  AcademyRow,
  DayWindow,
  IPlatformSummaryRepository,
  ManagerSubscriptionCounts,
  NewAcademyRow,
  PaymentMethod,
  PlatformTotals,
} from "./platform-summary.repository.js";

/** `sum()` comes back as a numeric string, or null when no rows matched. */
function cents(value: string | null): number {
  return Number(value ?? 0);
}

export class PostgresPlatformSummaryRepository
  implements IPlatformSummaryRepository
{
  constructor(private readonly db: Database) {}

  // --- snapshot -----------------------------------------------------------

  async listAcademies(): Promise<AcademyRow[]> {
    const rows = await this.db
      .select({
        id: academies.id,
        name: academies.name,
        ownerName: users.name,
        managerPlan: managerSubscriptions.plan,
      })
      .from(academies)
      .innerJoin(users, eq(academies.ownerId, users.id))
      .leftJoin(
        managerSubscriptions,
        eq(academies.id, managerSubscriptions.academyId),
      )
      .orderBy(academies.name);
    return rows;
  }

  async activeStudentsPerAcademy(): Promise<AcademyCount[]> {
    const rows = await this.db
      .select({ academyId: academyMemberships.academyId, count: count() })
      .from(academyMemberships)
      .where(
        and(
          eq(academyMemberships.role, "student"),
          eq(academyMemberships.status, "active"),
        ),
      )
      .groupBy(academyMemberships.academyId);
    return rows;
  }

  async overdueStudentsPerAcademy(
    referenceMonth: string,
    today: string,
  ): Promise<AcademyCount[]> {
    const rows = await this.db
      .select({
        academyId: subscriptionPlans.academyId,
        count: countDistinct(studentSubscriptions.userId),
      })
      .from(studentSubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(studentSubscriptions.planId, subscriptionPlans.id),
      )
      .where(
        and(
          eq(studentSubscriptions.status, "active"),
          gte(studentSubscriptions.expiresAt, today),
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(payments)
              .where(
                and(
                  eq(payments.subscriptionId, studentSubscriptions.id),
                  eq(payments.referenceMonth, referenceMonth),
                ),
              ),
          ),
        ),
      )
      .groupBy(subscriptionPlans.academyId);
    return rows;
  }

  async pendingTransfersPerAcademy(): Promise<AcademyMethodAmount[]> {
    const rows = await this.db
      .select({
        academyId: payments.academyId,
        method: payments.method,
        count: count(),
        amountCents: sum(payments.amountCents),
      })
      .from(payments)
      .where(
        and(
          sql`${payments.method} IN ('card', 'pix')`,
          isNull(payments.transferredAt),
        ),
      )
      .groupBy(payments.academyId, payments.method);
    return rows.map((r) => ({
      academyId: r.academyId,
      method: r.method as PaymentMethod,
      count: r.count,
      amountCents: cents(r.amountCents),
    }));
  }

  async activeSubscriptionsPerAcademy(today: string): Promise<AcademyCount[]> {
    const rows = await this.db
      .select({ academyId: subscriptionPlans.academyId, count: count() })
      .from(studentSubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(studentSubscriptions.planId, subscriptionPlans.id),
      )
      .where(
        and(
          eq(studentSubscriptions.status, "active"),
          gte(studentSubscriptions.expiresAt, today),
        ),
      )
      .groupBy(subscriptionPlans.academyId);
    return rows;
  }

  async expiringSubscriptionsPerAcademy(
    from: string,
    to: string,
  ): Promise<AcademyCount[]> {
    const rows = await this.db
      .select({ academyId: subscriptionPlans.academyId, count: count() })
      .from(studentSubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(studentSubscriptions.planId, subscriptionPlans.id),
      )
      .where(
        and(
          eq(studentSubscriptions.status, "active"),
          gte(studentSubscriptions.expiresAt, from),
          lte(studentSubscriptions.expiresAt, to),
        ),
      )
      .groupBy(subscriptionPlans.academyId);
    return rows;
  }

  async countManagerSubscriptions(): Promise<ManagerSubscriptionCounts> {
    const rows = await this.db
      .select({ plan: managerSubscriptions.plan, count: count() })
      .from(managerSubscriptions)
      .where(eq(managerSubscriptions.status, "active"))
      .groupBy(managerSubscriptions.plan);

    let pro = 0;
    let free = 0;
    for (const row of rows) {
      if (row.plan === "pro") pro = row.count;
      else if (row.plan === "free") free = row.count;
    }
    return { pro, free };
  }

  async platformTotals(): Promise<PlatformTotals> {
    const [userRow] = await this.db
      .select({ count: count() })
      .from(users)
      .where(isNull(users.deletedAt));
    const [academyRow] = await this.db
      .select({ count: count() })
      .from(academies);
    const [grossRow] = await this.db
      .select({ total: sum(payments.amountCents) })
      .from(payments);

    return {
      totalUsers: userRow?.count ?? 0,
      totalAcademies: academyRow?.count ?? 0,
      totalGrossCents: cents(grossRow?.total ?? null),
    };
  }

  // --- day-scoped ---------------------------------------------------------

  async newStudentsPerAcademy(window: DayWindow): Promise<AcademyCount[]> {
    const rows = await this.db
      .select({ academyId: academyMemberships.academyId, count: count() })
      .from(academyMemberships)
      .where(
        and(
          eq(academyMemberships.role, "student"),
          gte(academyMemberships.joinedAt, window.start),
          lt(academyMemberships.joinedAt, window.end),
        ),
      )
      .groupBy(academyMemberships.academyId);
    return rows;
  }

  async paymentsPerAcademy(window: DayWindow): Promise<AcademyMethodAmount[]> {
    const rows = await this.db
      .select({
        academyId: payments.academyId,
        method: payments.method,
        count: count(),
        amountCents: sum(payments.amountCents),
      })
      .from(payments)
      .where(and(gte(payments.paidAt, window.start), lt(payments.paidAt, window.end)))
      .groupBy(payments.academyId, payments.method);
    return rows.map((r) => ({
      academyId: r.academyId,
      method: r.method as PaymentMethod,
      count: r.count,
      amountCents: cents(r.amountCents),
    }));
  }

  async unpaidPixPerAcademy(window: DayWindow): Promise<AcademyAmount[]> {
    // Two tables, one number. `pending_pix_payments` is AbacatePay's and stops
    // gaining rows at the cutover — `POST /payments/checkout/pix`, the only
    // thing that wrote it, was deleted in B9. `pending_asaas_payments` is the
    // rail that replaced it. Reading only the first would leave this reporting
    // zero unpaid Pix forever while real ones pile up in the second, which is
    // worse than not reporting at all: the metric keeps rendering and stops
    // measuring. Both are read until the AbacatePay rows have drained.
    const [abacatePay, asaas] = await Promise.all([
      this.db
        .select({
          academyId: pendingPixPayments.academyId,
          count: count(),
          amountCents: sum(pendingPixPayments.amountCents),
        })
        .from(pendingPixPayments)
        .where(
          and(
            gte(pendingPixPayments.createdAt, window.start),
            lt(pendingPixPayments.createdAt, window.end),
            // The webhook records the paid Pix with the QR code id as its
            // `stripePaymentId`; no such row means the QR was never paid.
            notExists(
              this.db
                .select({ one: sql`1` })
                .from(payments)
                .where(
                  eq(payments.stripePaymentId, pendingPixPayments.pixQrCodeId),
                ),
            ),
          ),
        )
        .groupBy(pendingPixPayments.academyId),
      this.db
        .select({
          academyId: pendingAsaasPayments.academyId,
          count: count(),
          amountCents: sum(pendingAsaasPayments.amountCents),
        })
        .from(pendingAsaasPayments)
        .where(
          and(
            gte(pendingAsaasPayments.createdAt, window.start),
            lt(pendingAsaasPayments.createdAt, window.end),
            // A `checkout` row is a card session, not a Pix. Counting it would
            // quietly change what this number means.
            eq(pendingAsaasPayments.kind, "payment"),
            // On this rail the pending row's handle *is* the payment id, so a
            // recorded payment matches it directly. B6 deletes the row when it
            // records the payment; this is what makes the number right anyway
            // when that delete is the thing that failed.
            notExists(
              this.db
                .select({ one: sql`1` })
                .from(payments)
                .where(
                  eq(
                    payments.asaasPaymentId,
                    pendingAsaasPayments.asaasPaymentId,
                  ),
                ),
            ),
          ),
        )
        .groupBy(pendingAsaasPayments.academyId),
    ]);

    const perAcademy = new Map<string, { count: number; amountCents: number }>();
    for (const row of [...abacatePay, ...asaas]) {
      const sofar = perAcademy.get(row.academyId) ?? { count: 0, amountCents: 0 };
      perAcademy.set(row.academyId, {
        count: sofar.count + row.count,
        amountCents: sofar.amountCents + cents(row.amountCents),
      });
    }
    return [...perAcademy].map(([academyId, totals]) => ({
      academyId,
      ...totals,
    }));
  }

  async newSubscriptionsPerAcademy(window: DayWindow): Promise<AcademyCount[]> {
    const rows = await this.db
      .select({ academyId: subscriptionPlans.academyId, count: count() })
      .from(studentSubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(studentSubscriptions.planId, subscriptionPlans.id),
      )
      .where(
        and(
          gte(studentSubscriptions.createdAt, window.start),
          lt(studentSubscriptions.createdAt, window.end),
        ),
      )
      .groupBy(subscriptionPlans.academyId);
    return rows;
  }

  async canceledSubscriptionsPerAcademy(
    window: DayWindow,
  ): Promise<AcademyCount[]> {
    const rows = await this.db
      .select({ academyId: subscriptionPlans.academyId, count: count() })
      .from(studentSubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(studentSubscriptions.planId, subscriptionPlans.id),
      )
      .where(
        and(
          eq(studentSubscriptions.status, "cancelled"),
          gte(studentSubscriptions.updatedAt, window.start),
          lt(studentSubscriptions.updatedAt, window.end),
        ),
      )
      .groupBy(subscriptionPlans.academyId);
    return rows;
  }

  async checkinsPerAcademy(window: DayWindow): Promise<AcademyCount[]> {
    const rows = await this.db
      .select({ academyId: classes.academyId, count: count() })
      .from(checkins)
      .innerJoin(classes, eq(checkins.classId, classes.id))
      .where(eq(checkins.date, window.date))
      .groupBy(classes.academyId);
    return rows;
  }

  async classAttendancePerAcademy(
    window: DayWindow,
  ): Promise<AcademyClassAttendance[]> {
    const rows = await this.db
      .select({
        academyId: classes.academyId,
        className: classes.name,
        count: count(),
      })
      .from(checkins)
      .innerJoin(classes, eq(checkins.classId, classes.id))
      .where(eq(checkins.date, window.date))
      .groupBy(classes.academyId, classes.name)
      .orderBy(desc(count()));
    return rows;
  }

  async countNewUsers(window: DayWindow): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          gte(users.createdAt, window.start),
          lt(users.createdAt, window.end),
          isNull(users.deletedAt),
        ),
      );
    return row?.count ?? 0;
  }

  async listNewAcademies(window: DayWindow): Promise<NewAcademyRow[]> {
    const rows = await this.db
      .select({ id: academies.id, name: academies.name })
      .from(academies)
      .where(
        and(
          gte(academies.createdAt, window.start),
          lt(academies.createdAt, window.end),
        ),
      )
      .orderBy(academies.name);
    return rows;
  }

  /**
   * Best available proxy: there is no "pro activated at" column, so a row that
   * is on the Pro plan and was first subscribed inside the window counts. A
   * free account that upgrades later is invisible here.
   */
  async countNewProSubscriptions(window: DayWindow): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(managerSubscriptions)
      .where(
        and(
          eq(managerSubscriptions.plan, "pro"),
          gte(managerSubscriptions.subscribedAt, window.start),
          lt(managerSubscriptions.subscribedAt, window.end),
        ),
      );
    return row?.count ?? 0;
  }
}
