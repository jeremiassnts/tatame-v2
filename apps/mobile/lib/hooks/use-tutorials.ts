import { useApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export type TutorialItem = {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  sortOrder: number;
  createdAt: string;
};

export function useTutorials() {
  const api = useApi();
  return useQuery({
    queryKey: ["tutorials"],
    queryFn: () => api.get<TutorialItem[]>("/tutorials"),
  });
}
