import Constants from "expo-constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const isExpoGo = Constants.appOwnership === "expo";

type PurchasesModule = typeof import("react-native-purchases").default;
type PurchasesPackageType = import("react-native-purchases").PurchasesPackage;

let Purchases: PurchasesModule | null = null;
if (!isExpoGo) {
  Purchases = require("react-native-purchases").default;
}

export function useMonthlyPackage() {
  return useQuery({
    queryKey: ["revenuecat", "offerings", "monthly"],
    staleTime: 5 * 60 * 1000,
    enabled: !isExpoGo,
    queryFn: async () => {
      if (!Purchases) return null;
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
    mutationFn: async (pkg: PurchasesPackageType) => {
      if (!Purchases) {
        throw new Error("Compras indisponíveis no Expo Go. Use um dev build.");
      }
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
    mutationFn: async () => {
      if (!Purchases) {
        throw new Error("Compras indisponíveis no Expo Go. Use um dev build.");
      }
      return Purchases.restorePurchases();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-subscription"] });
      queryClient.invalidateQueries({ queryKey: ["manager-limits"] });
    },
  });
}
