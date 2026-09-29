import { and, count, eq, sql, sum, isNull, desc, inArray } from "drizzle-orm";
import {
  academies,
  academyMemberships,
  checkins,
  managerSubscriptions,
  payments,
  users,
  type Database,
} from "@tatame/db";
import type {
  AcademyDetailRow,
  AcademySummaryRow,
  AdminPaymentRow,
  DailyCheckinCount,
  IAdminRepository,
  ManagerSubscriptionCounts,
} from "./admin.repository.js";

export class PostgresAdminRepository implements IAdminRepository {
  constructor(private readonly db: Database) {}

  async countManagerSubscriptions(): Promise<ManagerSubscriptionCounts> {
    const rows = await this.db
      .select({
        plan: managerSubscriptions.plan,
        count: count(),
      })
      .from(managerSubscriptions)
      .where(eq(managerSubscriptions.status, "active"))
      .groupBy(managerSubscriptions.plan);

    let pro = 0;
    let free = 0;
    for (const row of rows) {
      if (row.plan === "pro") pro = row.count;
      else if (row.plan === "free") free = row.count;
    }
    return { total: pro + free, pro, free };
  }

  async countTotalUsers(): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(users)
      .where(isNull(users.deletedAt));
    return row?.count ?? 0;
  }

  async sumAppRevenueCents(): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(payments.amountCents) })
      .from(payments)
      .where(sql`${payments.method} IN ('card', 'pix')`);
    return Number(row?.total ?? 0);
  }

  async sumTransferredCents(): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(payments.amountCents) })
      .from(payments)
      .where(
        and(
          sql`${payments.method} IN ('card', 'pix')`,
          sql`${payments.transferredAt} IS NOT NULL`,
        ),
      );
    return Number(row?.total ?? 0);
  }

  async sumPendingTransferCents(): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(payments.amountCents) })
      .from(payments)
      .where(
        and(
          sql`${payments.method} IN ('card', 'pix')`,
          isNull(payments.transferredAt),
        ),
      );
    return Number(row?.total ?? 0);
  }

  async getDailyCheckins(days: number): Promise<DailyCheckinCount[]> {
    const rows = await this.db
      .select({
        date: checkins.date,
        count: count(),
      })
      .from(checkins)
      .where(sql`${checkins.date} >= CURRENT_DATE - ${days}::integer`)
      .groupBy(checkins.date)
      .orderBy(checkins.date);
    return rows.map((r) => ({ date: r.date, count: r.count }));
  }

  async listAcademies(): Promise<AcademySummaryRow[]> {
    const rows = await this.db
      .select({
        id: academies.id,
        name: academies.name,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerPhone: users.phone,
        managerPlan: managerSubscriptions.plan,
        managerPlanStatus: managerSubscriptions.status,
      })
      .from(academies)
      .innerJoin(users, eq(academies.ownerId, users.id))
      .leftJoin(managerSubscriptions, eq(academies.id, managerSubscriptions.academyId));

    const result: AcademySummaryRow[] = [];
    for (const row of rows) {
      const [studentsRow] = await this.db
        .select({ count: count() })
        .from(academyMemberships)
        .where(
          and(
            eq(academyMemberships.academyId, row.id),
            eq(academyMemberships.role, "student"),
            eq(academyMemberships.status, "active"),
          ),
        );

      const [pendingRow] = await this.db
        .select({ total: sum(payments.amountCents) })
        .from(payments)
        .where(
          and(
            eq(payments.academyId, row.id),
            sql`${payments.method} IN ('card', 'pix')`,
            isNull(payments.transferredAt),
          ),
        );

      result.push({
        ...row,
        studentCount: studentsRow?.count ?? 0,
        pendingTransferCents: Number(pendingRow?.total ?? 0),
      });
    }

    return result;
  }

  async getAcademyDetail(academyId: string): Promise<AcademyDetailRow | undefined> {
    const [row] = await this.db
      .select({
        id: academies.id,
        name: academies.name,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerPhone: users.phone,
        managerPlan: managerSubscriptions.plan,
        managerPlanStatus: managerSubscriptions.status,
      })
      .from(academies)
      .innerJoin(users, eq(academies.ownerId, users.id))
      .leftJoin(managerSubscriptions, eq(academies.id, managerSubscriptions.academyId))
      .where(eq(academies.id, academyId));
    return row ?? undefined;
  }

  async countStudentsByAcademy(academyId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(academyMemberships)
      .where(
        and(
          eq(academyMemberships.academyId, academyId),
          eq(academyMemberships.role, "student"),
          eq(academyMemberships.status, "active"),
        ),
      );
    return row?.count ?? 0;
  }

  async sumAcademyRevenueCentsForMonth(academyId: string, referenceMonth: string): Promise<number> {
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

  async sumAcademyTransferredCents(academyId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(payments.amountCents) })
      .from(payments)
      .where(
        and(
          eq(payments.academyId, academyId),
          sql`${payments.method} IN ('card', 'pix')`,
          sql`${payments.transferredAt} IS NOT NULL`,
        ),
      );
    return Number(row?.total ?? 0);
  }

  async sumAcademyPendingTransferCents(academyId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(payments.amountCents) })
      .from(payments)
      .where(
        and(
          eq(payments.academyId, academyId),
          sql`${payments.method} IN ('card', 'pix')`,
          isNull(payments.transferredAt),
        ),
      );
    return Number(row?.total ?? 0);
  }

  async listAcademyPayments(
    academyId: string,
    opts: { limit: number; offset: number },
  ): Promise<{ items: AdminPaymentRow[]; total: number }> {
    const [totalRow] = await this.db
      .select({ count: count() })
      .from(payments)
      .where(eq(payments.academyId, academyId));

    const items = await this.db
      .select({
        id: payments.id,
        userName: users.name,
        amountCents: payments.amountCents,
        method: payments.method,
        referenceMonth: payments.referenceMonth,
        paidAt: payments.paidAt,
        transferredAt: payments.transferredAt,
      })
      .from(payments)
      .innerJoin(users, eq(payments.userId, users.id))
      .where(eq(payments.academyId, academyId))
      .orderBy(desc(payments.paidAt))
      .limit(opts.limit)
      .offset(opts.offset);

    return { items, total: totalRow?.count ?? 0 };
  }

  async markTransferred(paymentIds: string[]): Promise<number> {
    if (paymentIds.length === 0) return 0;

    const result = await this.db
      .update(payments)
      .set({ transferredAt: new Date() })
      .where(
        and(
          inArray(payments.id, paymentIds),
          sql`${payments.method} IN ('card', 'pix')`,
          isNull(payments.transferredAt),
        ),
      )
      .returning({ id: payments.id });

    return result.length;
  }
}
