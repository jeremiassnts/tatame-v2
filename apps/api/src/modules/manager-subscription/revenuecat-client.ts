import { logger } from "../../lib/logger.js";

/** Minimal shape of a subscriber response from the RevenueCat REST API. */
export type RevenueCatSubscriber = {
  subscriber: {
    original_app_user_id: string;
    entitlements: Record<
      string,
      {
        expires_date: string | null;
        product_identifier: string;
        grace_period_expires_date: string | null;
        purchase_date: string;
        unsubscribe_detected_at: string | null;
        billing_issues_detected_at: string | null;
      }
    >;
    subscriptions: Record<
      string,
      {
        expires_date: string | null;
        period_type: "normal" | "trial" | "intro";
        store: "app_store" | "play_store" | "promotional" | "stripe";
        unsubscribe_detected_at: string | null;
        billing_issues_detected_at: string | null;
        refunded_at: string | null;
        original_purchase_date: string;
      }
    >;
  };
};

export class RevenueCatClient {
  constructor(
    private readonly secretApiKey: string,
    private readonly baseUrl: string = "https://api.revenuecat.com/v1",
  ) {}

  async getSubscriber(appUserId: string): Promise<RevenueCatSubscriber | null> {
    const res = await fetch(
      `${this.baseUrl}/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${this.secretApiKey}`,
          Accept: "application/json",
        },
      },
    );

    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn(
        { appUserId, status: res.status, body },
        "[revenuecat] getSubscriber non-2xx",
      );
      throw new Error(`RevenueCat getSubscriber failed: ${res.status}`);
    }
    return (await res.json()) as RevenueCatSubscriber;
  }
}
