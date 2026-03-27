import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import type { CreateClassBody, UpdateClassBody } from "@tatame/validators";

type ClassItem = {
  id: string;
  name: string;
  description: string | null;
  instructorId: string;
  instructorName?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number | null;
  isActive: boolean;
};

type ClassListResponse = { items: ClassItem[] };

export function useClasses(dayOfWeek: number) {
  const api = useApi();

  return useQuery({
    queryKey: ["classes", dayOfWeek],
    queryFn: () => api.get<ClassListResponse>(`/classes?dayOfWeek=${dayOfWeek}`),
    select: (data) => data.items,
  });
}

export function useClass(classId: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["class", classId],
    queryFn: () => api.get<ClassItem>(`/classes/${classId}`),
    enabled: Boolean(classId),
  });
}

export function useCreateClass() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateClassBody) =>
      api.post<ClassItem>("/classes", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}

export function useUpdateClass(classId: string) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateClassBody) =>
      api.patch<ClassItem>(`/classes/${classId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["class", classId] });
    },
  });
}

export function useDeleteClass() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (classId: string) =>
      api.delete<ClassItem>(`/classes/${classId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}
