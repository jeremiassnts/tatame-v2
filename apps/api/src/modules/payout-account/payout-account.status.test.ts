import { describe, expect, it } from "vitest";
import type { AsaasAccountStatus } from "../../lib/asaas.js";
import { derivePayoutAccountStatus } from "./payout-account.status.js";

function asaasStatus(overrides: Partial<AsaasAccountStatus> = {}): AsaasAccountStatus {
  return {
    id: "acc_1",
    commercialInfo: "PENDING",
    bankAccountInfo: "PENDING",
    documentation: "PENDING",
    general: "PENDING",
    ...overrides,
  };
}

describe("derivePayoutAccountStatus", () => {
  it("is approved only when the general approval is approved", () => {
    expect(
      derivePayoutAccountStatus(
        asaasStatus({ general: "APPROVED", documentation: "APPROVED" }),
      ),
    ).toBe("approved");
  });

  it("is approved even while a secondary area lags behind", () => {
    // `general` is Asaas's own verdict; it is what the split depends on.
    expect(
      derivePayoutAccountStatus(
        asaasStatus({ general: "APPROVED", bankAccountInfo: "AWAITING_APPROVAL" }),
      ),
    ).toBe("approved");
  });

  it("is rejected when any area is rejected", () => {
    for (const area of ["commercialInfo", "bankAccountInfo", "documentation", "general"] as const) {
      expect(derivePayoutAccountStatus(asaasStatus({ [area]: "REJECTED" }))).toBe("rejected");
    }
  });

  it("is awaiting_documents while documentation is still pending", () => {
    expect(derivePayoutAccountStatus(asaasStatus({ documentation: "PENDING" }))).toBe(
      "awaiting_documents",
    );
  });

  it("is under_review once something is waiting on Asaas", () => {
    expect(
      derivePayoutAccountStatus(
        asaasStatus({ documentation: "APPROVED", commercialInfo: "AWAITING_APPROVAL" }),
      ),
    ).toBe("under_review");
  });

  it("is pending when nothing has moved yet", () => {
    expect(
      derivePayoutAccountStatus(
        asaasStatus({ documentation: "APPROVED", commercialInfo: "PENDING" }),
      ),
    ).toBe("pending");
  });

  it("is suspended when an approved account loses its general approval", () => {
    expect(
      derivePayoutAccountStatus(
        asaasStatus({ general: "PENDING", documentation: "APPROVED" }),
        "approved",
      ),
    ).toBe("suspended");
  });

  it("stays suspended rather than reporting rejected, so the drop is visible", () => {
    expect(
      derivePayoutAccountStatus(asaasStatus({ general: "REJECTED" }), "approved"),
    ).toBe("suspended");
  });

  it("recovers to approved when Asaas approves the account again", () => {
    expect(
      derivePayoutAccountStatus(asaasStatus({ general: "APPROVED" }), "suspended"),
    ).toBe("approved");
  });

  it("does not suspend an account that was never approved", () => {
    expect(derivePayoutAccountStatus(asaasStatus({ general: "PENDING" }), "pending")).toBe(
      "awaiting_documents",
    );
  });
});
