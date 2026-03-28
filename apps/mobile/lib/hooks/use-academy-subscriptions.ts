import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";

export type AcademySubscriptionItem = {
  subscription: {
    id: string;
    userId: string;
    planId: string;
    status: string;
    startsAt: string;
    expiresAt: string;
  };
  plan: {
    id: string;
    name: string;
    priceCents: number;
    recurrenceMonths: number;
    weeklyCheckinLimit: number | null;
    isActive: boolean;
  };
  user: {
    id: string;
    name: string;
    email: string;
    profileImageUrl: string | null;
  };
  lastPayment: {
    referenceMonth: string;
    paidAt: string;
    amountCents: number;
  } | null;
  effectiveStatus: "active" | "expired" | "cancelled";
  hasPaidCurrentMonth: boolean;
};

type AcademySubscriptionsResponse = { items: AcademySubscriptionItem[] };

export function useAcademySubscriptions(filter?: {
  status?: string;
  planId?: string;
  pendingPayment?: boolean;
}) {
  const api = useApi();

  const params = new URLSearchParams();
  if (filter?.status) params.set("status", filter.status);
  if (filter?.planId) params.set("planId", filter.planId);
  if (filter?.pendingPayment) params.set("pendingPayment", "true");
  const qs = params.toString();

  return useQuery({
    queryKey: ["academy-subscriptions", filter],
    queryFn: () =>
      api.get<AcademySubscriptionsResponse>(
        `/subscriptions/academy${qs ? `?${qs}` : ""}`,
      ),
    select: (data) => data.items,
  });
}

export function useAcademySubscription(subscriptionId: string | undefined) {
  const api = useApi();

  return useQuery({
    queryKey: ["academy-subscriptions", subscriptionId],
    queryFn: () =>
      api.get<AcademySubscriptionItem>(
        `/subscriptions/academy/${subscriptionId}`,
      ),
    enabled: !!subscriptionId,
  });
}
