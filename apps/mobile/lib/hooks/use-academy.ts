import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import type {
  AcademyResponse,
  AcademyStatsResponse,
  CreateAcademyBody,
  UpdateAcademyBody,
} from "@tatame/validators";

export function useAcademy(academyId: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["academy", academyId],
    queryFn: () => api.get<AcademyResponse>(`/academies/${academyId}`),
  });
}

export function useAcademyStats(academyId: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["academy-stats", academyId],
    queryFn: () =>
      api.get<AcademyStatsResponse>(`/academies/${academyId}/stats`),
  });
}

export function useCreateAcademy() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateAcademyBody) =>
      api.post<AcademyResponse>("/academies", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useUpdateAcademy(academyId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateAcademyBody) =>
      api.patch<AcademyResponse>(`/academies/${academyId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy", academyId] });
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useUpdatePixKey(academyId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { pixKeyType: string; pixKey: string }) =>
      api.put<AcademyResponse>("/academies/pix-key", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy", academyId] });
    },
  });
}

export function useDeletePixKey(academyId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.delete<AcademyResponse>("/academies/pix-key"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy", academyId] });
    },
  });
}
