import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AsaasPaymentWebhookHandler } from "./asaas-payment.handler.js";
import { InMemoryPaymentRepository } from "./payment.repository.in-memory.js";
import type { PaymentRow } from "./payment.repository.js";

/**
 * The webhook is the only thing that records a student payment, so these tests
 * are about one question: does the money end up on a row, exactly once, tied to
 * the right student and month?
 *
 * The payloads are shaped after the real delivery captured from the sandbox on
 * 2026-09-29 — `{ id, event, dateCreated, account, payment }`, with
 * `checkoutSession` on the payment and `externalReference` null.
 */

const SUBSCRIPTION = randomUUID();
const STUDENT = randomUUID();
const ACADEMY = randomUUID();

const student = { id: STUDENT, name: "Aluno Teste", email: "aluno@example.com" };
const academy = { id: ACADEMY, name: "Fighter's BJJ", ownerId: randomUUID(), pixKey: null };

function users(overrides: Record<string, unknown> = {}) {
  return {
    findById: vi.fn(async (id: string) =>
      id === STUDENT ? student : id === academy.ownerId ? { ...student, id } : undefined,
    ),
    ...overrides,
  } as never;
}

function academies() {
  return { findById: vi.fn(async () => academy) } as never;
}

function pixEvent(over: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    event: "PAYMENT_RECEIVED",
    account: { id: "c2b4388d-d81b-4a76-bad3-8d4519b302e1", ownerId: null },
    payment: {
      id: "pay_pix_1",
      status: "RECEIVED",
      value: 150,
      netValue: 149.01,
      billingType: "PIX",
      checkoutSession: null,
      externalReference: null,
      confirmedDate: "2026-09-29",
      paymentDate: "2026-09-29",
      deleted: false,
      ...over,
    },
  };
}

function cardEvent(over: Record<string, unknown> = {}) {
  return {
    id: "evt_2",
    event: "PAYMENT_CONFIRMED",
    account: { id: "c2b4388d-d81b-4a76-bad3-8d4519b302e1", ownerId: null },
    payment: {
      id: "pay_card_1",
      status: "CONFIRMED",
      value: 150,
      netValue: 146.53,
      billingType: "CREDIT_CARD",
      checkoutSession: "6153e592-5def-41b6-a3bc-c160306eb25a",
      externalReference: null,
      confirmedDate: "2026-09-29",
      paymentDate: null,
      deleted: false,
      ...over,
    },
  };
}

async function setup() {
  const rows: PaymentRow[] = [];
  const repo = new InMemoryPaymentRepository(rows);
  const dispatcher = {
    notifyUsers: vi.fn(async () => undefined),
    notifyAcademyManagers: vi.fn(async () => undefined),
  };
  const email = {
    sendPaymentConfirmed: vi.fn(async () => undefined),
    sendStudentPaymentReceived: vi.fn(async () => undefined),
  };
  const handler = new AsaasPaymentWebhookHandler(
    repo,
    users(),
    academies(),
    email as never,
    dispatcher as never,
    { findByIdWithPlan: vi.fn(async () => undefined) } as never,
  );
  return { repo, handler, dispatcher, email, rows };
}

async function pendingPix(repo: InMemoryPaymentRepository) {
  await repo.createPendingAsaas({
    asaasPaymentId: "pay_pix_1",
    kind: "payment",
    subscriptionId: SUBSCRIPTION,
    userId: STUDENT,
    academyId: ACADEMY,
    referenceMonth: "2026-09-01",
    amountCents: 15000,
  });
}

async function pendingCheckout(repo: InMemoryPaymentRepository) {
  await repo.createPendingAsaas({
    asaasPaymentId: "6153e592-5def-41b6-a3bc-c160306eb25a",
    kind: "checkout",
    subscriptionId: SUBSCRIPTION,
    userId: STUDENT,
    academyId: ACADEMY,
    referenceMonth: "2026-09-01",
    amountCents: 15000,
  });
}

