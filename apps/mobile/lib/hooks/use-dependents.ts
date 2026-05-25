import { useApi } from "@/lib/api";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { MySubscriptionResponse, PaymentItem } from "./use-subscription";

type DependentItem = {
  id: string;
  guardianId: string;
  academyId: string;
  name: string;
  birthDate: string;
  currentBelt: { belt: string; stripes: number } | null;
  subscriptionStatus: "active" | "expired" | "none" | null;
  createdAt: string;
};

type DependentsResponse = {
  items: DependentItem[];
};

export type { DependentItem };

export function useDependents() {
  const api = useApi();
  return useQuery({
    queryKey: ["dependents", "me"],
    queryFn: () => api.get<DependentsResponse>("/dependents/me"),
  });
}

export function useDependent(id: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["dependents", id],
    enabled: !!id,
    queryFn: () => api.get<DependentItem>(`/dependents/${id}`),
  });
}

export function useCreateDependent() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      birthDate: string;
      belt: string;
      stripes: number;
    }) => api.post<DependentItem>("/dependents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dependents"] });
    },
  });
}

export function useUpdateDependent() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      birthDate?: string;
      belt?: string;
      stripes?: number;
    }) => api.put<DependentItem>(`/dependents/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dependents"] });
      queryClient.invalidateQueries({ queryKey: ["dependents", variables.id] });
    },
  });
}

export function useDeleteDependent() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/dependents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dependents"] });
    },
  });
}

type CheckinHistoryWeek = {
  weekReference: string;
  weekLabel: string;
  count: number;
  checkins: Array<{
    id: string;
    className: string;
    date: string;
    dayOfWeek: string;
    time: string;
  }>;
};

type CheckinHistoryResponse = {
  items: CheckinHistoryWeek[];
  nextCursor: string | null;
};

export function useDependentCheckinHistory(dependentId: string | null) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: ["checkins", dependentId, "history"],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set("cursor", pageParam);
      const qs = params.toString();
      return api.get<CheckinHistoryResponse>(
        `/checkins/dependent/${dependentId}/history${qs ? `?${qs}` : ""}`,
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!dependentId,
  });
}

export function useDependentWeeklyCheckinCount(dependentId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["checkins", dependentId, "weekly-count"],
    queryFn: () =>
      api.get<{ count: number; weekReference: string }>(
        `/checkins/dependent/${dependentId}/weekly-count`,
      ),
    enabled: !!dependentId,
  });
}

export function useDependentSubscription(dependentId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["subscription", dependentId],
    queryFn: () =>
      api.get<MySubscriptionResponse>(`/subscriptions/dependent/${dependentId}`),
    enabled: !!dependentId,
  });
}

export function useDependentPayments(dependentId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["payments", dependentId],
    queryFn: () =>
      api.get<{ items: PaymentItem[] }>(`/payments/dependent/${dependentId}`),
    select: (data) => data.items,
    enabled: !!dependentId,
  });
}
