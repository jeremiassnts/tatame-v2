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
  it("returns same-day bounds for normal class", () => {
    const { start, end } = sessionBoundsUtc("2026-03-18", "18:00:00", "19:00:00");
    expect(start.toISOString()).toBe("2026-03-18T18:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-18T19:00:00.000Z");
  });

  it("handles class that crosses midnight", () => {
    const { start, end } = sessionBoundsUtc("2026-03-16", "23:00:00", "02:00:00");
    expect(start.toISOString()).toBe("2026-03-16T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-17T02:00:00.000Z");
    expect(end.getUTCDate()).toBe(17);
  });

  it("handles class ending exactly at midnight (00:00:00)", () => {
    const { start, end } = sessionBoundsUtc("2026-03-16", "22:00:00", "00:00:00");
    expect(start.toISOString()).toBe("2026-03-16T22:00:00.000Z");
    // 00:00:00 <= 22:00:00, so end rolls to next day
    expect(end.toISOString()).toBe("2026-03-17T00:00:00.000Z");
  });
});

describe("isWithinCheckinWindow", () => {
  it("allows check-in 12h before same-day class", () => {
    const classRow = { startTime: "18:00:00", endTime: "19:00:00" };
    const now = new Date(Date.UTC(2026, 2, 18, 6, 0, 0)); // 06:00
    expect(isWithinCheckinWindow(now, "2026-03-18", classRow)).toBe(true);
  });

  it("rejects check-in more than 12h before class", () => {
    const classRow = { startTime: "18:00:00", endTime: "19:00:00" };
    const now = new Date(Date.UTC(2026, 2, 18, 5, 59, 59)); // 05:59:59
    expect(isWithinCheckinWindow(now, "2026-03-18", classRow)).toBe(false);
  });

  it("allows check-in exactly at class start time", () => {
    const classRow = { startTime: "18:00:00", endTime: "19:00:00" };
    const now = new Date(Date.UTC(2026, 2, 18, 18, 0, 0));
    expect(isWithinCheckinWindow(now, "2026-03-18", classRow)).toBe(true);
  });

  it("allows check-in exactly at class end time", () => {
    const classRow = { startTime: "18:00:00", endTime: "19:00:00" };
    const now = new Date(Date.UTC(2026, 2, 18, 19, 0, 0));
    expect(isWithinCheckinWindow(now, "2026-03-18", classRow)).toBe(true);
  });

  it("rejects check-in 1 second after class end time", () => {
    const classRow = { startTime: "18:00:00", endTime: "19:00:00" };
    const now = new Date(Date.UTC(2026, 2, 18, 19, 0, 1));
    expect(isWithinCheckinWindow(now, "2026-03-18", classRow)).toBe(false);
  });

  it("allows check-in during cross-midnight class (after midnight, before end)", () => {
    const classRow = { startTime: "23:00:00", endTime: "01:00:00" };
    // 00:30 the next day — within window
    const now = new Date(Date.UTC(2026, 2, 17, 0, 30, 0));
    expect(isWithinCheckinWindow(now, "2026-03-16", classRow)).toBe(true);
  });

  it("rejects check-in after cross-midnight class end", () => {
    const classRow = { startTime: "23:00:00", endTime: "01:00:00" };
    // 01:00:01 the next day — past end
    const now = new Date(Date.UTC(2026, 2, 17, 1, 0, 1));
    expect(isWithinCheckinWindow(now, "2026-03-16", classRow)).toBe(false);
  });

  it("allows check-in for early morning class (window opens previous day)", () => {
    const classRow = { startTime: "06:00:00", endTime: "07:00:00" };
    // 12h before 06:00 = 18:00 previous day
    const now = new Date(Date.UTC(2026, 2, 17, 18, 0, 0));
    expect(isWithinCheckinWindow(now, "2026-03-18", classRow)).toBe(true);
  });
});
