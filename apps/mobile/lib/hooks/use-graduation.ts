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

export function useGraduationHistory(userId: string | undefined) {
  const api = useApi();

  return useQuery({
    queryKey: ["graduation", userId],
    queryFn: () =>
      api.get<GraduationsResponse>(`/graduations?userId=${userId}`),
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
    }) => api.post<BeltPromotionResponse>("/graduations", body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["graduation", variables.userId],
      });
    },
  });
}
