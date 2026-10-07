import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

/** Mirrors `GET /subscriptions/me` (subscription + plan as sibling fields). */
export type MySubscriptionResponse = {
  subscription: {
    id: string;
    userId: string;
    planId: string;
    status: string;
    startsAt: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
    expiredByDate: boolean;
    effectiveStatus: "active" | "expired" | "cancelled";
  } | null;
  plan: {
    id: string;
    academyId: string;
    name: string;
    recurrenceMonths: number;
    priceCents: number;
    weeklyCheckinLimit: number | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
  academyPlan: "free" | "pro" | null;
};

export function useMySubscription() {
  const api = useApi();

  return useQuery({
    queryKey: ["subscription", "me"],
    queryFn: () => api.get<MySubscriptionResponse>("/subscriptions/me"),
  });
}

export type PaymentItem = {
  id: string;
  subscriptionId: string;
  userId: string;
  academyId: string;
  amountCents: number;
  method: string;
  confirmedBy: string | null;
  referenceMonth: string;
  notes: string | null;
  paidAt: string;
  createdAt: string;
};

type PaymentsResponse = { items: PaymentItem[] };

export function useMyPayments() {
  const api = useApi();

  return useQuery({
    queryKey: ["payments", "me"],
    queryFn: () => api.get<PaymentsResponse>("/payments/me"),
    select: (data) => data.items,
  });
}

export function useSelectPlan() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { planId: string; dependentId?: string }) =>
      api.post<MySubscriptionResponse>("/subscriptions/me/plan", params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subscription", "me"] });
      queryClient.invalidateQueries({ queryKey: ["payments", "me"] });
      queryClient.invalidateQueries({ queryKey: ["checkins", "me"] });
      if (variables.dependentId) {
        queryClient.invalidateQueries({ queryKey: ["subscription", variables.dependentId] });
        queryClient.invalidateQueries({ queryKey: ["payments", variables.dependentId] });
        queryClient.invalidateQueries({ queryKey: ["dependents", "me"] });
      }
    },
  });
}

export function useCreateCheckout() {
  const api = useApi();

  return useMutation({
    mutationFn: (body?: { subscriptionId?: string }) =>
      api.post<{ checkoutUrl: string }>("/payments/checkout", body ?? {}),
  });
}

/** Mirrors `POST /payments/pix` — the Asaas rail. */
export type PixChargeResponse = {
  /** The Asaas payment id. Not used for polling: the webhook is what records it. */
  paymentId: string;
  /** Raw base64 PNG, with no `data:` prefix — unlike AbacatePay's. */
  encodedImage: string;
  /** The copy-and-paste Pix code. */
  payload: string;
  /** `YYYY-MM-DD HH:mm:ss`, not ISO, and about a year out — not minutes. */
  expirationDate: string;
  amountCents: number;
};

export function useCreatePixCharge() {
  const api = useApi();

  return useMutation({
    mutationFn: (body: { subscriptionId?: string; cpfCnpj?: string }) =>
      api.post<PixChargeResponse>("/payments/pix", body),
  });
}

/**
 * Whether this subscription's month has been paid, polled while a QR code is on
 * screen.
 *
 * The Asaas rail has no charge-status endpoint to ask — `POST /payments/pix`
 * opens the charge and the webhook is the only thing that records it — so the
 * screen watches for the payment row to appear instead. Which list depends on
 * who is paying: `/payments/me` is `Role.Student` only and answers nothing for
 * a guardian paying a dependent.
 */
export function usePaidForMonth(
  subscriptionId: string,
  referenceMonth: string,
  opts: { dependentId?: string; enabled: boolean },
) {
  const api = useApi();
  const { dependentId, enabled } = opts;

  const { data } = useQuery({
    queryKey: dependentId ? ["payments", dependentId] : ["payments", "me"],
    queryFn: () =>
      api.get<PaymentsResponse>(
        dependentId ? `/payments/dependent/${dependentId}` : "/payments/me",
      ),
    select: (d) => d.items,
    enabled,
    refetchInterval: 5000,
  });

  // Matched on the subscription as well as the month: a student enrolled in two
  // academies has two subscriptions for the same month, and paying one would
  // otherwise announce the other as confirmed.
  return (data ?? []).some(
    (p) =>
      p.subscriptionId === subscriptionId &&
      p.referenceMonth.slice(0, 7) === referenceMonth.slice(0, 7),
  );
}

/** The month a charge opened now belongs to, matching the API's own rule. */
export function currentReferenceMonth(): string {
  return new Date().toISOString().slice(0, 7) + "-01";
}

/**
 * Asaas serves `"2027-10-01 23:59:59"` — a space where ISO wants a `T`, and no
 * zone. Hermes 0.81 does parse that (checked against the engine the app ships,
 * not assumed), so this is not fixing a crash; ECMA-262 only requires the ISO
 * format and leaves the rest implementation-defined, and what this buys is the
 * explicit `null`. `new Date("lixo").toLocaleDateString()` renders the string
 * "Invalid Date" to the student; returning null lets the caller omit the line.
 *
 * Local time is deliberate: the date is read by the person holding the phone.
 */
export function parseAsaasDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, sec] = m;
  return new Date(+y, +mo - 1, +d, +h, +mi, +sec);
}
