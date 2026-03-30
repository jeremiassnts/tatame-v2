import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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

export function useClassCheckins(
  classId: string,
  date: string,
  options?: { enabled?: boolean },
) {
  const api = useApi();
  const enabled =
    options?.enabled !== undefined
      ? options.enabled
      : Boolean(classId) && Boolean(date);

  return useQuery({
    queryKey: ["checkins", classId, date],
    queryFn: () =>
      api.get<CheckinListResponse>(
        `/classes/${classId}/checkins?date=${encodeURIComponent(date)}`,
      ),
    select: (data) => data.items,
    enabled: enabled && Boolean(classId) && Boolean(date),
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
      queryClient.invalidateQueries({ queryKey: ["checkins", "me"] });
    },
  });
}

type WeeklyCheckinCountResponse = {
  count: number;
  weekReference: string;
};

export function useWeeklyCheckinCount() {
  const api = useApi();

  return useQuery({
    queryKey: ["checkins", "me", "weekly-count"],
    queryFn: () =>
      api.get<WeeklyCheckinCountResponse>("/checkins/me/weekly-count"),
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

export function useCheckinHistory() {
  const api = useApi();

  return useInfiniteQuery({
    queryKey: ["checkins", "me", "history"],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set("cursor", pageParam);
      const qs = params.toString();
      return api.get<CheckinHistoryResponse>(
        `/checkins/me/history${qs ? `?${qs}` : ""}`,
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
