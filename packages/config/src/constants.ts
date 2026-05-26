import type { Belt } from "@tatame/types";
import { Belt as BeltValues, DayOfWeek } from "@tatame/types";

/** Adult belt progression order (spec §6.10) */
export const BELT_ORDER: readonly Belt[] = [
  BeltValues.White,
  BeltValues.Blue,
  BeltValues.Purple,
  BeltValues.Brown,
  BeltValues.Black,
];

/** Kids belt progression order */
export const KIDS_BELT_ORDER: readonly Belt[] = [
  BeltValues.White,
  BeltValues.GreyWhite,
  BeltValues.Grey,
  BeltValues.GreyBlack,
  BeltValues.YellowWhite,
  BeltValues.Yellow,
  BeltValues.YellowBlack,
  BeltValues.OrangeWhite,
  BeltValues.Orange,
  BeltValues.OrangeBlack,
  BeltValues.GreenWhite,
  BeltValues.Green,
  BeltValues.GreenBlack,
];

/** Max stripes per belt (white–brown: 4, black: 10, kids: 4) */
export const MAX_STRIPES_BY_BELT: Record<Belt, number> = {
  [BeltValues.White]: 4,
  [BeltValues.Blue]: 4,
  [BeltValues.Purple]: 4,
  [BeltValues.Brown]: 4,
  [BeltValues.Black]: 10,
  [BeltValues.GreyWhite]: 4,
  [BeltValues.Grey]: 4,
  [BeltValues.GreyBlack]: 4,
  [BeltValues.YellowWhite]: 4,
  [BeltValues.Yellow]: 4,
  [BeltValues.YellowBlack]: 4,
  [BeltValues.OrangeWhite]: 4,
  [BeltValues.Orange]: 4,
  [BeltValues.OrangeBlack]: 4,
  [BeltValues.GreenWhite]: 4,
  [BeltValues.Green]: 4,
  [BeltValues.GreenBlack]: 4,
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
