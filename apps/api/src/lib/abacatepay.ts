import AbacatePaySdk from "abacatepay-nodejs-sdk";
import { loadEnv } from "@tatame/config";

type AbacatePayClient = {
  billing: {
    create: (data: any) => Promise<any>;
    list: () => Promise<any>;
  };
};

let client: AbacatePayClient | null = null;

export function getAbacatePay(): AbacatePayClient {
  if (!client) {
    const env = loadEnv();
    if (!env.ABACATEPAY_API_KEY) {
      throw new Error("ABACATEPAY_API_KEY is not configured");
    }
    const factory = (AbacatePaySdk as any).default ?? AbacatePaySdk;
    client = factory(env.ABACATEPAY_API_KEY);
  }
  return client!;
}