describe("AsaasPaymentWebhookHandler", () => {
  let ctx: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    ctx = await setup();
  });

  it("records a Pix payment against the month the charge was opened for", async () => {
    await pendingPix(ctx.repo);

    await ctx.handler.handleEvent(pixEvent());

    const [row] = await ctx.repo.findByAcademy(ACADEMY, {});
    expect(row).toMatchObject({
      subscriptionId: SUBSCRIPTION,
      userId: STUDENT,
      academyId: ACADEMY,
      amountCents: 15000,
      method: "pix",
      asaasPaymentId: "pay_pix_1",
      referenceMonth: "2026-09-01",
      confirmedBy: null,
    });
  });

  // The card rail's whole reconciliation: the payment's own id is one we have
  // never seen, and `checkoutSession` is the only way back to the pending row.
  it("finds a card payment through its checkout session", async () => {
    await pendingCheckout(ctx.repo);

    await ctx.handler.handleEvent(cardEvent());

    const [row] = await ctx.repo.findByAcademy(ACADEMY, {});
    expect(row).toMatchObject({
      subscriptionId: SUBSCRIPTION,
      referenceMonth: "2026-09-01",
      method: "stripe",
      // keyed by the payment, not by the session it came from
      asaasPaymentId: "pay_card_1",
    });
  });

  it("clears the pending row so nothing tries to cancel a paid charge", async () => {
    await pendingCheckout(ctx.repo);

    await ctx.handler.handleEvent(cardEvent());

    expect(
      await ctx.repo.findPendingAsaasBySubscriptionMonth(SUBSCRIPTION, "2026-09-01"),
    ).toBeUndefined();
  });

  // Asaas sends CONFIRMED and then RECEIVED for the same money, and redelivers
  // anything it is unsure about. One payment, one row.
  it("records one row for CONFIRMED followed by RECEIVED", async () => {
    await pendingPix(ctx.repo);

    await ctx.handler.handleEvent(
      pixEvent({ id: "pay_pix_1", status: "CONFIRMED" }),
    );
    await ctx.handler.handleEvent(pixEvent());

    expect(await ctx.repo.findByAcademy(ACADEMY, {})).toHaveLength(1);
  });

  it("records one row when the very same delivery is replayed", async () => {
    await pendingPix(ctx.repo);
    const event = pixEvent();

    await ctx.handler.handleEvent(event);
    await ctx.handler.handleEvent(event);
    await ctx.handler.handleEvent(event);

    expect(await ctx.repo.findByAcademy(ACADEMY, {})).toHaveLength(1);
  });

  // The replay tests above pass for the wrong reason on their own: once the
  // pending row is gone, a second delivery stops at NO_PENDING_CHARGE and the
  // pre-check is never what holds. This is the case that isolates it — the
  // payment is recorded and the pending row outlived it, which is what a failed
  // cleanup or a redelivery mid-flight leaves behind.
  it("records one row when the pending row outlived the payment", async () => {
    await pendingPix(ctx.repo);
    await ctx.handler.handleEvent(pixEvent());
    expect(await ctx.repo.findByAcademy(ACADEMY, {})).toHaveLength(1);

    await pendingPix(ctx.repo);
    await ctx.handler.handleEvent(pixEvent());

    expect(await ctx.repo.findByAcademy(ACADEMY, {})).toHaveLength(1);
  });

  // Losing the race is the payment being recorded by the other delivery, not a
  // failure. Surfacing it would answer 500 to a webhook that succeeded.
  it("treats the unique constraint firing as already recorded", async () => {
    await pendingPix(ctx.repo);
    vi.spyOn(ctx.repo, "create").mockRejectedValueOnce(
      new Error(
        'duplicate key value violates unique constraint "payments_asaas_payment_id_unique"',
      ),
    );

    await expect(ctx.handler.handleEvent(pixEvent())).resolves.toBeUndefined();

    // and it stops claiming the month, exactly as the winning delivery did
    expect(
      await ctx.repo.findPendingAsaasByPaymentId("pay_pix_1"),
    ).toBeUndefined();
  });

  // Narrowed to the column on purpose: any other write failure is a real one.
  it("still raises a failure that is not the duplicate charge", async () => {
    await pendingPix(ctx.repo);
    vi.spyOn(ctx.repo, "create").mockRejectedValueOnce(
      new Error("connection terminated unexpectedly"),
    );

    await expect(ctx.handler.handleEvent(pixEvent())).rejects.toThrow(
      "connection terminated",
    );
  });

  it("notifies the student and the managers, and e-mails both", async () => {
    await pendingPix(ctx.repo);

    await ctx.handler.handleEvent(pixEvent());

    expect(ctx.dispatcher.notifyUsers).toHaveBeenCalledOnce();
    expect(ctx.dispatcher.notifyAcademyManagers).toHaveBeenCalledOnce();
    expect(ctx.email.sendPaymentConfirmed).toHaveBeenCalledOnce();
    expect(ctx.email.sendStudentPaymentReceived).toHaveBeenCalledOnce();
  });

  it("does not notify twice when a delivery is replayed", async () => {
    await pendingPix(ctx.repo);

    await ctx.handler.handleEvent(pixEvent());
    await ctx.handler.handleEvent(pixEvent());

    expect(ctx.dispatcher.notifyUsers).toHaveBeenCalledOnce();
    expect(ctx.email.sendPaymentConfirmed).toHaveBeenCalledOnce();
  });

  it("takes paidAt from Asaas rather than from the clock", async () => {
    await pendingPix(ctx.repo);

    await ctx.handler.handleEvent(pixEvent({ paymentDate: "2026-09-12" }));

    const [row] = await ctx.repo.findByAcademy(ACADEMY, {});
    expect(new Date(row!.paidAt).toISOString().slice(0, 10)).toBe("2026-09-12");
  });

  // A CONFIRMED card payment carries no paymentDate at all.
  it("falls back to confirmedDate when there is no payment date", async () => {
    await pendingCheckout(ctx.repo);

    await ctx.handler.handleEvent(
      cardEvent({ paymentDate: null, clientPaymentDate: null, confirmedDate: "2026-09-12" }),
    );

    const [row] = await ctx.repo.findByAcademy(ACADEMY, {});
    expect(new Date(row!.paidAt).toISOString().slice(0, 10)).toBe("2026-09-12");
  });

  it("records the payment even when the date is unusable", async () => {
    await pendingPix(ctx.repo);

    await ctx.handler.handleEvent(
      pixEvent({ paymentDate: "not-a-date", clientPaymentDate: null, confirmedDate: null }),
    );

    expect(await ctx.repo.findByAcademy(ACADEMY, {})).toHaveLength(1);
  });

  // Every manual settlement deletes the month's open charge (D5), and both
  // charge paths delete stale ones. Reporting these would make a false drop
  // alert the normal outcome of a manager taking cash at the counter.
  it("says nothing about a charge we deleted ourselves", async () => {
    await pendingPix(ctx.repo);

    await ctx.handler.handleEvent({ ...pixEvent(), event: "PAYMENT_DELETED" });

    expect(await ctx.repo.findByAcademy(ACADEMY, {})).toHaveLength(0);
    // and the pending row is left alone — cancelling is what removes it
    expect(
      await ctx.repo.findPendingAsaasByPaymentId("pay_pix_1"),
    ).toBeDefined();
  });

  it("ignores an event that is not a settlement", async () => {
    await pendingPix(ctx.repo);

    await ctx.handler.handleEvent({ ...pixEvent(), event: "PAYMENT_OVERDUE" });

    expect(await ctx.repo.findByAcademy(ACADEMY, {})).toHaveLength(0);
  });
});
