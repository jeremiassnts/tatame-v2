import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

type ManagerSubscription = {
  id: string;
  academyId: string;
  plan: "free" | "pro";
  status: "active" | "past_due" | "canceled" | "incomplete";
  stripeCustomerId: string | null;
  currentPeriodEnd: string | null;
  subscribedAt: string;
  canceledAt: string | null;
};

type ManagerLimits = {
  plan: "free" | "pro";
  students: { used: number; limit: number | null };
  plans: { used: number; limit: number | null };
  schedulesPerDay: { maxUsed: number; limit: number | null };
  instructors: { allowed: boolean };
  blocked: boolean;
};

type StartOrReactivateProResponse = {
  intentType: "setup";
  clientSecret: string;
  customerId: string;
};

type CompleteProResponse =
  | {
      intentType: "payment";
      clientSecret: string;
      subscriptionId: string;
    }
  | {
      intentType: "none";
      subscriptionId: string;
    };

type StripePortalResponse = {
  url: string;
};

type ManagerInvoiceItem = {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  referenceMonth: string | null;
  paymentMethodLast4: string | null;
};

type ManagerInvoicesResponse = { items: ManagerInvoiceItem[] };

export function useManagerSubscription() {
  const api = useApi();

  return useQuery({
    queryKey: ["manager-subscription"],
    queryFn: () => api.get<ManagerSubscription>("/manager-subscriptions/me"),
    retry: false,
  });
}

export function useManagerInvoices(opts?: { enabled?: boolean }) {
  const api = useApi();

  return useQuery({
    queryKey: ["manager-invoices"],
    enabled: opts?.enabled ?? true,
    queryFn: () => api.get<ManagerInvoicesResponse>("/manager-subscriptions/invoices"),
    select: (data) => data.items,
  });
}

export function useManagerLimits() {
  const api = useApi();

  return useQuery({
    queryKey: ["manager-limits"],
    queryFn: () => api.get<ManagerLimits>("/manager-subscriptions/limits"),
  });
}

export function useSelectFreePlan() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<ManagerSubscription>("/manager-subscriptions/free"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
      queryClient.invalidateQueries({ queryKey: ["user/me"] });
    },
  });
}

export function useStartProSubscription() {
  const api = useApi();

  return useMutation({
    mutationFn: () =>
      api.post<StartOrReactivateProResponse>("/manager-subscriptions/pro"),
  });
}

export function useCompleteProSubscription() {
  const api = useApi();

  return useMutation({
    mutationFn: (input: { setupIntentId: string }) =>
      api.post<CompleteProResponse>("/manager-subscriptions/pro/complete", input),
  });
}

export function useReactivateSubscription() {
  const api = useApi();

  return useMutation({
    mutationFn: () =>
      api.post<StartOrReactivateProResponse>("/manager-subscriptions/reactivate"),
  });
}

export function useStripePortal() {
  const api = useApi();

  return useMutation({
    mutationFn: () => api.post<StripePortalResponse>("/manager-subscriptions/portal"),
  });
}

