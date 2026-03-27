import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import type { CreateCheckinResponse } from "@tatame/validators";

type CheckinItem = {
  id: string;
  classId: string;
  userId: string;
  checkedInAt: string;
  date: string;
  userName?: string;
  userProfileImageUrl?: string | null;
};

type CheckinListResponse = { items: CheckinItem[] };

export type { CheckinItem };

export function useClassCheckins(classId: string, date: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["checkins", classId, date],
    queryFn: () =>
      api.get<CheckinListResponse>(
        `/classes/${classId}/checkins?date=${encodeURIComponent(date)}`,
      ),
    select: (data) => data.items,
    enabled: Boolean(classId) && Boolean(date),
  });
}

export function useCheckin() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { classId: string; date: string }) =>
      api.post<CreateCheckinResponse>("/checkins", body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["checkins", variables.classId, variables.date],
      });
    },
  });
}
