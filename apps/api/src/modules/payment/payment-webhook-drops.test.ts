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

    await handler.handleEvent({ ...paid, event: "PAYMENT_REFUNDED" });

    expect(reasons(emitted)).toEqual(["UNKNOWN_EVENT_TYPE"]);
    expect(emitted[0]?.attributes).toMatchObject({
      "app.provider": "asaas",
      "app.type": "PAYMENT_REFUNDED",
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
