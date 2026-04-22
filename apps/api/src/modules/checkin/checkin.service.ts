import type { Role } from "@tatame/types";
import type { RedisClientType } from "redis";
import { HttpError } from "../../lib/http-error.js";
import { withCheckinLock } from "../../lib/lock.js";
import { requireRedisForCheckin } from "../../lib/redis.js";
import type { ClassRow, IClassRepository } from "../class/class.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import type { IPaymentRepository } from "../payment/payment.repository.js";
import type { IStudentSubscriptionRepository } from "../subscription/subscription.repository.js";
import {
  isExpiredByDate,
  utcTodayDateString,
} from "../subscription/subscription.service.js";
import type { CheckinRow, ICheckinRepository } from "./checkin.repository.js";

function addCalendarDays(isoDate: string, days: number): string {
  const parts = isoDate.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function firstOfUtcMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

/** Monday (YYYY-MM-DD) of the calendar week containing `sessionDate` (UTC). */
export function mondayOfWeekContaining(sessionDate: string): string {
  const parts = sessionDate.split("-").map(Number);
  const y = parts[0] ?? 0;
  const mo = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const utc = new Date(Date.UTC(y, mo - 1, d));
  const dow = utc.getUTCDay();
  const delta = (dow + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - delta);
  return utc.toISOString().slice(0, 10);
}

function utcDayOfWeek(sessionDate: string): number {
  const parts = sessionDate.split("-").map(Number);
  const y = parts[0] ?? 0;
  const mo = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

function parseTimeParts(time: string): { h: number; m: number; s: number } {
  const parts = time.split(":").map((x) => Number(x));
  return {
    h: parts[0] ?? 0,
    m: parts[1] ?? 0,
    s: parts[2] ?? 0,
  };
}

/**
 * Session bounds in UTC for `sessionDate` + class times.
 * When end is not after start on the same civil day, end is rolled to the next day (cross-midnight).
 */
export function sessionBoundsUtc(
  sessionDate: string,
  startTime: string,
  endTime: string,
): { start: Date; end: Date } {
  const segs = sessionDate.split("-").map(Number);
  const y = segs[0] ?? 0;
  const mo = segs[1] ?? 1;
  const d = segs[2] ?? 1;
  const sh = parseTimeParts(startTime);
  const eh = parseTimeParts(endTime);
  const start = new Date(Date.UTC(y, mo - 1, d, sh.h, sh.m, sh.s));
  let end = new Date(Date.UTC(y, mo - 1, d, eh.h, eh.m, eh.s));
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

/**
 * Check-in is allowed from 12h before session start until session end.
 *
 * `sessionDate` (YYYY-MM-DD) and class `startTime` / `endTime` are interpreted as
 * wall-clock on that **UTC civil day** (see `sessionBoundsUtc`), not the device's
 * local timezone. `now` is an absolute instant (`Date.getTime()`).
 *
 * So e.g. Sunday 21:00 in Brazil is often `Monday 00:00Z` in ISO — that does not
 * mean the "wrong day"; compare it to `start`/`end` for the **`sessionDate` sent
 * in the request**. If that date is the **next** UTC calendar day (e.g. Monday's
 * class while you still say "today is Sunday" locally), the window for Monday
 * 10:00Z opens Sunday 22:00Z, and `now = Monday 00:00Z` is still inside it.
 */
export function isWithinCheckinWindow(
  now: Date,
  sessionDate: string,
  classRow: Pick<ClassRow, "startTime" | "endTime">,
): boolean {
  const { start, end } = sessionBoundsUtc(
    sessionDate,
    classRow.startTime,
    classRow.endTime,
  );
  const windowStart = new Date(start.getTime() - 12 * 60 * 60 * 1000);
  const t = now.getTime();
  return t >= windowStart.getTime() && t <= end.getTime();
}

function isPostgresUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export type CheckinWarnings = {
  subscriptionGrace?: true;
  paymentOverdue?: true;
};

export type CheckinSuccess = {
  checkin: CheckinRow;
  warnings: CheckinWarnings;
};

export class CheckinService {
  constructor(
    private readonly membershipRepo: IMembershipRepository,
    private readonly classRepo: IClassRepository,
    private readonly studentSubRepo: IStudentSubscriptionRepository,
    private readonly paymentRepo: IPaymentRepository,
    private readonly checkinRepo: ICheckinRepository,
    private readonly dispatcher?: NotificationDispatcher,
  ) { }

  async checkIn(opts: {
    userId: string;
    academyId: string;
    academyRole: Role;
    classId: string;
    sessionDate: string;
    now?: Date;
    redis?: RedisClientType;
  }): Promise<CheckinSuccess> {
    if (opts.academyRole !== "student") {
      throw new HttpError(403, "Only students can check in");
    }

    const membership = await this.membershipRepo.findActiveByUserAndAcademy(
      opts.userId,
      opts.academyId,
    );
    if (!membership || membership.status !== "active") {
      throw new HttpError(403, "No active academy membership");
    }
    if (membership.role !== "student") {
      throw new HttpError(403, "Only students can check in");
    }
    const classRow = await this.classRepo.findById(
      opts.classId,
      opts.academyId,
    );
    if (!classRow?.isActive) {
      throw new HttpError(404, "Class not found");
    }
    if (utcDayOfWeek(opts.sessionDate) !== classRow.dayOfWeek) {
      throw new HttpError(
        400,
        "Session date does not match this class weekday",
      );
    }
    const now = opts.now ?? new Date();
    if (!isWithinCheckinWindow(now, opts.sessionDate, classRow)) {
      throw new HttpError(
        400,
        "Check-in is only allowed from 12 hours before class start until class end",
      );
    }
    const { plan, warnings } = await this.resolveSubscriptionAndWarnings(
      opts.userId,
      opts.academyId,
    );
    const weekReference = mondayOfWeekContaining(opts.sessionDate);
    const redis = opts.redis ?? (await requireRedisForCheckin());
    return withCheckinLock(redis, opts.classId, opts.sessionDate, async () => {
      const classCount = await this.checkinRepo.countByClassAndDate(
        opts.classId,
        opts.sessionDate,
      );
      if (
        classRow.capacity !== null &&
        classCount >= classRow.capacity
      ) {
        throw new HttpError(409, "Class is full");
      }
      const userWeekCount = await this.checkinRepo.countByUserAndWeek(
        opts.userId,
        weekReference,
      );
      if (
        plan.weeklyCheckinLimit !== null &&
        userWeekCount >= plan.weeklyCheckinLimit
      ) {
        throw new HttpError(409, "Weekly check-in limit reached");
      }
      try {
        const checkin = await this.checkinRepo.insert({
          classId: opts.classId,
          userId: opts.userId,
          date: opts.sessionDate,
          weekReference,
        });

        if (this.dispatcher && (warnings.subscriptionGrace || warnings.paymentOverdue)) {
          const detail = await this.membershipRepo.findDetailById(membership.id);
          this.dispatcher.notifyAcademyManagers(
            "checkin_anomaly",
            opts.academyId,
            [detail?.userName ?? "Aluno", classRow.name],
          );
        }

        return { checkin, warnings };
      } catch (e) {
        if (isPostgresUniqueViolation(e)) {
          throw new HttpError(
            409,
            "Already checked in for this class on this date",
          );
        }
        throw e;
      }
    });
  }

  async getWeeklyCount(userId: string): Promise<{
    count: number;
    weekReference: string;
  }> {
    const today = utcTodayDateString();
    const weekRef = mondayOfWeekContaining(today);
    const count = await this.checkinRepo.countByUserAndWeek(userId, weekRef);
    return { count, weekReference: weekRef };
  }

  async getHistory(
    userId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{
    items: Array<{
      weekReference: string;
      weekLabel: string;
      count: number;
      checkins: Array<{
        id: string;
        className: string;
        date: string;
        dayOfWeek: string;
        time: string;
      }>;
    }>;
    nextCursor: string | null;
  }> {
    const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const MONTH_NAMES = [
      "jan",
      "fev",
      "mar",
      "abr",
      "mai",
      "jun",
      "jul",
      "ago",
      "set",
      "out",
      "nov",
      "dez",
    ];

    const rawItems = await this.checkinRepo.findByUserWithClass(userId, {
      cursor: opts.cursor,
      limit: opts.limit * 20,
    });

    const weekMap = new Map<
      string,
      Array<{ id: string; className: string; date: string; startTime: string }>
    >();
    for (const item of rawItems) {
      const weekRef = mondayOfWeekContaining(item.date);
      let arr = weekMap.get(weekRef);
      if (!arr) {
        arr = [];
        weekMap.set(weekRef, arr);
      }
      arr.push(item);
    }

    const sortedWeeks = [...weekMap.keys()].sort((a, b) => b.localeCompare(a));
    const selectedWeeks = sortedWeeks.slice(0, opts.limit);
    const nextCursor =
      sortedWeeks.length > opts.limit ? sortedWeeks[opts.limit]! : null;

    function formatWeekLabel(monday: string): string {
      const parts = monday.split("-").map(Number);
      const y = parts[0] ?? 0;
      const m = parts[1] ?? 1;
      const d = parts[2] ?? 1;
      const start = new Date(Date.UTC(y, m - 1, d));
      const end = new Date(Date.UTC(y, m - 1, d + 6));
      const startDay = start.getUTCDate();
      const endDay = end.getUTCDate();
      const endMonth = MONTH_NAMES[end.getUTCMonth()]!;
      const endYear = end.getUTCFullYear();
      return `${startDay}–${endDay} ${endMonth} ${endYear}`;
    }

    function formatTime(t: string): string {
      const p = t.split(":");
      return `${(p[0] ?? "0").padStart(2, "0")}:${p[1] ?? "00"}`;
    }

    const items = selectedWeeks.map((weekRef) => {
      const checkins = weekMap.get(weekRef) ?? [];
      return {
        weekReference: weekRef,
        weekLabel: formatWeekLabel(weekRef),
        count: checkins.length,
        checkins: checkins.map((c) => {
          const p = c.date.split("-").map(Number);
          const dt = new Date(
            Date.UTC(p[0] ?? 0, (p[1] ?? 1) - 1, p[2] ?? 1),
          );
          return {
            id: c.id,
            className: c.className,
            date: c.date,
            dayOfWeek: DAY_NAMES[dt.getUTCDay()]!,
            time: formatTime(c.startTime),
          };
        }),
      };
    });

    return { items, nextCursor };
  }

  private async resolveSubscriptionAndWarnings(
    userId: string,
    academyId: string,
  ): Promise<{
    plan: { weeklyCheckinLimit: number | null };
    warnings: CheckinWarnings;
  }> {
    const rows = await this.studentSubRepo.listWithPlanByUserAndAcademy(
      userId,
      academyId,
    );

    for (const row of rows) {
      if (
        row.subscription.status === "active" &&
        isExpiredByDate(row.subscription.expiresAt)
      ) {
        await this.studentSubRepo.update(row.subscription.id, {
          status: "expired",
        });
        row.subscription.status = "expired";
      }
    }

    const candidate = rows.find((r) => r.subscription.status !== "cancelled");
    if (!candidate) {
      throw new HttpError(403, "No subscription for this academy");
    }

    const { subscription: sub, plan } = candidate;
    const today = utcTodayDateString();

    if (today < sub.startsAt) {
      throw new HttpError(403, "Subscription has not started yet");
    }

    const graceEnd = addCalendarDays(sub.expiresAt, 3);
    if (today > graceEnd) {
      throw new HttpError(
        403,
        "Subscription expired; check-in is no longer allowed (grace period ended)",
      );
    }

    const warnings: CheckinWarnings = {};

    if (today > sub.expiresAt) {
      warnings.subscriptionGrace = true;
    } else {
      const ref = firstOfUtcMonth(today);
      const paid =
        await this.paymentRepo.existsForSubscriptionReferenceMonth(
          sub.id,
          ref,
        );
      if (!paid) {
        warnings.paymentOverdue = true;
      }
    }

    return { plan, warnings };
  }
}
