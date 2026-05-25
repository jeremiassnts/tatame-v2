import { useApi } from "@/lib/api";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

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
