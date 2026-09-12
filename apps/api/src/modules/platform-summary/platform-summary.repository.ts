export type PaymentMethod = "manual" | "stripe" | "pix";

/**
 * A BRT calendar day expressed as a half-open UTC interval.
 *
 * BRT is UTC−3 with no DST since 2019, so `2026-09-11` in São Paulo is
 * `[2026-09-11T03:00:00Z, 2026-09-12T03:00:00Z)`. Every `timestamptz` column is
 * filtered on that interval; `checkins.date` is a plain `date` and is compared
 * to `date` directly.
 */
export type DayWindow = {
  /** `YYYY-MM-DD` */
  date: string;
  start: Date;
  end: Date;
};

export type AcademyRow = {
  id: string;
  name: string;
  ownerName: string;
  managerPlan: "free" | "pro" | null;
};

export type AcademyCount = { academyId: string; count: number };

export type AcademyAmount = {
  academyId: string;
  count: number;
  amountCents: number;
};

export type AcademyMethodAmount = AcademyAmount & { method: PaymentMethod };

export type AcademyClassAttendance = {
  academyId: string;
  className: string;
  count: number;
};

export type NewAcademyRow = { id: string; name: string };

export type ManagerSubscriptionCounts = { pro: number; free: number };

export type PlatformTotals = {
  totalUsers: number;
  totalAcademies: number;
  totalGrossCents: number;
};

/**
 * Every aggregate the daily summary needs, one method per query.
 *
 * Day-scoped methods take a `DayWindow` and are called twice — once for the
 * reference day, once for the day before it, which is where the deltas come
 * from. Snapshot methods describe "right now" and are called once.
 */
export interface IPlatformSummaryRepository {
  // --- snapshot -----------------------------------------------------------
  listAcademies(): Promise<AcademyRow[]>;
  activeStudentsPerAcademy(): Promise<AcademyCount[]>;
  /** Active subscriptions with no payment for `referenceMonth` (`YYYY-MM-01`). */
  overdueStudentsPerAcademy(
    referenceMonth: string,
    today: string,
  ): Promise<AcademyCount[]>;
  /** Untransferred `pix`/`stripe` payments — what the platform still owes. */
  pendingTransfersPerAcademy(): Promise<AcademyMethodAmount[]>;
  activeSubscriptionsPerAcademy(today: string): Promise<AcademyCount[]>;
  expiringSubscriptionsPerAcademy(
    from: string,
    to: string,
  ): Promise<AcademyCount[]>;
  countManagerSubscriptions(): Promise<ManagerSubscriptionCounts>;
  platformTotals(): Promise<PlatformTotals>;

  // --- day-scoped ---------------------------------------------------------
  newStudentsPerAcademy(window: DayWindow): Promise<AcademyCount[]>;
  paymentsPerAcademy(window: DayWindow): Promise<AcademyMethodAmount[]>;
  /** Pix QR codes generated in the window with no payment recorded against them. */
  unpaidPixPerAcademy(window: DayWindow): Promise<AcademyAmount[]>;
  newSubscriptionsPerAcademy(window: DayWindow): Promise<AcademyCount[]>;
  canceledSubscriptionsPerAcademy(window: DayWindow): Promise<AcademyCount[]>;
  checkinsPerAcademy(window: DayWindow): Promise<AcademyCount[]>;
  /** Attendance per class for the day, most attended first. */
  classAttendancePerAcademy(window: DayWindow): Promise<AcademyClassAttendance[]>;
  countNewUsers(window: DayWindow): Promise<number>;
  listNewAcademies(window: DayWindow): Promise<NewAcademyRow[]>;
  countNewProSubscriptions(window: DayWindow): Promise<number>;
}
