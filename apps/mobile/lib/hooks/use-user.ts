import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useAuth } from "@clerk/clerk-expo";
import type { UpdateProfileBody, UserMeResponse } from "@tatame/validators";

export function useCurrentUser() {
  const api = useApi();

  return useQuery({
    queryKey: ["user", "me"],
    queryFn: () => api.get<UserMeResponse>("/users/me"),
  });
}

export function useUpdateProfile() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileBody) =>
      api.patch<UserMeResponse>("/users/me", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useDeleteAccount() {
  const api = useApi();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.delete<void>("/users/me"),
    onSuccess: async () => {
      queryClient.clear();
      await signOut();
    },
  });
}
