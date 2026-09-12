import type {
  AcademyAmount,
  AcademyClassAttendance,
  AcademyCount,
  AcademyMethodAmount,
  AcademyRow,
  DayWindow,
  IPlatformSummaryRepository,
  ManagerSubscriptionCounts,
  NewAcademyRow,
  PlatformTotals,
} from "./platform-summary.repository.js";

/** Day-scoped fixture, keyed by the BRT date the day-scoped methods ask for. */
export type DayFixture = {
  newStudents?: AcademyCount[];
  payments?: AcademyMethodAmount[];
  unpaidPix?: AcademyAmount[];
  newSubscriptions?: AcademyCount[];
  canceledSubscriptions?: AcademyCount[];
  checkins?: AcademyCount[];
  classAttendance?: AcademyClassAttendance[];
  newUsers?: number;
  newAcademies?: NewAcademyRow[];
  newProSubscriptions?: number;
};

/**
 * Test double. Snapshot fields are set directly; day-scoped data goes in per
 * date through `setDay`, so a test can give the reference day and the day
 * before it different numbers and assert on the delta.
 */
export class InMemoryPlatformSummaryRepository
  implements IPlatformSummaryRepository
{
  academies: AcademyRow[] = [];
  activeStudents: AcademyCount[] = [];
  overdueStudents: AcademyCount[] = [];
  pendingTransfers: AcademyMethodAmount[] = [];
  activeSubscriptions: AcademyCount[] = [];
  expiringSubscriptions: AcademyCount[] = [];
  managerSubscriptions: ManagerSubscriptionCounts = { pro: 0, free: 0 };
  totals: PlatformTotals = {
    totalUsers: 0,
    totalAcademies: 0,
    totalGrossCents: 0,
  };

  private readonly days = new Map<string, DayFixture>();

  setDay(date: string, fixture: DayFixture): void {
    this.days.set(date, fixture);
  }

  private day(window: DayWindow): DayFixture {
    return this.days.get(window.date) ?? {};
  }

  // --- snapshot -----------------------------------------------------------

  async listAcademies(): Promise<AcademyRow[]> {
    return this.academies;
  }

  async activeStudentsPerAcademy(): Promise<AcademyCount[]> {
    return this.activeStudents;
  }

  async overdueStudentsPerAcademy(): Promise<AcademyCount[]> {
    return this.overdueStudents;
  }

  async pendingTransfersPerAcademy(): Promise<AcademyMethodAmount[]> {
    return this.pendingTransfers;
  }

  async activeSubscriptionsPerAcademy(): Promise<AcademyCount[]> {
    return this.activeSubscriptions;
  }

  async expiringSubscriptionsPerAcademy(): Promise<AcademyCount[]> {
    return this.expiringSubscriptions;
  }

  async countManagerSubscriptions(): Promise<ManagerSubscriptionCounts> {
    return this.managerSubscriptions;
  }

  async platformTotals(): Promise<PlatformTotals> {
    return this.totals;
  }

  // --- day-scoped ---------------------------------------------------------

  async newStudentsPerAcademy(window: DayWindow): Promise<AcademyCount[]> {
    return this.day(window).newStudents ?? [];
  }

  async paymentsPerAcademy(window: DayWindow): Promise<AcademyMethodAmount[]> {
    return this.day(window).payments ?? [];
  }

  async unpaidPixPerAcademy(window: DayWindow): Promise<AcademyAmount[]> {
    return this.day(window).unpaidPix ?? [];
  }

  async newSubscriptionsPerAcademy(window: DayWindow): Promise<AcademyCount[]> {
    return this.day(window).newSubscriptions ?? [];
  }

  async canceledSubscriptionsPerAcademy(
    window: DayWindow,
  ): Promise<AcademyCount[]> {
    return this.day(window).canceledSubscriptions ?? [];
  }

  async checkinsPerAcademy(window: DayWindow): Promise<AcademyCount[]> {
    return this.day(window).checkins ?? [];
  }

  async classAttendancePerAcademy(
    window: DayWindow,
  ): Promise<AcademyClassAttendance[]> {
    return this.day(window).classAttendance ?? [];
  }

  async countNewUsers(window: DayWindow): Promise<number> {
    return this.day(window).newUsers ?? 0;
  }

  async listNewAcademies(window: DayWindow): Promise<NewAcademyRow[]> {
    return this.day(window).newAcademies ?? [];
  }

  async countNewProSubscriptions(window: DayWindow): Promise<number> {
    return this.day(window).newProSubscriptions ?? 0;
  }
}
