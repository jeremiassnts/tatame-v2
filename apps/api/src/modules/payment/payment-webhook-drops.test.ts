import { logs } from "@opentelemetry/api-logs";
import type { LogRecord, Logger, LoggerProvider } from "@opentelemetry/api-logs";
import type Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * These handlers used to `return` on every unhappy path with no trace at all,
 * while the route still answered 200. This file exists to keep that from coming
 * back: one test per drop, asserting the event and its reason.
 *
 * The two worth caring about most are NO_PENDING_PIX and MISSING_REFERENCE —
 * both mean the provider took the money and we wrote no payment row, which
 * nothing else in the system reports.
 *
 * `logger.ts` reads LOG_LEVEL at module load and vitest runs with NODE_ENV=test,
 * where the logger is silent. So the environment has to be stubbed *before* the
 * module graph loads — hence `resetModules` plus the dynamic imports. Same
 * pattern as telemetry/events.test.ts and telemetry/logger.test.ts.
 */
async function setup() {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const emitted: LogRecord[] = [];
  const logger = { emit: (r: LogRecord) => emitted.push(r) } as unknown as Logger;
  logs.setGlobalLoggerProvider({
    getLogger: () => logger,
  } as unknown as LoggerProvider);
  vi.resetModules();
  vi.stubEnv("LOG_LEVEL", "debug");
  const { AbacatePayWebhookHandler } = await import(
    "./abacatepay-webhook.handler.js"
  );
  const { StripeCheckoutWebhookHandler } = await import(
    "./stripe-checkout-webhook.handler.js"
  );
  const { AsaasPaymentWebhookHandler } = await import(
    "./asaas-payment.handler.js"
  );
  const { InMemoryPaymentRepository } = await import(
    "./payment.repository.in-memory.js"
  );
  return {
    emitted,
    AbacatePayWebhookHandler,
    StripeCheckoutWebhookHandler,
    AsaasPaymentWebhookHandler,
    InMemoryPaymentRepository,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  logs.disable();
});

/** The `payment.webhook_unhandled` reasons emitted, in order. */
function reasons(emitted: LogRecord[]): unknown[] {
  return emitted
    .filter((r) => r.attributes?.["event.name"] === "payment.webhook_unhandled")
    .map((r) => r.attributes?.["event.reason"]);
}

/**
 * Enough of each collaborator for the handler to reach the branch under test.
 * Written as loose stubs rather than full fakes: every test here is about a path
 * that stops early, so the methods past that point are never called.
 */
const noUsers = { findById: async () => undefined } as never;
const noAcademies = { findById: async () => undefined } as never;

