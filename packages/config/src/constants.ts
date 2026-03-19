import type { Belt } from "@tatame/types";
import { Belt as BeltValues, DayOfWeek } from "@tatame/types";

/** Belt progression order (spec §6.10) */
export const BELT_ORDER: readonly Belt[] = [
  BeltValues.White,
  BeltValues.Blue,
  BeltValues.Purple,
  BeltValues.Brown,
  BeltValues.Black,
];

/** Max stripes per belt (white–brown: 4, black: 10) */
export const MAX_STRIPES_BY_BELT: Record<Belt, number> = {
  [BeltValues.White]: 4,
  [BeltValues.Blue]: 4,
  [BeltValues.Purple]: 4,
  [BeltValues.Brown]: 4,
  [BeltValues.Black]: 10,
};

export const DAY_OF_WEEK_LABEL: Record<number, string> = {
  [DayOfWeek.Sunday]: "Sunday",
  [DayOfWeek.Monday]: "Monday",
  [DayOfWeek.Tuesday]: "Tuesday",
  [DayOfWeek.Wednesday]: "Wednesday",
  [DayOfWeek.Thursday]: "Thursday",
  [DayOfWeek.Friday]: "Friday",
  [DayOfWeek.Saturday]: "Saturday",
};

export function apiBaseUrl(): string {
  if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const port = process.env.API_PORT ?? "3001";
  return `http://localhost:${port}`;
}
