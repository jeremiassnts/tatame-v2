import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

type SubscriptionPlan = {
  id: string;
  academyId: string;
  name: string;
  recurrenceMonths: number;
  priceCents: number;
  weeklyCheckinLimit: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PlansResponse = { items: SubscriptionPlan[] };

export function useSubscriptionPlans() {
  const api = useApi();

  return useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () =>
      api.get<PlansResponse>("/subscriptions/plans?includeInactive=true"),
    select: (data) => data.items,
  });
}

export function useSubscriptionPlan(planId: string | undefined) {
  const api = useApi();

  return useQuery({
    queryKey: ["subscription-plans", planId],
    queryFn: () => api.get<SubscriptionPlan>(`/subscriptions/plans/${planId}`),
    enabled: !!planId,
  });
}

export function useCreatePlan() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      name: string;
      recurrenceMonths: number;
      priceCents: number;
      weeklyCheckinLimit: number | null;
    }) => api.post<SubscriptionPlan>("/subscriptions/plans", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      queryClient.invalidateQueries({ queryKey: ["academy-stats"] });
    },
  });
}

export function useUpdatePlan(planId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      name?: string;
      recurrenceMonths?: number;
      priceCents?: number;
      weeklyCheckinLimit?: number | null;
      isActive?: boolean;
    }) => api.patch<SubscriptionPlan>(`/subscriptions/plans/${planId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      queryClient.invalidateQueries({ queryKey: ["academy-stats"] });
    },
  });
}
