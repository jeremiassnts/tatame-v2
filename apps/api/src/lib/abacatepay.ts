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
    // Dynamic import to handle ESM/CJS interop
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("abacatepay-nodejs-sdk");
    const factory = mod.default ?? mod;
    client = factory(env.ABACATEPAY_API_KEY);
  }
  return client!;
}
