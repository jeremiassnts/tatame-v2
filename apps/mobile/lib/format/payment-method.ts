/**
 * The label to show a student for `payments.method`.
 *
 * Deliberately accepts **both** spellings of the card value. The stored enum
 * label is `stripe` today and TAT-189 is expected to rename it to `card`; this
 * app cannot be fixed remotely when that happens, because `expo-updates` is not
 * installed, so a build that only knows one spelling turns the rename into a
 * store-release dependency. Knowing both costs nothing and means every build
 * shipped from here on reads correctly on either side of that migration.
 *
 * An unknown method falls through to the raw value rather than to a wrong
 * label — the previous shape defaulted to "Manual", which would have asserted
 * the academy took cash for a card payment.
 */
const LABELS: Record<string, string> = {
  pix: "PIX",
  manual: "Manual",
  card: "Cartão",
  /** The same rail under its current, older name. */
  stripe: "Cartão",
};

export function paymentMethodLabel(method: string): string {
  return LABELS[method] ?? method;
}
