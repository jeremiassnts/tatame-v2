import { useApi } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type NotificationPreferences = {
  pushEnabled: boolean;
};

export function useNotificationPreferences() {
  const api = useApi();
  return useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => api.get<NotificationPreferences>("/notifications/preferences"),
  });
}

export function useUpdateNotificationPreferences() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NotificationPreferences) =>
      api.put<NotificationPreferences>("/notifications/preferences", data),
    onSuccess: (result) => {
      queryClient.setQueryData(["notification-preferences"], result);
    },
  });
}
