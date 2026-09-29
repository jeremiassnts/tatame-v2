import { PixPaymentView } from "@/components/PixPaymentView";
import { useLocalSearchParams } from "expo-router";

export default function PixPaymentScreen() {
  const params = useLocalSearchParams<{
    subscriptionId: string;
    planName: string;
    priceCents: string;
  }>();

  return (
    <PixPaymentView
      title="Pagamento Pix"
      subscriptionId={params.subscriptionId}
      planName={params.planName ?? ""}
      priceCents={Number(params.priceCents ?? 0)}
    />
  );
}
