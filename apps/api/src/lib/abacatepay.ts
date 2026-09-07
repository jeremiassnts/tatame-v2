import AbacatePaySdk from "abacatepay-nodejs-sdk";
import { loadEnv } from "@tatame/config";

/**
 * The SDK is CJS, so under `NodeNext` the default import resolves to the module
 * namespace rather than the factory itself; the callable lives on `.default`.
 */
type AbacatePayFactory = typeof AbacatePaySdk.default;
type AbacatePayClient = ReturnType<AbacatePayFactory>;

let client: AbacatePayClient | null = null;

export function getAbacatePay(): AbacatePayClient {
  if (!client) {
    const env = loadEnv();
    if (!env.ABACATEPAY_API_KEY) {
      throw new Error("ABACATEPAY_API_KEY is not configured");
    }
    const factory: AbacatePayFactory =
      AbacatePaySdk.default ?? (AbacatePaySdk as unknown as AbacatePayFactory);
    client = factory(env.ABACATEPAY_API_KEY);
  }
  return client;
}
