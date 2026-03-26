import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

/** Mirrors `GET /subscriptions/me` (subscription + plan as sibling fields). */
type MySubscriptionResponse = {
  subscription: {
    id: string;
    userId: string;
    planId: string;
    status: string;
    startsAt: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
    expiredByDate: boolean;
    effectiveStatus: "active" | "expired" | "cancelled";
  } | null;
  plan: {
    id: string;
    academyId: string;
    name: string;
    recurrenceMonths: number;
    priceCents: number;
    weeklyCheckinLimit: number | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export function useMySubscription() {
  const api = useApi();

  return useQuery({
    queryKey: ["subscription", "me"],
    queryFn: () => api.get<MySubscriptionResponse>("/subscriptions/me"),
  });
}
