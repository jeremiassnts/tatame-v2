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

export type PixQrCodeResponse = {
  pixQrCodeId: string;
  brCode: string;
  brCodeBase64: string;
  amount: number;
  expiresAt: string;
  metadata: {
    subscriptionId: string;
    userId: string;
    academyId: string;
    referenceMonth: string;
  };
};

export function useCreatePixCheckout() {
  const api = useApi();

  return useMutation({
    mutationFn: (body?: { subscriptionId?: string }) =>
      api.post<PixQrCodeResponse>("/payments/checkout/pix", body ?? {}),
  });
}

export function usePixPaymentStatus(pixQrCodeId: string | null) {
  const api = useApi();

  return useQuery({
    queryKey: ["pix-status", pixQrCodeId],
    queryFn: () =>
      api.get<{ status: string }>(`/payments/pix-status/${pixQrCodeId}`),
    enabled: !!pixQrCodeId,
    refetchInterval: 5000, // Poll every 5 seconds
    select: (data) => data.status,
  });
}
