import type { AsaasAccountStatus } from "../../lib/asaas.js";
import type { PayoutAccountStatus } from "./payout-account.repository.js";

/**
 * Collapses the four areas Asaas reviews into the one state the app gates on.
 *
 * Asaas reports `commercialInfo`, `bankAccountInfo`, `documentation` and
 * `general` independently, and `general` is its own verdict — the only one a
 * split actually depends on. The rest exist to tell the manager what is still
 * missing, which is why they only matter while `general` is not yet approved.
 *
 * `previous` is the status already stored. It is what separates "not approved
 * yet" from "was approved and is not any more": the second is a suspension,
 * and an academy silently sliding back to `pending` would read as a slow
 * onboarding rather than as money that has stopped arriving.
 */
export function derivePayoutAccountStatus(
  status: AsaasAccountStatus,
  previous?: PayoutAccountStatus,
): PayoutAccountStatus {
  if (status.general === "APPROVED") return "approved";

  if (previous === "approved") return "suspended";

  const areas = [
    status.general,
    status.commercialInfo,
    status.bankAccountInfo,
    status.documentation,
  ];
  if (areas.includes("REJECTED")) return "rejected";
  if (status.documentation === "PENDING") return "awaiting_documents";
  if (areas.includes("AWAITING_APPROVAL")) return "under_review";
  return "pending";
}
