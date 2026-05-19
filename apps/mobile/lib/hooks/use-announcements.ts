import { useApi } from "@/lib/api";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

type AnnouncementItem = {
  id: string;
  academyId: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type AnnouncementsResponse = {
  items: AnnouncementItem[];
  nextCursor: string | null;
  total: number;
};

export type { AnnouncementItem };

export function useAnnouncements(academyId: string | null) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: ["announcements", academyId],
    enabled: !!academyId,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set("cursor", pageParam);
      params.set("limit", "20");
      const qs = params.toString();
      return api.get<AnnouncementsResponse>(`/announcements?${qs}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useAnnouncement(id: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["announcement", id],
    enabled: !!id,
    queryFn: () => api.get<AnnouncementItem>(`/announcements/${id}`),
  });
}

export function useAnnouncementCount(academyId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ["announcement-count", academyId],
    enabled: !!academyId,
    queryFn: async () => {
      const res = await api.get<AnnouncementsResponse>(`/announcements?limit=1`);
      return res.total;
    },
  });
}

export function useCreateAnnouncement() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; body: string; imageUrl?: string }) =>
      api.post<AnnouncementItem>("/announcements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcement-count"] });
    },
  });
}

export function useUpdateAnnouncement() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      body?: string;
      imageUrl?: string | null;
    }) => api.put<AnnouncementItem>(`/announcements/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcement", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["announcement-count"] });
    },
  });
}

export function useDeleteAnnouncement() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcement-count"] });
    },
  });
}
