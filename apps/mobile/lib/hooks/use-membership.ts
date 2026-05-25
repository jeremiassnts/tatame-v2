import { useApi } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MemberDetailResponse,
  MemberListItem,
  MembershipResponse,
  PendingMembershipItem,
} from "@tatame/validators";

type MemberFilters = {
  role?: string;
  status?: string;
  q?: string;
};

type MemberListItemWithGraduation = MemberListItem & {
  currentBelt: string | null;
  currentStripes: number | null;
  guardianName?: string | null;
  guardianMembershipId?: string | null;
};

type AcademySearchItem = {
  id: string;
  name: string;
  logoUrl: string | null;
  address: string | null;
};

type SearchAcademiesResponse = {
  items: AcademySearchItem[];
};

type PendingRequestsResponse = {
  items: PendingMembershipItem[];
};

export function useMembers(academyId: string, filters?: MemberFilters) {
  const api = useApi();
  const params = new URLSearchParams({ academyId });

  if (filters?.role) params.set("role", filters.role);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.q) params.set("q", filters.q);

  return useQuery({
    queryKey: ["members", academyId, filters],
    queryFn: () =>
      api.get<MemberListItemWithGraduation[]>(`/memberships?${params.toString()}`),
    enabled: Boolean(academyId),
  });
}

export function useMemberDetail(membershipId: string | undefined) {
  const api = useApi();

  return useQuery({
    queryKey: ["member-detail", membershipId],
    queryFn: () => api.get<MemberDetailResponse>(`/memberships/${membershipId}`),
    enabled: Boolean(membershipId),
  });
}

export function usePendingRequests(academyId: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["pending-requests", academyId],
    queryFn: async () => {
      const response = await api.get<PendingRequestsResponse>(`/memberships/pending?academyId=${academyId}`);
      return response.items;
    },
    enabled: Boolean(academyId),
  });
}

export function useRequestMembership() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (academyId: string) =>
      api.post<MembershipResponse>("/memberships/requests", { academyId }),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useApproveMembership() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (membershipId: string) =>
      api.patch<void>(`/memberships/${membershipId}/approve`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      void queryClient.invalidateQueries({ queryKey: ["academy-stats"] });
    },
  });
}

export function useRejectMembership() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (membershipId: string) =>
      api.patch<void>(`/memberships/${membershipId}/reject`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      void queryClient.invalidateQueries({ queryKey: ["academy-stats"] });
    },
  });
}

export function useBlockMembership() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (membershipId: string) =>
      api.patch<void>(`/memberships/${membershipId}/block`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      void queryClient.invalidateQueries({ queryKey: ["member-detail"] });
    },
  });
}

export function useCancelMembership() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<void>("/memberships/leave"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useSearchAcademies(query: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["academies-search", query],
    queryFn: async () => {
      const response = await api.get<SearchAcademiesResponse>(`/academies?q=${encodeURIComponent(query)}`);
      return response.items;
    },
    enabled: query.length >= 2,
  });
}
