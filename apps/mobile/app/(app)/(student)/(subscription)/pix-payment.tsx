import { PixPaymentView } from "@/components/PixPaymentView";
import { useLocalSearchParams } from "expo-router";

export default function PixPaymentScreen() {
  const params = useLocalSearchParams<{
    subscriptionId: string;
    /**
     * Set when a student pays for their own dependent. `PixPaymentView` keys
     * both the paid-for-month poll and the post-payment cache invalidation off
     * it, so dropping it here left the dependent's screen showing "Pendente"
     * after a successful payment, with a retry that the API then refused as a
     * duplicate month.
     */
    dependentId?: string;
    planName: string;
    priceCents: string;
  }>();

  return (
    <PixPaymentView
      title="Pagamento Pix"
      subscriptionId={params.subscriptionId}
      dependentId={params.dependentId}
      planName={params.planName ?? ""}
      priceCents={Number(params.priceCents ?? 0)}
    />
  );
}
