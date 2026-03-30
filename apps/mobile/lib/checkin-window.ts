/**
 * Mirrors `sessionBoundsUtc` / `isWithinCheckinWindow` in apps/api checkin.service.ts
 * so the client disables check-in when the server would reject (outside window).
 */

function parseTimeParts(time: string): { h: number; m: number; s: number } {
  const parts = time.split(":").map((x) => Number(x));
  return {
    h: parts[0] ?? 0,
    m: parts[1] ?? 0,
    s: parts[2] ?? 0,
  };
}

function sessionBoundsUtc(
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

export function isWithinCheckinWindow(
  now: Date,
  sessionDate: string,
  startTime: string,
  endTime: string,
): boolean {
  const { start, end } = sessionBoundsUtc(sessionDate, startTime, endTime);
  const windowStart = new Date(start.getTime() - 12 * 60 * 60 * 1000);
  const t = now.getTime();
  return t >= windowStart.getTime() && t <= end.getTime();
}
