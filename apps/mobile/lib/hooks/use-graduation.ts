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
