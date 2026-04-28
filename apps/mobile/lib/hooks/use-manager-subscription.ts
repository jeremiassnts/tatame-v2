import { useApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export type ManagerSubscription = {
  id: string;
  academyId: string;
  plan: "free" | "pro";
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  subscribedAt: string;
  canceledAt: string | null;
};

export function useManagerSubscription() {
  const api = useApi();

  return useQuery({
    queryKey: ["manager-subscription"],
    queryFn: () => api.get<ManagerSubscription>("/manager-subscriptions/me"),
    retry: false,
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
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}
