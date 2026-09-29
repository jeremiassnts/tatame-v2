import { randomUUID } from "node:crypto";
import { vi } from "vitest";
import { InMemoryAcademyRepository } from "../modules/academy/academy.repository.in-memory.js";
import { AsaasCustomerService } from "../modules/payment/asaas-customer.service.js";
import { InMemoryPaymentRepository } from "../modules/payment/payment.repository.in-memory.js";
import type { PaymentRow } from "../modules/payment/payment.repository.js";
import { PaymentService } from "../modules/payment/payment.service.js";
import { InMemoryPayoutAccountRepository } from "../modules/payout-account/payout-account.repository.in-memory.js";
import type { PayoutAccountRow } from "../modules/payout-account/payout-account.repository.js";
import {
  InMemoryStudentSubscriptionRepository,
  InMemorySubscriptionPlanRepository,
} from "../modules/subscription/subscription.repository.in-memory.js";
import { InMemoryUserRepository } from "../modules/user/user.repository.in-memory.js";
import {
  makeAcademy,
  makeStudentSubscription,
  makeSubscriptionPlan,
} from "./factories/index.js";

/**
 * One wired `PaymentService` for both Asaas charge paths.
 *
 * Shared because the Pix charge and the card checkout now share a gate — the
 * plan check, the active subscription, the already-paid month and the payout
 * account all live in one place. Two harnesses that drifted apart would let a
 * gate regress on one rail while the other's tests stayed green.
 */

export const QR = {
  encodedImage: "iVBORw0KGgo",
  payload: "00020101021226820014br.gov.bcb.pix",
  expirationDate: "2027-10-02 23:59:59",
};

export const CHECKOUT = {
  id: "chk_new",
  link: "https://sandbox.asaas.com/checkoutSession/show/chk_new",
  status: "ACTIVE",
};

export function payoutAccount(
  academyId: string,
  status: PayoutAccountRow["status"] = "approved",
): PayoutAccountRow {
  const t = new Date();
  return {
    id: randomUUID(),
    academyId,
    provider: "asaas",
    externalAccountId: "acc_1",
    walletId: "wal_academy",
    apiKeyEncrypted: "sealed",
    status,
    generalStatus: status === "approved" ? "APPROVED" : "PENDING",
    commercialInfoStatus: null,
    documentStatus: null,
    bankAccountInfoStatus: null,
    onboardingUrl: null,
    rejectionReason: null,
    approvedAt: status === "approved" ? t : null,
    createdAt: t,
    updatedAt: t,
  };
}

export function currentReferenceMonth(): string {
  return new Date().toISOString().slice(0, 7) + "-01";
}

type FakeCall = ReturnType<typeof vi.fn>;

export interface AsaasChargeHarnessOptions {
  accountStatus?: PayoutAccountRow["status"] | "none";
  asaas?: Partial<{
    createPayment: FakeCall;
    getPixQrCode: FakeCall;
    findPayment: FakeCall;
    deletePayment: FakeCall;
    createCheckout: FakeCall;
    cancelCheckout: FakeCall;
    createCustomer: FakeCall;
    findCustomerByExternalReference: FakeCall;
  }>;
}

export async function setupAsaasCharges(
  opts: AsaasChargeHarnessOptions = {},
) {
  const managerId = randomUUID();
  const academy = makeAcademy({ ownerId: managerId });
  const plan = makeSubscriptionPlan({ academyId: academy.id, priceCents: 15000 });
  const planRepo = new InMemorySubscriptionPlanRepository([plan]);

  const userRepo = new InMemoryUserRepository();
  await userRepo.upsert({
    clerkUserId: "user_student",
    email: "aluno@example.com",
    name: "Aluno Teste",
    profileImageUrl: null,
  });
  const student = (await userRepo.findByClerkId("user_student"))!;

  const subscription = makeStudentSubscription({
    userId: student.id,
    planId: plan.id,
    status: "active",
  });
  const subRepo = new InMemoryStudentSubscriptionRepository(planRepo, [
    subscription,
  ]);

  const payRows: PaymentRow[] = [];
  const payRepo = new InMemoryPaymentRepository(payRows);

  const accountStatus = opts.accountStatus ?? "approved";
  const payoutRepo = new InMemoryPayoutAccountRepository(
    accountStatus === "none" ? [] : [payoutAccount(academy.id, accountStatus)],
  );

  const client = {
    createPayment:
      opts.asaas?.createPayment ??
      vi.fn().mockResolvedValue({ id: "pay_new", status: "PENDING", value: 150 }),
    getPixQrCode: opts.asaas?.getPixQrCode ?? vi.fn().mockResolvedValue(QR),
    findPayment:
      opts.asaas?.findPayment ??
      vi.fn().mockResolvedValue({ id: "pay_open", status: "PENDING", value: 150, deleted: false }),
    deletePayment: opts.asaas?.deletePayment ?? vi.fn().mockResolvedValue(undefined),
    createCheckout:
      opts.asaas?.createCheckout ?? vi.fn().mockResolvedValue(CHECKOUT),
    cancelCheckout:
      opts.asaas?.cancelCheckout ?? vi.fn().mockResolvedValue(undefined),
    createCustomer:
      opts.asaas?.createCustomer ??
      vi.fn().mockResolvedValue({ id: "cus_1", name: "Aluno Teste", cpfCnpj: "41763193640" }),
    findCustomerByExternalReference:
      opts.asaas?.findCustomerByExternalReference ??
      vi.fn().mockResolvedValue(undefined),
  };
  const factory = { root: () => client as never };

  const service = new PaymentService(
    payRepo,
    subRepo,
    new InMemoryAcademyRepository([academy]),
    undefined,
    undefined,
    payoutRepo,
    factory,
    new AsaasCustomerService(userRepo, factory),
  );

  return {
    service,
    client,
    payRepo,
    userRepo,
    managerId,
    academyId: academy.id,
    studentId: student.id,
    subscriptionId: subscription.id,
    plan,
  };
}
