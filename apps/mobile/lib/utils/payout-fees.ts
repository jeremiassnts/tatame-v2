import type { PayoutAccountFees } from "@/lib/hooks/use-payout-account";

/**
 * What a charge costs and what is left of it.
 *
 * Units are the whole point of this file, so they are spelled out:
 *
 * - The plan price lives in the app as `priceCents` — an integer in cents.
 * - Asaas reports every money amount in reais as a float (`fixedFee: 1.99`).
 * - Asaas reports every rate as a percentage, not a fraction: the sandbox
 *   payload carries `oneInstallmentPercentage: 2.99`, which is 2.99% of the
 *   charge. Reading it as a fraction would charge 299% and make every net
 *   value negative, so the maths below divides by 100.
 *
 * Everything is therefore converted to cents up front and stays there, which
 * also keeps the arithmetic away from float drift.
 */
export type FeeBreakdown = {
  /** The fee Asaas keeps, in cents. */
  feeCents: number;
  /**
   * What reaches the academy, in cents. Can be negative when the price does
   * not even cover the fee — the caller is expected to say so rather than
   * hide it behind a zero.
   */
  netCents: number;
};

/** Asaas reais (float) to cents (integer). */
function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Applies a `minFee`/`maxFee` bound only when it is actually a bound.
 *
 * A `0` in either field means "no bound" in the real payload, not "the fee is
 * zero". Treating `maxFee: 0` as a ceiling would clamp every fee to nothing
 * and show the manager the full price as the net value.
 */
function clampFee(feeCents: number, minFeeCents: number, maxFeeCents: number): number {
  let fee = feeCents;
  if (minFeeCents > 0) fee = Math.max(fee, minFeeCents);
  if (maxFeeCents > 0) fee = Math.min(fee, maxFeeCents);
  return Math.max(fee, 0);
}

/**
 * pixNet = price - clamp(pixFixedFee + price * pixPercentage, minFee, maxFee)
 *
 * Worked example with the documented rates (fixedFee 1.99, percentageFee 0,
 * minFee 0, maxFee 0) on a R$ 150,00 plan: fee = 199 + 0 = 199 cents, unbound,
 * so the academy receives 15000 - 199 = 14801 cents = R$ 148,01.
 */
export function calculatePixFee(
  priceCents: number,
  pix: PayoutAccountFees["pix"],
): FeeBreakdown {
  const rawFeeCents =
    reaisToCents(pix.fixedFee) + Math.round((priceCents * pix.percentageFee) / 100);
  const feeCents = clampFee(
    rawFeeCents,
    reaisToCents(pix.minFee),
    reaisToCents(pix.maxFee),
  );
  return { feeCents, netCents: priceCents - feeCents };
}

/**
 * cardNet = price - (cardOperationFee + price * cardPercentage)
 *
 * Card has no min/max in the payload, so there is nothing to clamp.
 */
export function calculateCardFee(
  priceCents: number,
  creditCard: PayoutAccountFees["creditCard"],
): FeeBreakdown {
  const feeCents = Math.max(
    reaisToCents(creditCard.operationFee) +
      Math.round((priceCents * creditCard.percentage) / 100),
    0,
  );
  return { feeCents, netCents: priceCents - feeCents };
}

/** How many free monthly Pix credits are still available, never negative. */
export function remainingFreePixCredits(pix: PayoutAccountFees["pix"]): number {
  return Math.max(pix.monthlyFreeCredits - pix.freeCreditsUsed, 0);
}

/** `R$ 148,01` — the same shape the other money screens use. */
export function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/** `2,99%` — trims the decimals when the rate is a round number. */
export function formatPercentage(percentage: number): string {
  const text =
    Number.isInteger(percentage) ? String(percentage) : percentage.toFixed(2);
  return `${text.replace(".", ",")}%`;
}
