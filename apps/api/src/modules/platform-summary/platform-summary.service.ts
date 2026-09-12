import { processorFeeCents } from "@tatame/config";
import type {
  AcademySummary,
  DailyPlatformSummaryProps,
  SummaryMethodTotal,
  SummaryMoney,
} from "@tatame/email";
import { log } from "../../telemetry/logger.js";
import type { EmailService } from "../email/email.service.js";
import type {
  AcademyAmount,
  AcademyClassAttendance,
  AcademyCount,
  AcademyMethodAmount,
  DayWindow,
  IPlatformSummaryRepository,
  PaymentMethod,
} from "./platform-summary.repository.js";

/** BRT is UTC−3, no DST since 2019. */
const BRT_OFFSET_HOURS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_CLASSES = 3;
const EXPIRING_WINDOW_DAYS = 7;

/** The BRT calendar day that had already fully elapsed at `now`. */
export function previousBrtDate(now: Date): string {
  return addDays(brtDate(now), -1);
}

/** `now` as a `YYYY-MM-DD` BRT calendar date. */
function brtDate(now: Date): string {
  return new Date(now.getTime() - BRT_OFFSET_HOURS * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** `2026-09-11` → `[2026-09-11T03:00:00Z, 2026-09-12T03:00:00Z)`. */
export function brtDayWindow(date: string): DayWindow {
  const start = new Date(`${date}T${String(BRT_OFFSET_HOURS).padStart(2, "0")}:00:00Z`);
  return { date, start, end: new Date(start.getTime() + DAY_MS) };
}

function formatBrDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

/** First day of the month `date` falls in, as `YYYY-MM-01`. */
function monthOf(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function indexCounts(rows: AcademyCount[]): Map<string, number> {
  return new Map(rows.map((r) => [r.academyId, r.count]));
}

function groupByAcademy<T extends { academyId: string }>(
  rows: T[],
): Map<string, T[]> {
  const byAcademy = new Map<string, T[]>();
  for (const row of rows) {
    const existing = byAcademy.get(row.academyId);
    if (existing) existing.push(row);
    else byAcademy.set(row.academyId, [row]);
  }
  return byAcademy;
}

/**
 * Gross, processor fee and net for a set of payments.
 *
 * The fee is per transaction, not per amount, so a `count` of five card
 * payments carries five fixed R$0,39 charges. Applying the rate to the summed
 * amount once would understate the fee by `(count − 1) × R$0,39`, which is why
 * `count` is part of the input.
 */
export function splitMoney(rows: SummaryMethodTotal[]): SummaryMoney {
  let grossCents = 0;
  let feeCents = 0;
  for (const row of rows) {
    grossCents += row.amountCents;
    feeCents += perTransactionFee(row.method, row.amountCents, row.count);
  }
  return { grossCents, feeCents, netCents: grossCents - feeCents };
}

function perTransactionFee(
  method: PaymentMethod,
  amountCents: number,
  count: number,
): number {
  if (count <= 0) return 0;
  // The percentage part is linear in the amount, so charging it on the summed
  // amount is exact; the fixed part is charged `count` times. Splitting them
  // this way avoids inventing per-payment amounts the aggregate never returned.
  const fixedPerTransaction = processorFeeCents(method, 0);
  const percentOnTotal =
    processorFeeCents(method, amountCents) - fixedPerTransaction;
  return percentOnTotal + fixedPerTransaction * count;
}

/** Only `pix` and `stripe` flow through the platform; `manual` is cash. */
function transferable(rows: SummaryMethodTotal[]): SummaryMethodTotal[] {
  return rows.filter((r) => r.method !== "manual");
}

function toMethodTotals(rows: AcademyMethodAmount[]): SummaryMethodTotal[] {
  return rows
    .map((r) => ({
      method: r.method,
      count: r.count,
      amountCents: r.amountCents,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

/** Everything the report needs from one day, so it can be fetched twice. */
type DaySlice = {
  newStudents: Map<string, number>;
  payments: Map<string, AcademyMethodAmount[]>;
  unpaidPix: Map<string, AcademyAmount>;
  newSubscriptions: Map<string, number>;
  canceledSubscriptions: Map<string, number>;
  checkins: Map<string, number>;
  classAttendance: Map<string, AcademyClassAttendance[]>;
  newUsers: number;
  newAcademies: string[];
  newProSubscriptions: number;
};

export class PlatformSummaryService {
  constructor(
    private readonly repo: IPlatformSummaryRepository,
    private readonly emailService: EmailService | null,
    private readonly recipientEmail: string | undefined,
  ) {}

  /**
   * Builds the report for `referenceDate` (a BRT `YYYY-MM-DD`) and enqueues it.
   *
   * Returns whether an email was enqueued — `false` means the recipient or the
   * email pipeline is not configured, which is a valid local-dev state, not a
   * failure.
   */
  async sendDailySummary(referenceDate: string): Promise<boolean> {
    if (!this.recipientEmail || !this.emailService) {
      log.info("recipient or email service not configured, skipping", {
        component: "platform-summary",
        referenceDate,
      });
      return false;
    }

    const report = await this.buildReport(referenceDate);
    await this.emailService.sendDailyPlatformSummary(
      { ...report, email: this.recipientEmail },
      referenceDate,
    );
    log.info("daily summary enqueued", {
      component: "platform-summary",
      referenceDate,
      academies: report.academies.length,
    });
    return true;
  }

  async buildReport(referenceDate: string): Promise<DailyPlatformSummaryProps> {
    const window = brtDayWindow(referenceDate);
    const previousWindow = brtDayWindow(addDays(referenceDate, -1));

    const [
      academyRows,
      activeStudents,
      overdueStudents,
      pendingTransfers,
      activeSubscriptions,
      expiringSubscriptions,
      managerSubs,
      totals,
      day,
      previousDay,
    ] = await Promise.all([
      this.repo.listAcademies(),
      this.repo.activeStudentsPerAcademy(),
      this.repo.overdueStudentsPerAcademy(monthOf(referenceDate), referenceDate),
      this.repo.pendingTransfersPerAcademy(),
      this.repo.activeSubscriptionsPerAcademy(referenceDate),
      this.repo.expiringSubscriptionsPerAcademy(
        referenceDate,
        addDays(referenceDate, EXPIRING_WINDOW_DAYS),
      ),
      this.repo.countManagerSubscriptions(),
      this.repo.platformTotals(),
      this.collectDay(window),
      this.collectDay(previousWindow),
    ]);

    const activeStudentsByAcademy = indexCounts(activeStudents);
    const overdueByAcademy = indexCounts(overdueStudents);
    const activeSubsByAcademy = indexCounts(activeSubscriptions);
    const expiringByAcademy = indexCounts(expiringSubscriptions);
    const pendingByAcademy = groupByAcademy(pendingTransfers);

    const academies: AcademySummary[] = academyRows.map((academy) => {
      const byMethod = toMethodTotals(day.payments.get(academy.id) ?? []);
      const previousByMethod = toMethodTotals(
        previousDay.payments.get(academy.id) ?? [],
      );
      const unpaidPix = day.unpaidPix.get(academy.id);

      return {
        name: academy.name,
        ownerName: academy.ownerName,
        managerPlan: academy.managerPlan,
        newStudents: {
          value: day.newStudents.get(academy.id) ?? 0,
          previous: previousDay.newStudents.get(academy.id) ?? 0,
        },
        activeStudents: activeStudentsByAcademy.get(academy.id) ?? 0,
        overdueStudents: overdueByAcademy.get(academy.id) ?? 0,
        paymentsCount: byMethod.reduce((total, m) => total + m.count, 0),
        received: splitMoney(byMethod),
        receivedPreviousGrossCents: previousByMethod.reduce(
          (total, m) => total + m.amountCents,
          0,
        ),
        byMethod,
        unpaidPixCount: unpaidPix?.count ?? 0,
        unpaidPixCents: unpaidPix?.amountCents ?? 0,
        pendingTransfer: splitMoney(
          transferable(toMethodTotals(pendingByAcademy.get(academy.id) ?? [])),
        ),
        subscriptionsCreated: day.newSubscriptions.get(academy.id) ?? 0,
        subscriptionsExpiringIn7Days: expiringByAcademy.get(academy.id) ?? 0,
        subscriptionsCanceled: day.canceledSubscriptions.get(academy.id) ?? 0,
        subscriptionsActive: activeSubsByAcademy.get(academy.id) ?? 0,
        checkins: {
          value: day.checkins.get(academy.id) ?? 0,
          previous: previousDay.checkins.get(academy.id) ?? 0,
        },
        topClasses: (day.classAttendance.get(academy.id) ?? [])
          .slice(0, TOP_CLASSES)
          .map((c) => ({ name: c.className, count: c.count })),
      };
    });

    const allMethods = toMethodTotals([...day.payments.values()].flat());
    const allPending = transferable(toMethodTotals(pendingTransfers));

    return {
      referenceDate: formatBrDate(referenceDate),
      revenue: splitMoney(allMethods),
      revenuePreviousGrossCents: [...previousDay.payments.values()]
        .flat()
        .reduce((total, p) => total + p.amountCents, 0),
      pendingTransfer: splitMoney(allPending),
      newUsers: { value: day.newUsers, previous: previousDay.newUsers },
      newAcademies: day.newAcademies,
      managerSubscriptions: {
        pro: managerSubs.pro,
        free: managerSubs.free,
        newProToday: day.newProSubscriptions,
      },
      totals: {
        users: totals.totalUsers,
        academies: totals.totalAcademies,
        grossCents: totals.totalGrossCents,
      },
      academies,
    };
  }

  private async collectDay(window: DayWindow): Promise<DaySlice> {
    const [
      newStudents,
      payments,
      unpaidPix,
      newSubscriptions,
      canceledSubscriptions,
      checkins,
      classAttendance,
      newUsers,
      newAcademies,
      newProSubscriptions,
    ] = await Promise.all([
      this.repo.newStudentsPerAcademy(window),
      this.repo.paymentsPerAcademy(window),
      this.repo.unpaidPixPerAcademy(window),
      this.repo.newSubscriptionsPerAcademy(window),
      this.repo.canceledSubscriptionsPerAcademy(window),
      this.repo.checkinsPerAcademy(window),
      this.repo.classAttendancePerAcademy(window),
      this.repo.countNewUsers(window),
      this.repo.listNewAcademies(window),
      this.repo.countNewProSubscriptions(window),
    ]);

    return {
      newStudents: indexCounts(newStudents),
      payments: groupByAcademy(payments),
      unpaidPix: new Map(unpaidPix.map((r) => [r.academyId, r])),
      newSubscriptions: indexCounts(newSubscriptions),
      canceledSubscriptions: indexCounts(canceledSubscriptions),
      checkins: indexCounts(checkins),
      classAttendance: groupByAcademy(classAttendance),
      newUsers,
      newAcademies: newAcademies.map((a) => a.name),
      newProSubscriptions,
    };
  }
}
