import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import type {
  BeltPromotionResponse,
  RegisterInitialBeltBody,
} from "@tatame/validators";

type GraduationsResponse = { items: BeltPromotionResponse[] };

export function useMyGraduation() {
  const api = useApi();

  return useQuery({
    queryKey: ["graduation", "me"],
    queryFn: () => api.get<GraduationsResponse>("/graduations/me"),
    retry: false,
    select: (data) => data.items.find((g) => g.isCurrent) ?? null,
  });
}

export function useGraduationHistory(
  userId: string | undefined,
  dependentId?: string | undefined,
) {
  const api = useApi();
  const params = new URLSearchParams();
  if (userId) params.set("userId", userId);
  if (dependentId) params.set("dependentId", dependentId);

  return useQuery({
    queryKey: ["graduation", userId, dependentId ?? null],
    queryFn: () =>
      api.get<GraduationsResponse>(`/graduations?${params.toString()}`),
    enabled: !!userId,
  });
}

export function useRegisterBelt() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: RegisterInitialBeltBody) =>
      api.post<BeltPromotionResponse>("/graduations/initial", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graduation", "me"] });
    },
  });
}

export function usePromoteGraduation() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      userId: string;
      belt: string;
      stripes: number;
      notes?: string | null;
      dependentId?: string | null;
    }) => api.post<BeltPromotionResponse>("/graduations", body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["graduation", variables.userId],
      });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["dependents"] });
    },
  });
}
