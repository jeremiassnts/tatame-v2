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

/**
 * Payment processor fees, as shown to managers on the plan-creation screen.
 *
 * These are the processor's fees, not Tatame's — the product charges the manager
 * a Pro subscription and takes no cut of a student's mensalidade.
 *
 * The only consumer left is the daily platform summary's "Líquido dos managers"
 * (`platform-summary.service.ts`). The manager-facing screens no longer read
 * these: since TAT-104 they call `GET /payout-account/fees`, which reports the
 * rates Asaas actually negotiated for that account.
 *
 * So the numbers below are still the pre-Asaas card/Pix rates, and the daily
 * summary is the one place that has not caught up. Fixing that means feeding
 * `NormalizedFees` into the summary rather than editing these constants, since
 * the real rates are per-account.
 */
export const CARD_FEE_PERCENT_BPS = 399; // 3.99%
export const CARD_FEE_FIXED_CENTS = 39; // R$ 0,39
export const PIX_FEE_CENTS = 80; // R$ 0,80

/** `manual` is cash the academy took directly — no processor, no fee. */
export function processorFeeCents(
  method: "manual" | "stripe" | "pix",
  amountCents: number,
): number {
  switch (method) {
    case "stripe":
      return Math.round((amountCents * CARD_FEE_PERCENT_BPS) / 10_000) + CARD_FEE_FIXED_CENTS;
    case "pix":
      return PIX_FEE_CENTS;
    case "manual":
      return 0;
  }
}
