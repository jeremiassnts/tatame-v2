import { describe, expect, it, vi } from "vitest";
import type { AsaasFees } from "../../lib/asaas.js";
import { HttpError } from "../../lib/http-error.js";
import { PayoutAccountFeesService } from "./payout-account.fees.js";

function asaasFees(overrides: Partial<AsaasFees["payment"]> = {}): AsaasFees {
  return {
    payment: {
      pix: {
        fixedFeeValue: 1.99,
        percentageFee: 0,
        minimumFeeValue: 0,
        maximumFeeValue: 0,
        monthlyCreditsWithoutFee: 10,
        creditsReceivedOfCurrentMonth: 3,
      },
      creditCard: {
        operationValue: 0.49,
        oneInstallmentPercentage: 2.99,
        daysToReceive: 30,
      },
      ...overrides,
    },
  };
}

class FakeCache {
  store = new Map<string, string>();
  get = vi.fn((key: string) => Promise.resolve(this.store.get(key) ?? null));
  set = vi.fn((key: string, value: string, _ttlSeconds: number) => {
    this.store.set(key, value);
    return Promise.resolve();
  });
}

function setup() {
  const getFees = vi.fn().mockResolvedValue(asaasFees());
  const cache = new FakeCache();
  const svc = new PayoutAccountFeesService(
    { root: () => ({ getFees }) as never, forSubaccount: () => ({}) as never },
    cache,
  );
  return { svc, getFees, cache };
}

describe("PayoutAccountFeesService.getFees", () => {
  it("normalizes the Asaas payload into the shape the plan screen needs", async () => {
    const { svc } = setup();

    const fees = await svc.getFees();

    expect(fees).toMatchObject({
      pix: {
        fixedFee: 1.99,
        percentageFee: 0,
        minFee: 0,
        maxFee: 0,
        monthlyFreeCredits: 10,
        freeCreditsUsed: 3,
      },
      creditCard: { operationFee: 0.49, percentage: 2.99, daysToReceive: 30 },
    });
    expect(typeof fees.fetchedAt).toBe("string");
    expect(new Date(fees.fetchedAt).toString()).not.toBe("Invalid Date");
  });

  it("reads the rates from the root account, not from a subaccount", async () => {
    const { svc, getFees } = setup();
    await svc.getFees();
    expect(getFees).toHaveBeenCalledOnce();
  });

  it("serves the second call from cache", async () => {
    const { svc, getFees } = setup();

    const first = await svc.getFees();
    const second = await svc.getFees();

    expect(getFees).toHaveBeenCalledOnce();
    expect(second).toEqual(first);
  });

  it("caches for twelve hours", async () => {
    const { svc, cache } = setup();
    await svc.getFees();
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), 12 * 60 * 60);
  });

  it("refetches once the cache no longer holds the entry", async () => {
    const { svc, getFees, cache } = setup();
    await svc.getFees();
    cache.store.clear();
    await svc.getFees();
    expect(getFees).toHaveBeenCalledTimes(2);
  });

  it("answers 503 when Asaas cannot be reached, never a stale number", async () => {
    const { svc, getFees } = setup();
    getFees.mockRejectedValueOnce(new HttpError(502, "Asaas está indisponível no momento"));

    const error = (await svc.getFees().catch((e: unknown) => e)) as HttpError;

    expect(error).toBeInstanceOf(HttpError);
    expect(error.statusCode).toBe(503);
    expect(error.details).toMatchObject({ code: "FEES_UNAVAILABLE" });
  });

  it("does not cache a failure", async () => {
    const { svc, getFees, cache } = setup();
    getFees.mockRejectedValueOnce(new HttpError(502, "down"));

    await svc.getFees().catch(() => undefined);
    await svc.getFees();

    expect(cache.set).toHaveBeenCalledOnce();
  });

  it("survives a cache that is unavailable, falling back to a live read", async () => {
    const { svc, getFees, cache } = setup();
    cache.get.mockRejectedValue(new Error("redis down"));
    cache.set.mockRejectedValue(new Error("redis down"));

    const fees = await svc.getFees();

    expect(fees.pix.fixedFee).toBe(1.99);
    expect(getFees).toHaveBeenCalledOnce();
  });

  it("ignores a cached entry it cannot parse", async () => {
    const { svc, getFees, cache } = setup();
    cache.get.mockResolvedValueOnce("not json");

    await svc.getFees();

    expect(getFees).toHaveBeenCalledOnce();
  });

  it("treats a missing fee group as unavailable rather than inventing zeros", async () => {
    const { svc, getFees } = setup();
    getFees.mockResolvedValueOnce({ payment: {} } as AsaasFees);

    const error = (await svc.getFees().catch((e: unknown) => e)) as HttpError;

    expect(error.statusCode).toBe(503);
  });
});

