import { getRedis } from "../../lib/redis.js";
import { HttpError } from "../../lib/http-error.js";
import { log } from "../../telemetry/logger.js";
import type { AsaasClientFactory } from "./payout-account.service.js";

/**
 * The Asaas rates, as the plan screen needs them.
 *
 * The academy receives the net value of every charge, so the fee is not a
 * footnote — it is the difference between the price the manager types and the
 * money that arrives. Rates change, and Asaas negotiates them per account, so
 * they are read from the platform account rather than written down anywhere.
 */
export interface NormalizedFees {
  pix: {
    fixedFee: number;
    percentageFee: number;
    minFee: number;
    maxFee: number;
    /** Pix credits that cost nothing each month, and how many are used. */
    monthlyFreeCredits: number;
    freeCreditsUsed: number;
  };
  creditCard: {
    operationFee: number;
    percentage: number;
    /** Card money is not immediate; the plan screen has to say how long. */
    daysToReceive: number;
  };
  fetchedAt: string;
}

/** Twelve hours: rates move rarely, and a stale rate is never served anyway. */
const TTL_SECONDS = 12 * 60 * 60;
const CACHE_KEY = "payout-account:fees:root";

export interface FeesCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

/**
 * Redis when it is configured, a process-local map otherwise. The fallback is
 * not a degraded mode worth reporting: one API instance re-reading the rates
 * twice a day costs nothing.
 */
export class DefaultFeesCache implements FeesCache {
  private readonly local = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const redis = await getRedis();
    if (redis) return redis.get(key);

    const hit = this.local.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
      this.local.delete(key);
      return null;
    }
    return hit.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const redis = await getRedis();
    if (redis) {
      await redis.set(key, value, { EX: ttlSeconds });
      return;
    }
    this.local.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

function unavailable(): HttpError {
  return new HttpError(503, "Não foi possível consultar as taxas do Asaas agora", {
    code: "FEES_UNAVAILABLE",
  });
}

export class PayoutAccountFeesService {
  constructor(
    private readonly asaas: AsaasClientFactory,
    private readonly cache: FeesCache = new DefaultFeesCache(),
  ) {}

  async getFees(): Promise<NormalizedFees> {
    const cached = await this.readCache();
    if (cached) return cached;

    let raw;
    try {
      raw = await this.asaas.root().getFees();
    } catch (error) {
      // The plan screen degrades to "taxas indisponíveis" on a 503. Anything
      // else here would have it show a number nobody can stand behind.
      log.warn("could not read asaas fees", {
        component: "payout-account",
        err: error instanceof Error ? error.message : String(error),
      });
      throw unavailable();
    }

    const pix = raw.payment?.pix;
    const creditCard = raw.payment?.creditCard;
    if (!pix || !creditCard) throw unavailable();

    const fees: NormalizedFees = {
      pix: {
        fixedFee: pix.fixedFeeValue,
        percentageFee: pix.percentageFee,
        minFee: pix.minimumFeeValue,
        maxFee: pix.maximumFeeValue,
        monthlyFreeCredits: pix.monthlyCreditsWithoutFee,
        freeCreditsUsed: pix.creditsReceivedOfCurrentMonth,
      },
      creditCard: {
        operationFee: creditCard.operationValue,
        percentage: creditCard.oneInstallmentPercentage,
        daysToReceive: creditCard.daysToReceive,
      },
      fetchedAt: new Date().toISOString(),
    };

    try {
      await this.cache.set(CACHE_KEY, JSON.stringify(fees), TTL_SECONDS);
    } catch {
      // A cache that cannot be written is not a reason to fail the request.
    }
    return fees;
  }

  private async readCache(): Promise<NormalizedFees | null> {
    try {
      const cached = await this.cache.get(CACHE_KEY);
      return cached ? (JSON.parse(cached) as NormalizedFees) : null;
    } catch {
      // Unreadable or unparseable: fall through to a live read.
      return null;
    }
  }
}
