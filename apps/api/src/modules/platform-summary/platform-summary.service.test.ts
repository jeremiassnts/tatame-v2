import { describe, expect, it, vi } from "vitest";
import { InMemoryPlatformSummaryRepository } from "./platform-summary.repository.in-memory.js";
import {
  brtDayWindow,
  PlatformSummaryService,
  previousBrtDate,
  splitMoney,
} from "./platform-summary.service.js";

const DAY = "2026-09-11";
const PREVIOUS_DAY = "2026-09-10";

const OWNER_EMAIL = "owner@apptatame.com.br";

function setup() {
  const repo = new InMemoryPlatformSummaryRepository();
  const emailService = { sendDailyPlatformSummary: vi.fn().mockResolvedValue(undefined) };
  repo.academies = [
    {
      id: "a1",
      name: "Academia Alpha",
      ownerName: "Ana",
      managerPlan: "pro",
    },
  ];
  const service = new PlatformSummaryService(
    repo,
    emailService as never,
    OWNER_EMAIL,
  );
  return { repo, emailService, service };
}

describe("brtDayWindow", () => {
  it("maps a BRT day to the UTC interval that contains it", () => {
    const window = brtDayWindow(DAY);
    expect(window.start.toISOString()).toBe("2026-09-11T03:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-09-12T03:00:00.000Z");
  });
});

describe("previousBrtDate", () => {
  it("returns the day that had already ended", () => {
    // 10:00 UTC = 07:00 BRT on the 12th, when the cron fires.
    expect(previousBrtDate(new Date("2026-09-12T10:00:00Z"))).toBe(DAY);
  });

  it("resolves the BRT day, not the UTC one, near midnight", () => {
    // 01:00 UTC on the 12th is still 22:00 BRT on the 11th.
    expect(previousBrtDate(new Date("2026-09-12T01:00:00Z"))).toBe(
      "2026-09-10",
    );
  });
});

describe("splitMoney", () => {
  it("charges the card fixed fee once per transaction", () => {
    // 3 card payments totalling R$300,00: 3,99% of the total + 3 × R$0,39.
    const money = splitMoney([
      { method: "card", count: 3, amountCents: 30_000 },
    ]);
    expect(money.grossCents).toBe(30_000);
    expect(money.feeCents).toBe(Math.round(30_000 * 0.0399) + 39 * 3);
    expect(money.netCents).toBe(money.grossCents - money.feeCents);
  });

  it("charges a flat fee per Pix transaction", () => {
    const money = splitMoney([{ method: "pix", count: 4, amountCents: 40_000 }]);
    expect(money.feeCents).toBe(320);
  });

  it("charges nothing on manual payments", () => {
    const money = splitMoney([
      { method: "manual", count: 5, amountCents: 50_000 },
    ]);
    expect(money.feeCents).toBe(0);
    expect(money.netCents).toBe(50_000);
  });

  it("is zero across the board with no payments", () => {
    expect(splitMoney([])).toEqual({
      grossCents: 0,
      feeCents: 0,
      netCents: 0,
    });
  });
});

describe("PlatformSummaryService.buildReport", () => {
  it("compares the reference day against the day before it", async () => {
    const { repo, service } = setup();
    repo.setDay(DAY, {
      newStudents: [{ academyId: "a1", count: 5 }],
      checkins: [{ academyId: "a1", count: 30 }],
      newUsers: 7,
      payments: [{ academyId: "a1", method: "pix", count: 2, amountCents: 20_000 }],
    });
    repo.setDay(PREVIOUS_DAY, {
      newStudents: [{ academyId: "a1", count: 2 }],
      checkins: [{ academyId: "a1", count: 41 }],
      newUsers: 4,
      payments: [{ academyId: "a1", method: "pix", count: 1, amountCents: 15_000 }],
    });

    const report = await service.buildReport(DAY);
    const academy = report.academies[0]!;

    expect(academy.newStudents).toEqual({ value: 5, previous: 2 });
    expect(academy.checkins).toEqual({ value: 30, previous: 41 });
    expect(academy.received.grossCents).toBe(20_000);
    expect(academy.receivedPreviousGrossCents).toBe(15_000);
    expect(report.newUsers).toEqual({ value: 7, previous: 4 });
    expect(report.revenuePreviousGrossCents).toBe(15_000);
  });

  it("keeps the daily revenue gross across every method", async () => {
    const { repo, service } = setup();
    repo.setDay(DAY, {
      payments: [
        { academyId: "a1", method: "manual", count: 1, amountCents: 5_000 },
        { academyId: "a1", method: "card", count: 1, amountCents: 10_000 },
      ],
    });

    const report = await service.buildReport(DAY);

    expect(report.revenue.grossCents).toBe(15_000);
    expect(report.revenue.feeCents).toBe(Math.round(10_000 * 0.0399) + 39);
    expect(report.academies[0]!.paymentsCount).toBe(2);
    expect(report.academies[0]!.byMethod.map((m) => m.method)).toEqual([
      "card",
      "manual",
    ]);
  });

  it("keeps an academy with an empty day in the report", async () => {
    const { repo, service } = setup();
    const report = await service.buildReport(DAY);
    const academy = report.academies[0]!;

    expect(repo.academies).toHaveLength(1);
    expect(academy.name).toBe("Academia Alpha");
    expect(academy.newStudents).toEqual({ value: 0, previous: 0 });
    expect(academy.received).toEqual({
      grossCents: 0,
      feeCents: 0,
      netCents: 0,
    });
    expect(academy.topClasses).toEqual([]);
  });

  it("keeps only the three most attended classes", async () => {
    const { repo, service } = setup();
    repo.setDay(DAY, {
      classAttendance: [
        { academyId: "a1", className: "No-Gi", count: 12 },
        { academyId: "a1", className: "Adulto Manhã", count: 9 },
        { academyId: "a1", className: "Kids", count: 6 },
        { academyId: "a1", className: "Iniciantes", count: 2 },
      ],
    });

    const report = await service.buildReport(DAY);

    expect(report.academies[0]!.topClasses).toEqual([
      { name: "No-Gi", count: 12 },
      { name: "Adulto Manhã", count: 9 },
      { name: "Kids", count: 6 },
    ]);
  });

  it("formats the reference date for the reader", async () => {
    const { service } = setup();
    const report = await service.buildReport(DAY);
    expect(report.referenceDate).toBe("11/09/2026");
  });

  it("sends with no academies at all", async () => {
    const { repo, service, emailService } = setup();
    repo.academies = [];
    repo.totals = { totalUsers: 12, totalAcademies: 0, totalGrossCents: 0 };

    await expect(service.sendDailySummary(DAY)).resolves.toBe(true);
    expect(emailService.sendDailyPlatformSummary).toHaveBeenCalledTimes(1);
    const [data, referenceDate] =
      emailService.sendDailyPlatformSummary.mock.calls[0]!;
    expect(data.academies).toEqual([]);
    expect(data.email).toBe(OWNER_EMAIL);
    expect(referenceDate).toBe(DAY);
  });
});

describe("PlatformSummaryService.sendDailySummary", () => {
  it("does nothing when no recipient is configured", async () => {
    const emailService = { sendDailyPlatformSummary: vi.fn() };
    const service = new PlatformSummaryService(
      new InMemoryPlatformSummaryRepository(),
      emailService as never,
      undefined,
    );

    await expect(service.sendDailySummary(DAY)).resolves.toBe(false);
    expect(emailService.sendDailyPlatformSummary).not.toHaveBeenCalled();
  });
});
