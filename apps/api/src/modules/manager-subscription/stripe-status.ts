export type ManagerSubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

const STRIPE_STATUS_MAP: Record<string, ManagerSubscriptionStatus> = {
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
  trialing: "active",
  unpaid: "past_due",
  paused: "past_due",
};

export function mapStripeStatus(stripeStatus: string): ManagerSubscriptionStatus {
  return STRIPE_STATUS_MAP[stripeStatus] ?? "active";
}
