import { PixPaymentView } from "@/components/PixPaymentView";
import { useLocalSearchParams } from "expo-router";

/**
 * The Pix screen for every rail that pays a plan: a student paying their own, a
 * student paying a dependent's, a guardian paying a dependent's.
 *
 * It lives here, above the tab groups, rather than inside one of them. The
 * student's dependent screen is in the `(more)` tab and this used to be in the
 * `(subscription)` tab, so paying crossed tabs — and `router.back()` then
 * landed on that tab's index, "Minha assinatura", instead of the dependent the
 * money was for. Pushed from the root stack it returns to whatever screen
 * opened it, whichever tab or role that was.
 */
export default function PixPaymentScreen() {
  const params = useLocalSearchParams<{
    subscriptionId: string;
    /** Set when the plan being paid belongs to a dependent. */
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
