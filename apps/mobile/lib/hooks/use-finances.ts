import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

type FinancialSummary = {
  revenueCurrentMonth: number;
  revenuePreviousMonth: number;
  pendingPaymentsCount: number;
  pendingPaymentsTotal: number;
  activeSubscriptionsCount: number;
};

type PaymentItem = {
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
  userName: string;
};

type PaymentsResponse = { items: PaymentItem[] };

export function useFinancialSummary() {
  const api = useApi();

  return useQuery({
    queryKey: ["financial-summary"],
    queryFn: () => api.get<FinancialSummary>("/finances/summary"),
  });
}

export function usePaymentHistory(opts?: {
  subscriptionId?: string;
  limit?: number;
}) {
  const api = useApi();

  const params = new URLSearchParams();
  if (opts?.subscriptionId) params.set("subscriptionId", opts.subscriptionId);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: ["payments", opts],
    queryFn: () =>
      api.get<PaymentsResponse>(`/payments${qs ? `?${qs}` : ""}`),
    select: (data) => data.items,
  });
}

export function useConfirmPayment() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      subscriptionId: string;
      amountCents: number;
      referenceMonth: string;
      notes?: string | null;
    }) => api.post("/payments", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["academy-subscriptions"] });
    },
  });
}
