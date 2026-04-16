/**
 * Shape of a RevenueCat webhook payload.
 * Reference: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export type RevenueCatEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "PRODUCT_CHANGE"
  | "SUBSCRIPTION_PAUSED"
  | "REFUND"
  | "TEST"
  | "TRANSFER"
  | "SUBSCRIBER_ALIAS"
  | "NON_RENEWING_PURCHASE";

export type RevenueCatStore =
  | "APP_STORE"
  | "PLAY_STORE"
  | "PROMOTIONAL"
  | "STRIPE";

export type RevenueCatEvent = {
  event: {
    type: RevenueCatEventType;
    id: string;
    app_user_id: string;
    original_app_user_id?: string;
    product_id?: string;
    original_transaction_id?: string;
    transaction_id?: string;
    store?: RevenueCatStore;
    /** Unix ms. */
    event_timestamp_ms: number;
    /** Unix ms. */
    expiration_at_ms?: number;
    cancel_reason?: string;
    environment?: "SANDBOX" | "PRODUCTION";
  };
  api_version: string;
};

export function mapStoreToDb(
  store: RevenueCatStore | undefined,
): "app_store" | "play_store" | null {
  if (store === "APP_STORE") return "app_store";
  if (store === "PLAY_STORE") return "play_store";
  return null;
}
