import { PixPaymentView } from "@/components/PixPaymentView";
import { useLocalSearchParams } from "expo-router";

export default function GuardianPixPaymentScreen() {
  const params = useLocalSearchParams<{
    subscriptionId: string;
    dependentId: string;
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
