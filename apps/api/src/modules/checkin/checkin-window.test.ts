import { describe, expect, it } from "vitest";
import {
  isWithinCheckinWindow,
  mondayOfWeekContaining,
  sessionBoundsUtc,
} from "./checkin.service.js";

describe("mondayOfWeekContaining", () => {
  it("returns Monday for a Wednesday in UTC", () => {
    expect(mondayOfWeekContaining("2026-03-18")).toBe("2026-03-16");
  });

  it("returns same Monday for a Monday date", () => {
    expect(mondayOfWeekContaining("2026-03-16")).toBe("2026-03-16");
  });

  it("returns previous Monday for a Sunday", () => {
    expect(mondayOfWeekContaining("2026-03-22")).toBe("2026-03-16");
  });

  it("returns Monday for a Saturday", () => {
    expect(mondayOfWeekContaining("2026-03-21")).toBe("2026-03-16");
  });

  it("handles year boundary (Sunday Jan 1 2026 → Monday Dec 29 2025)", () => {
    // Jan 1, 2026 is a Thursday
    expect(mondayOfWeekContaining("2026-01-01")).toBe("2025-12-29");
  });
});

describe("sessionBoundsUtc", () => {
  // Class times are BRT (UTC-3), so 18:00 BRT = 21:00 UTC
  it("returns bounds converted from BRT to UTC for normal class", () => {
    const { start, end } = sessionBoundsUtc("2026-03-18", "18:00:00", "19:00:00");
    expect(start.toISOString()).toBe("2026-03-18T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-18T22:00:00.000Z");
  });

  it("handles class that crosses midnight in UTC (21:00 BRT = 00:00 UTC next day)", () => {
    const { start, end } = sessionBoundsUtc("2026-03-16", "21:00:00", "23:00:00");
    // 21:00 BRT = 00:00 UTC next day, 23:00 BRT = 02:00 UTC next day
    expect(start.toISOString()).toBe("2026-03-17T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-17T02:00:00.000Z");
  });

  it("handles early morning class", () => {
    const { start, end } = sessionBoundsUtc("2026-03-18", "07:00:00", "08:30:00");
    // 07:00 BRT = 10:00 UTC, 08:30 BRT = 11:30 UTC
    expect(start.toISOString()).toBe("2026-03-18T10:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-18T11:30:00.000Z");
  });
});

describe("isWithinCheckinWindow", () => {
  it("allows check-in 12h before class (BRT 19:00 class, now BRT 07:01)", () => {
    // Class 19:00 BRT = 22:00 UTC. Window opens 10:00 UTC = 07:00 BRT
    const classRow = { startTime: "19:00:00", endTime: "20:30:00" };
    const now = new Date(Date.UTC(2026, 2, 18, 10, 1, 0)); // 10:01 UTC = 07:01 BRT
    expect(isWithinCheckinWindow(now, "2026-03-18", classRow)).toBe(true);
  });

  it("rejects check-in more than 12h before class", () => {
    // Class 19:00 BRT = 22:00 UTC. Window opens 10:00 UTC
    const classRow = { startTime: "19:00:00", endTime: "20:30:00" };
    const now = new Date(Date.UTC(2026, 2, 18, 9, 59, 59)); // 09:59 UTC = 06:59 BRT
    expect(isWithinCheckinWindow(now, "2026-03-18", classRow)).toBe(false);
  });

  it("allows check-in during class (BRT 17:51, class BRT 19:00-20:30)", () => {
    // This is the exact scenario from the bug report
    const classRow = { startTime: "19:00:00", endTime: "20:30:00" };
    const now = new Date(Date.UTC(2026, 3, 30, 20, 51, 0)); // 20:51 UTC = 17:51 BRT
    expect(isWithinCheckinWindow(now, "2026-04-30", classRow)).toBe(true);
  });

  it("allows check-in exactly at class end time", () => {
    // Class 19:00-20:30 BRT = 22:00-23:30 UTC
    const classRow = { startTime: "19:00:00", endTime: "20:30:00" };
    const now = new Date(Date.UTC(2026, 2, 18, 23, 30, 0)); // 23:30 UTC = 20:30 BRT
    expect(isWithinCheckinWindow(now, "2026-03-18", classRow)).toBe(true);
  });

  it("rejects check-in after class end time", () => {
    // Class 19:00-20:30 BRT = 22:00-23:30 UTC
    const classRow = { startTime: "19:00:00", endTime: "20:30:00" };
    const now = new Date(Date.UTC(2026, 2, 18, 23, 30, 1)); // 23:30:01 UTC = 20:30:01 BRT
    expect(isWithinCheckinWindow(now, "2026-03-18", classRow)).toBe(false);
  });

  it("allows check-in for early morning class (window opens previous day)", () => {
    // Class 07:00 BRT = 10:00 UTC. Window opens 22:00 UTC previous day = 19:00 BRT
    const classRow = { startTime: "07:00:00", endTime: "08:30:00" };
    const now = new Date(Date.UTC(2026, 2, 17, 22, 0, 0)); // 22:00 UTC = 19:00 BRT
    expect(isWithinCheckinWindow(now, "2026-03-18", classRow)).toBe(true);
  });

  it("allows Friday 07:00 class to be checked in Thursday 17:51 BRT", () => {
    // Class Friday 07:00 BRT = 10:00 UTC Friday. Window opens 22:00 UTC Thursday = 19:00 BRT Thursday
    // Now: Thursday 20:51 UTC = 17:51 BRT — BEFORE window opens (22:00 UTC)
    // Actually 17:51 BRT = 20:51 UTC which is before 22:00 UTC, so this should be false
    // But if sessionDate is Friday (2026-05-01 is a Friday), window opens Thu 22:00 UTC
    // 20:51 UTC < 22:00 UTC → outside window
    const classRow = { startTime: "07:00:00", endTime: "08:30:00" };
    const now = new Date(Date.UTC(2026, 3, 30, 22, 1, 0)); // Thursday 22:01 UTC = 19:01 BRT
    expect(isWithinCheckinWindow(now, "2026-05-01", classRow)).toBe(true);
  });
});
