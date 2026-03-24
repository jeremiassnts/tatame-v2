import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import type { UserMeResponse } from "@tatame/validators";

export function useCurrentUser() {
  const api = useApi();

  return useQuery({
    queryKey: ["user", "me"],
    queryFn: () => api.get<UserMeResponse>("/users/me"),
  });
}
