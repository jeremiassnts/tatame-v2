import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Purchases, { type PurchasesPackage } from "react-native-purchases";

export function useMonthlyPackage() {
  return useQuery({
    queryKey: ["revenuecat", "offerings", "monthly"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const offerings = await Purchases.getOfferings();
      return offerings.current?.monthly ?? null;
    },
  });
}

export type PurchaseError = Error & {
  userCancelled?: boolean;
  code?: string;
};

export function mapPurchaseError(err: unknown): string {
  const e = err as PurchaseError;
  if (e?.userCancelled) return "";
  if (e?.code === "PAYMENT_PENDING_ERROR")
    return "Seu pagamento está sendo processado. Você receberá uma confirmação em breve.";
  if (e?.code === "PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR")
    return "Plano indisponível no momento. Tente novamente mais tarde.";
  if (
    e?.code === "PURCHASE_INVALID_ERROR" ||
    e?.code === "RECEIPT_ALREADY_IN_USE_ERROR"
  )
    return "Essa assinatura já está vinculada a outra conta. Entre em contato com o suporte.";
  if (e?.code === "NETWORK_ERROR")
    return "Sem conexão. Verifique sua internet e tente novamente.";
  return "Não foi possível completar a compra. Tente novamente.";
}

export function usePurchaseSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      return Purchases.purchasePackage(pkg);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
    },
  });
}

export function useRestorePurchases() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => Purchases.restorePurchases(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
    },
  });
}
