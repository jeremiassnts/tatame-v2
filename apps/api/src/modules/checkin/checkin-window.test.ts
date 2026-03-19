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
});

describe("sessionBoundsUtc / isWithinCheckinWindow", () => {
  it("allows check-in 12h before same-day class", () => {
    const classRow = { startTime: "18:00:00", endTime: "19:00:00" };
    const now = new Date(Date.UTC(2026, 2, 18, 6, 0, 0));
    expect(isWithinCheckinWindow(now, "2026-03-18", classRow)).toBe(true);
  });

  it("handles class that crosses midnight", () => {
    const { start, end } = sessionBoundsUtc(
      "2026-03-16",
      "23:00:00",
      "02:00:00",
    );
    expect(start.toISOString()).toContain("T23:00:00.000Z");
    expect(end.toISOString()).toContain("T02:00:00.000Z");
    expect(end.getUTCDate()).toBe(17);
  });
});