describe("AbacatePay webhook drops", () => {
  it("reports an event type it does not handle", async () => {
    const { emitted, AbacatePayWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const handler = new AbacatePayWebhookHandler(
      new InMemoryPaymentRepository(),
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent({ event: "billing.created", data: {} });

    expect(reasons(emitted)).toEqual(["UNKNOWN_EVENT_TYPE"]);
    expect(emitted[0]?.attributes).toMatchObject({
      "app.provider": "abacatepay",
      "app.type": "billing.created",
    });
  });

  it("reports a billing.paid with no QR code id", async () => {
    const { emitted, AbacatePayWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const handler = new AbacatePayWebhookHandler(
      new InMemoryPaymentRepository(),
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent({ event: "billing.paid", data: {} });

    expect(reasons(emitted)).toEqual(["MISSING_REFERENCE"]);
  });

  it("reports a paid Pix with no pending row — money in, nothing recorded", async () => {
    const { emitted, AbacatePayWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const repo = new InMemoryPaymentRepository();
    const handler = new AbacatePayWebhookHandler(repo, noUsers, noAcademies, null);

    await handler.handleEvent({
      event: "billing.paid",
      data: { pixQrCode: { id: "pix_orphan", amount: 9900, kind: "PIX", status: "PAID" } },
    });

    expect(reasons(emitted)).toEqual(["NO_PENDING_PIX"]);
    expect(emitted[0]?.attributes).toMatchObject({ "app.pixQrCodeId": "pix_orphan" });
    // The drop is the point: no payment was written.
    expect(await repo.findByStripePaymentId("pix_orphan")).toBeUndefined();
  });

  it("stays quiet when the provider retries a webhook already handled", async () => {
    const { emitted, AbacatePayWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const repo = new InMemoryPaymentRepository();
    await repo.createPendingPix({
      pixQrCodeId: "pix_1",
      subscriptionId: "sub_1",
      userId: "u1",
      academyId: "a1",
      referenceMonth: "2026-09-01",
      amountCents: 9900,
    });
    await repo.create({
      subscriptionId: "sub_1",
      userId: "u1",
      academyId: "a1",
      amountCents: 9900,
      method: "pix",
      confirmedBy: null,
      stripePaymentId: "pix_1",
      referenceMonth: "2026-09-01",
      notes: null,
      paidAt: new Date(),
    });
    const handler = new AbacatePayWebhookHandler(repo, noUsers, noAcademies, null);

    await handler.handleEvent({
      event: "billing.paid",
      data: { pixQrCode: { id: "pix_1", amount: 9900, kind: "PIX", status: "PAID" } },
    });

    // Idempotency is the system working, not a drop worth reporting.
    expect(reasons(emitted)).toEqual([]);
  });

  it("reports a recorded payment whose student or academy is missing", async () => {
    const { emitted, AbacatePayWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const repo = new InMemoryPaymentRepository();
    await repo.createPendingPix({
      pixQrCodeId: "pix_2",
      subscriptionId: "sub_1",
      userId: "u1",
      academyId: "a1",
      referenceMonth: "2026-09-01",
      amountCents: 9900,
    });
    const handler = new AbacatePayWebhookHandler(
      repo,
      noUsers,
      noAcademies,
      // A non-null email service is what makes the handler walk far enough to
      // look the student up at all.
      {} as never,
    );

    await handler.handleEvent({
      event: "billing.paid",
      data: { pixQrCode: { id: "pix_2", amount: 9900, kind: "PIX", status: "PAID" } },
    });

    expect(reasons(emitted)).toEqual(["USER_OR_ACADEMY_NOT_FOUND"]);
    // Unlike NO_PENDING_PIX, the payment itself did land — only the email is lost.
    expect(await repo.findByStripePaymentId("pix_2")).toBeDefined();
  });
});

describe("Stripe checkout webhook drops", () => {
  /** A completed session carrying whatever metadata the test needs. */
  function completed(metadata: Record<string, string> | null): Stripe.Event {
    return {
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", metadata, amount_total: 9900 } },
    } as unknown as Stripe.Event;
  }

  it("reports a completed session with no metadata, and names what is missing", async () => {
    const { emitted, StripeCheckoutWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const repo = new InMemoryPaymentRepository();
    const handler = new StripeCheckoutWebhookHandler(
      repo,
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent(completed(null));

    expect(reasons(emitted)).toEqual(["MISSING_REFERENCE"]);
    expect(emitted[0]?.attributes).toMatchObject({
      "app.provider": "stripe",
      "app.sessionId": "cs_1",
    });
    expect(emitted[0]?.attributes?.["app.missing"]).toBe(
      "subscriptionId, userId, academyId, referenceMonth",
    );
  });

  it("names only the keys that are actually absent", async () => {
    const { emitted, StripeCheckoutWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const handler = new StripeCheckoutWebhookHandler(
      new InMemoryPaymentRepository(),
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent(
      completed({ subscriptionId: "sub_1", userId: "u1" }),
    );

    expect(emitted[0]?.attributes?.["app.missing"]).toBe(
      "academyId, referenceMonth",
    );
  });

  it("does not report event types it ignores — the subscription handler already does", async () => {
    const { emitted, StripeCheckoutWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const handler = new StripeCheckoutWebhookHandler(
      new InMemoryPaymentRepository(),
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent({
      type: "invoice.paid",
      data: { object: {} },
    } as unknown as Stripe.Event);

    // Both handlers see every event on /webhooks/stripe, so reporting here too
    // would double-count the whole account's traffic.
    expect(reasons(emitted)).toEqual([]);
  });

  it("reports a recorded payment whose student or academy is missing", async () => {
    const { emitted, StripeCheckoutWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const repo = new InMemoryPaymentRepository();
    const handler = new StripeCheckoutWebhookHandler(
      repo,
      noUsers,
      noAcademies,
      {} as never,
    );

    await handler.handleEvent(
      completed({
        subscriptionId: "sub_1",
        userId: "u1",
        academyId: "a1",
        referenceMonth: "2026-09-01",
      }),
    );

    expect(reasons(emitted)).toEqual(["USER_OR_ACADEMY_NOT_FOUND"]);
    expect(await repo.findByStripePaymentId("cs_1")).toBeDefined();
  });
});

describe("Asaas payment webhook drops", () => {
  const paid = {
    id: "evt_1",
    event: "PAYMENT_RECEIVED",
    account: { id: "c2b4388d-d81b-4a76-bad3-8d4519b302e1", ownerId: null },
    payment: {
      id: "pay_orphan",
      status: "RECEIVED",
      value: 150,
      billingType: "PIX",
      checkoutSession: null,
    },
  };

  it("reports an event type it does not handle", async () => {
    const { emitted, AsaasPaymentWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const handler = new AsaasPaymentWebhookHandler(
      new InMemoryPaymentRepository(),
      noUsers,
      noAcademies,
      null,
    );

    // Deliberately an event the root webhook is *not* registered for. The
    // reversals it is registered for have their own signal — see below — and
    // using one of them here would make this test pass for the wrong reason.
    await handler.handleEvent({ ...paid, event: "PAYMENT_OVERDUE" });

    expect(reasons(emitted)).toEqual(["UNKNOWN_EVENT_TYPE"]);
    expect(emitted[0]?.attributes).toMatchObject({
      "app.provider": "asaas",
      "app.type": "PAYMENT_OVERDUE",
    });
  });

  // D5 deletes the month's open charge on every manual settlement, and both
  // charge paths delete stale ones. If this were reported, a manager taking
  // cash at the counter would raise a drop alert every time.
  it("says nothing about a charge we deleted ourselves", async () => {
    const { emitted, AsaasPaymentWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const handler = new AsaasPaymentWebhookHandler(
      new InMemoryPaymentRepository(),
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent({ ...paid, event: "PAYMENT_DELETED" });

    expect(reasons(emitted)).toEqual([]);
  });

  // The alert that matters: without this guard a production delivery reaching
  // a development API raises NO_PENDING_CHARGE — "money in, nothing recorded",
  // the loudest signal in the file — for an event that was never ours.
  it("reports a delivery from another Asaas account, not a lost payment", async () => {
    const { emitted, AsaasPaymentWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const handler = new AsaasPaymentWebhookHandler(
      new InMemoryPaymentRepository(),
      noUsers,
      noAcademies,
      null,
      undefined,
      undefined,
      async () => "our-account",
    );

    await handler.handleEvent({
      ...paid,
      account: { id: "another-environment", ownerId: null },
    });

    expect(reasons(emitted)).toEqual(["FOREIGN_ACCOUNT"]);
    expect(emitted[0]?.attributes).toMatchObject({
      "app.sender": "another-environment",
    });
  });

  it("reports a settlement with no payment id", async () => {
    const { emitted, AsaasPaymentWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const handler = new AsaasPaymentWebhookHandler(
      new InMemoryPaymentRepository(),
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent({ ...paid, payment: { status: "RECEIVED" } });

    expect(reasons(emitted)).toEqual(["MISSING_REFERENCE"]);
  });

  it("reports a paid charge with no pending row — money in, nothing recorded", async () => {
    const { emitted, AsaasPaymentWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const repo = new InMemoryPaymentRepository();
    const handler = new AsaasPaymentWebhookHandler(
      repo,
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent(paid);

    expect(reasons(emitted)).toEqual(["NO_PENDING_CHARGE"]);
    expect(emitted[0]?.attributes).toMatchObject({
      "app.asaasPaymentId": "pay_orphan",
    });
    // The drop is the point: no payment was written.
    expect(await repo.findByAcademy("any", {})).toHaveLength(0);
  });

  // A card payment whose checkout we never recorded. Worth its own test because
  // the session id is the only way back — a handler that only looked up by
  // payment id would drop every card payment and this would be the only sign.
  it("reports a card payment whose checkout session is unknown", async () => {
    const { emitted, AsaasPaymentWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const handler = new AsaasPaymentWebhookHandler(
      new InMemoryPaymentRepository(),
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent({
      ...paid,
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_card_orphan",
        status: "CONFIRMED",
        billingType: "CREDIT_CARD",
        checkoutSession: "chk_never_seen",
      },
    });

    expect(reasons(emitted)).toEqual(["NO_PENDING_CHARGE"]);
    expect(emitted[0]?.attributes).toMatchObject({
      "app.checkoutSession": "chk_never_seen",
    });
  });
});

/**
 * B7. Not drops — nothing is lost here — but the same question in the other
 * direction: an Asaas delivery that produces a signal instead of a payment row,
 * asserted through the same log capture.
 *
 * The payload is the real `PAYMENT_REFUNDED` captured from the sandbox on
 * 2026-09-29, trimmed to the fields the handler reads. Its shape is the finding:
 * the delivery carries the whole payment object, so `split[].status` and
 * `cancellationReason` arrive inline — `GET /v3/payments/{id}/splits` answers
 * 404 and never had to be called.
 */
describe("Asaas refunds and chargebacks", () => {
  const OUR_ACCOUNT = "c2b4388d-d81b-4a76-bad3-8d4519b302e1";

  function refunded(over: Record<string, unknown> = {}) {
    return {
      id: "evt_d313266b1bd58128da69a2a96d82e79e&20581202",
      event: "PAYMENT_REFUNDED",
      dateCreated: "2026-09-29 13:09:21",
      account: { id: OUR_ACCOUNT, ownerId: null },
      payment: {
        id: "pay_aalcgxwj24pkd6m5",
        status: "REFUNDED",
        value: 150,
        netValue: 146.53,
        billingType: "CREDIT_CARD",
        checkoutSession: "ea7d07b8-f7a4-437f-b5b7-deaf06c2bb43",
        externalReference: null,
        confirmedDate: "2026-09-29",
        paymentDate: null,
        deleted: false,
        split: [
          {
            walletId: "3cb204e1-e385-4026-9795-51f3f96246b4",
            percentualValue: 100,
            totalValue: 146.53,
            status: "CANCELLED",
            cancellationReason: "PAYMENT_REFUNDED",
          },
        ],
        refunds: [
          { status: "DONE", value: 150, refundedSplits: null },
        ],
        ...over,
      },
    };
  }

  /** The `payment.reversed` records emitted, in order. */
  function reversals(emitted: LogRecord[]) {
    return emitted.filter((r) => r.attributes?.["event.name"] === "payment.reversed");
  }

  /** A repository holding one recorded payment for the refunded charge. */
  async function withRecordedPayment(
    InMemoryPaymentRepository: new () => {
      create(data: Record<string, unknown>): Promise<{ id: string }>;
    },
  ) {
    const repo = new InMemoryPaymentRepository();
    const row = await repo.create({
      subscriptionId: "sub_1",
      userId: "u1",
      academyId: "a1",
      amountCents: 15000,
      method: "stripe",
      confirmedBy: null,
      stripePaymentId: null,
      asaasPaymentId: "pay_aalcgxwj24pkd6m5",
      referenceMonth: "2026-09-01",
      notes: null,
      paidAt: new Date("2026-09-29T12:00:00Z"),
    });
    return { repo, row };
  }

  it("names the student, academy and payment whose money went back", async () => {
    const { emitted, AsaasPaymentWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const { repo, row } = await withRecordedPayment(
      InMemoryPaymentRepository as never,
    );
    const handler = new AsaasPaymentWebhookHandler(
      repo as never,
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent(refunded());

    expect(reversals(emitted)).toHaveLength(1);
    expect(reversals(emitted)[0]?.attributes).toMatchObject({
      "user.id": "u1",
      "app.academy.id": "a1",
      "app.subscription.id": "sub_1",
      "app.payment.id": row.id,
      "app.recorded": true,
    });
  });

  it("carries the split cancellation Asaas performed on the academy's side", async () => {
    const { emitted, AsaasPaymentWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const { repo } = await withRecordedPayment(InMemoryPaymentRepository as never);
    const handler = new AsaasPaymentWebhookHandler(
      repo as never,
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent(refunded());

    // SPLIT-05: the academy is the one that loses the money, and this is the
    // only place that says so.
    expect(reversals(emitted)[0]?.attributes).toMatchObject({
      "app.provider": "asaas",
      "app.type": "PAYMENT_REFUNDED",
      "app.status": "REFUNDED",
      "app.asaasPaymentId": "pay_aalcgxwj24pkd6m5",
      "app.splitStatus": "CANCELLED",
      "app.splitCancellationReason": "PAYMENT_REFUNDED",
    });
  });

  it("still reports a refund of a payment that was never recorded", async () => {
    const { emitted, AsaasPaymentWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const handler = new AsaasPaymentWebhookHandler(
      new InMemoryPaymentRepository(),
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent(refunded());

    // No row to name, and the reversal is still the thing worth knowing.
    expect(reversals(emitted)[0]?.attributes).toMatchObject({
      "app.recorded": false,
    });
    expect(reversals(emitted)[0]?.attributes?.["app.payment.id"]).toBeUndefined();
  });

  it("leaves the recorded payment alone", async () => {
    const { emitted, AsaasPaymentWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const { repo } = await withRecordedPayment(InMemoryPaymentRepository as never);
    const handler = new AsaasPaymentWebhookHandler(
      repo as never,
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent(refunded());

    // What a reversed month means for the student's standing is a product
    // decision. B7 makes it visible and touches nothing.
    expect(
      await (repo as never as {
        findByAsaasPaymentId(id: string): Promise<unknown>;
      }).findByAsaasPaymentId("pay_aalcgxwj24pkd6m5"),
    ).toBeDefined();
    expect(reversals(emitted)).toHaveLength(1);
  });

  it.each([
    "PAYMENT_CHARGEBACK_REQUESTED",
    "PAYMENT_CHARGEBACK_DISPUTE",
    "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
  ])("reports %s as the same signal, told apart by its type", async (event) => {
    const { emitted, AsaasPaymentWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const handler = new AsaasPaymentWebhookHandler(
      new InMemoryPaymentRepository(),
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent({ ...refunded(), event });

    // One broad signal, the stage in `app.type` — not a reason per stage.
    expect(reversals(emitted)).toHaveLength(1);
    expect(reversals(emitted)[0]?.attributes).toMatchObject({ "app.type": event });
  });

  it("carries the chargeback status and reason when Asaas sends one", async () => {
    const { emitted, AsaasPaymentWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const handler = new AsaasPaymentWebhookHandler(
      new InMemoryPaymentRepository(),
      noUsers,
      noAcademies,
      null,
    );

    await handler.handleEvent({
      ...refunded(),
      event: "PAYMENT_CHARGEBACK_REQUESTED",
      payment: {
        ...refunded().payment,
        status: "CHARGEBACK_REQUESTED",
        chargeback: { status: "REQUESTED", reason: "PROCESS_ERROR" },
      },
    });

    expect(reversals(emitted)[0]?.attributes).toMatchObject({
      "app.chargebackStatus": "REQUESTED",
      "app.chargebackReason": "PROCESS_ERROR",
    });
  });

  it("counts none of the four as an unhandled event", async () => {
    const { emitted, AsaasPaymentWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const handler = new AsaasPaymentWebhookHandler(
      new InMemoryPaymentRepository(),
      noUsers,
      noAcademies,
      null,
    );

    for (const event of [
      "PAYMENT_REFUNDED",
      "PAYMENT_CHARGEBACK_REQUESTED",
      "PAYMENT_CHARGEBACK_DISPUTE",
      "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
    ]) {
      await handler.handleEvent({ ...refunded(), event });
    }

    // The spec's own success criterion for the slice: zero
    // `payment.webhook_unhandled` in a clean run. Every event the root webhook
    // is registered for now has a home.
    expect(reasons(emitted)).toEqual([]);
    expect(reversals(emitted)).toHaveLength(4);
  });

  it("refuses a reversal from another Asaas account", async () => {
    const { emitted, AsaasPaymentWebhookHandler, InMemoryPaymentRepository } =
      await setup();
    const handler = new AsaasPaymentWebhookHandler(
      new InMemoryPaymentRepository(),
      noUsers,
      noAcademies,
      null,
      undefined,
      undefined,
      async () => OUR_ACCOUNT,
    );

    await handler.handleEvent({
      ...refunded(),
      account: { id: "another-environment", ownerId: null },
    });

    // The foreign-account gate comes first, or one environment's refunds would
    // name the other's academies.
    expect(reversals(emitted)).toEqual([]);
    expect(reasons(emitted)).toEqual(["FOREIGN_ACCOUNT"]);
  });
});