/** Asaas dates are `YYYY-MM-DD HH:mm:ss` in São Paulo time, not ISO. */
function asaasDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 864e5)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
}

/**
 * Asaas negotiates a promotional rate per account and charges it, while still
 * reporting the standard rate alongside it. Reading the standard one overstates
 * the fee, so the plan screen would promise the manager less than they receive.
 */
describe("PayoutAccountFeesService.getFees — promotional rates", () => {
  it("applies the discounted Pix fee while the discount is still valid", async () => {
    const { svc, getFees } = setup();
    getFees.mockResolvedValueOnce(
      asaasFees({
        pix: {
          fixedFeeValue: 1.99,
          fixedFeeValueWithDiscount: 0.99,
          discountExpiration: asaasDate(30),
          percentageFee: 0,
          minimumFeeValue: 0,
          maximumFeeValue: 0,
          monthlyCreditsWithoutFee: 100,
          creditsReceivedOfCurrentMonth: 0,
        },
      }),
    );

    const fees = await svc.getFees();

    expect(fees.pix.fixedFee).toBe(0.99);
  });

  it("falls back to the standard Pix fee once the discount has expired", async () => {
    const { svc, getFees } = setup();
    getFees.mockResolvedValueOnce(
      asaasFees({
        pix: {
          fixedFeeValue: 1.99,
          fixedFeeValueWithDiscount: 0.99,
          discountExpiration: asaasDate(-1),
          percentageFee: 0,
          minimumFeeValue: 0,
          maximumFeeValue: 0,
          monthlyCreditsWithoutFee: 100,
          creditsReceivedOfCurrentMonth: 0,
        },
      }),
    );

    const fees = await svc.getFees();

    expect(fees.pix.fixedFee).toBe(1.99);
  });

  it("applies the discounted card percentage when Asaas reports the discount valid", async () => {
    const { svc, getFees } = setup();
    getFees.mockResolvedValueOnce(
      asaasFees({
        creditCard: {
          operationValue: 0.49,
          oneInstallmentPercentage: 2.99,
          discountOneInstallmentPercentage: 1.99,
          hasValidDiscount: true,
          discountExpiration: asaasDate(30),
          daysToReceive: 32,
        },
      }),
    );

    const fees = await svc.getFees();

    expect(fees.creditCard.percentage).toBe(1.99);
  });

  it("keeps the standard card percentage when Asaas reports no valid discount", async () => {
    const { svc, getFees } = setup();
    getFees.mockResolvedValueOnce(
      asaasFees({
        creditCard: {
          operationValue: 0.49,
          oneInstallmentPercentage: 2.99,
          discountOneInstallmentPercentage: 1.99,
          hasValidDiscount: false,
          discountExpiration: asaasDate(30),
          daysToReceive: 32,
        },
      }),
    );

    const fees = await svc.getFees();

    expect(fees.creditCard.percentage).toBe(2.99);
  });
});

/**
 * Pinned to the response the Asaas sandbox returned on 2026-09-28 for the
 * Tatame root account, where a charge of R$ 150,00 credited R$ 149,01 — the
 * discounted Pix fee of R$ 0,99, not the standard R$ 1,99 this module used to
 * report. The plan screen's promise has to match that credit to the cent.
 */
describe("PayoutAccountFeesService.getFees — the sandbox payload", () => {
  const sandboxPayload = {
    payment: {
      pix: {
        fixedFeeValue: 1.99,
        fixedFeeValueWithDiscount: 0.99,
        percentageFee: null,
        minimumFeeValue: null,
        maximumFeeValue: null,
        discountExpiration: "2026-12-28 00:00:00",
        type: "FIXED",
        monthlyCreditsWithoutFee: 100,
        creditsReceivedOfCurrentMonth: 0,
      },
      creditCard: {
        operationValue: 0.49,
        oneInstallmentPercentage: 2.99,
        discountOneInstallmentPercentage: 1.99,
        hasValidDiscount: true,
        daysToReceive: 32,
        discountExpiration: "2026-12-28 00:00:00",
      },
    },
  } as unknown as AsaasFees;

  it("reports the rates Asaas actually charges", async () => {
    const { svc, getFees } = setup();
    getFees.mockResolvedValueOnce(sandboxPayload);

    const fees = await svc.getFees();

    expect(fees.pix.fixedFee).toBe(0.99);
    expect(fees.creditCard.percentage).toBe(1.99);
    expect(fees.creditCard.operationFee).toBe(0.49);
    expect(fees.creditCard.daysToReceive).toBe(32);
  });

  it("nets the same value the sandbox charge credited", async () => {
    const { svc, getFees } = setup();
    getFees.mockResolvedValueOnce(sandboxPayload);

    const fees = await svc.getFees();

    expect(150 - fees.pix.fixedFee).toBeCloseTo(149.01, 2);
  });
});
