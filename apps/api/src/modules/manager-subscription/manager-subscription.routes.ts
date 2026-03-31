import { Router } from "express";
import { loadEnv } from "@tatame/config";
import { Role } from "@tatame/types";
import Stripe from "stripe";
import { authorize } from "../../middleware/authorize.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { getDb } from "../../lib/db.js";
import { getStripe } from "../../lib/stripe.js";
import { HttpError } from "../../lib/http-error.js";
import { PostgresManagerSubscriptionRepository } from "./manager-subscription.repository.postgres.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresClassRepository } from "../class/class.repository.postgres.js";
import { PostgresSubscriptionPlanRepository } from "../subscription/subscription.repository.postgres.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { ManagerSubscriptionService } from "./manager-subscription.service.js";
import { StripeWebhookHandler } from "./stripe-webhook.handler.js";

const db = getDb();
const subRepo = new PostgresManagerSubscriptionRepository(db);
const acadRepo = new PostgresAcademyRepository(db);
const memRepo = new PostgresMembershipRepository(db);
const classRepo = new PostgresClassRepository(db);
const planRepo = new PostgresSubscriptionPlanRepository(db);

const service = new ManagerSubscriptionService(
  subRepo,
  acadRepo,
  memRepo,
  classRepo,
  planRepo,
);

const webhookHandler = new StripeWebhookHandler(
  subRepo,
  memRepo,
  classRepo,
  planRepo,
);

export const managerSubscriptionRouter = Router();

type ManagerInvoiceItem = {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  referenceMonth: string | null;
  paymentMethodLast4: string | null;
};

managerSubscriptionRouter.post(
  "/free",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const result = await service.selectFree(
        req.appAuth!.userId,
        req.appAuth!.activeAcademyId!,
      );
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  },
);

managerSubscriptionRouter.post(
  "/pro",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRO_PRICE_ID) {
        throw new HttpError(503, "Stripe is not configured");
      }

      const stripe = getStripe();
      const academyId = req.appAuth!.activeAcademyId!;
      const userId = req.appAuth!.userId;

      let sub = await service.getSubscription(academyId);

      let stripeCustomerId = sub?.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create(
          { metadata: { academyId, userId } },
          { idempotencyKey: `create-customer-${academyId}` },
        );
        stripeCustomerId = customer.id;

        if (sub) {
          await subRepo.update(sub.id, { stripeCustomerId });
        } else {
          sub = await subRepo.create({
            academyId,
            plan: "free",
            status: "incomplete",
            stripeCustomerId,
          });
        }
      }

      res.json({
        intentType: "setup",
        clientSecret: (
          await stripe.setupIntents.create({
            customer: stripeCustomerId,
            payment_method_types: ["card"],
            usage: "off_session",
            metadata: { academyId, userId },
          })
        ).client_secret,
        customerId: stripeCustomerId,
      });
    } catch (e) {
      next(e);
    }
  },
);

managerSubscriptionRouter.post(
  "/pro/complete",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRO_PRICE_ID) {
        throw new HttpError(503, "Stripe is not configured");
      }

      const setupIntentId = (req.body as { setupIntentId?: unknown })
        ?.setupIntentId;
      if (typeof setupIntentId !== "string" || setupIntentId.length < 5) {
        throw new HttpError(400, "Missing setupIntentId");
      }

      const stripe = getStripe();
      const academyId = req.appAuth!.activeAcademyId!;
      const userId = req.appAuth!.userId;

      const sub = await service.getSubscription(academyId);
      if (!sub?.stripeCustomerId) {
        throw new HttpError(400, "No Stripe customer found");
      }

      const si = await stripe.setupIntents.retrieve(setupIntentId, {
        expand: ["payment_method"],
      });
      if (typeof si.customer !== "string" || si.customer !== sub.stripeCustomerId) {
        throw new HttpError(403, "SetupIntent does not belong to this customer");
      }

      const paymentMethodId =
        typeof si.payment_method === "string"
          ? si.payment_method
          : si.payment_method?.id;
      if (!paymentMethodId) {
        throw new HttpError(400, "SetupIntent missing payment method");
      }

      const stripeSub = await stripe.subscriptions.create(
        {
          customer: sub.stripeCustomerId,
          items: [{ price: env.STRIPE_PRO_PRICE_ID }],
          collection_method: "charge_automatically",
          payment_behavior: "default_incomplete",
          default_payment_method: paymentMethodId,
          payment_settings: {
            payment_method_types: ["card"],
            save_default_payment_method: "on_subscription",
          },
          expand: ["latest_invoice.payment_intent"],
          metadata: { academyId, userId },
        },
        { idempotencyKey: `create-pro-sub-${academyId}-${setupIntentId}` },
      );

      const latestInvoiceId =
        typeof stripeSub.latest_invoice === "string"
          ? stripeSub.latest_invoice
          : stripeSub.latest_invoice?.id;
      if (!latestInvoiceId) {
        throw new HttpError(500, "Stripe subscription missing latest invoice");
      }

      type InvoiceWithPaymentIntent = Stripe.Invoice & {
        payment_intent?: string | Stripe.PaymentIntent | null;
      };

      const invoice = (await stripe.invoices.retrieve(latestInvoiceId, {
        expand: ["payment_intent"],
      })) as InvoiceWithPaymentIntent;

      // Some Stripe accounts/scenarios may create the invoice without payment_intent.
      // In that case, attempt to pay the invoice explicitly to force PI creation.
      const maybeInvoiceWithPI = invoice.payment_intent
        ? invoice
        : ((await stripe.invoices.pay(latestInvoiceId, {
            payment_method: paymentMethodId,
            expand: ["payment_intent"],
          })) as InvoiceWithPaymentIntent);

      const paymentIntentIdOrObj = maybeInvoiceWithPI.payment_intent;
      if (!paymentIntentIdOrObj && maybeInvoiceWithPI.status === "paid") {
        const freshSub = await stripe.subscriptions.retrieve(
          stripeSub.id,
        );
        const statusMap: Record<
          string,
          "active" | "past_due" | "canceled" | "incomplete"
        > = {
          active: "active",
          past_due: "past_due",
          canceled: "canceled",
          incomplete: "incomplete",
          trialing: "active",
          unpaid: "past_due",
          paused: "past_due",
          incomplete_expired: "canceled",
        };

        await subRepo.update(sub.id, {
          stripeSubscriptionId: stripeSub.id,
          plan: "pro",
          status: statusMap[freshSub.status] ?? "active",
          currentPeriodEnd: freshSub.items?.data?.[0]?.current_period_end
            ? new Date(freshSub.items.data[0].current_period_end * 1000)
            : null,
        });

        res.json({
          intentType: "none",
          subscriptionId: stripeSub.id,
        });
        return;
      }

      const paymentIntent =
        typeof paymentIntentIdOrObj === "string"
          ? await stripe.paymentIntents.retrieve(paymentIntentIdOrObj)
          : paymentIntentIdOrObj;

      if (!paymentIntent?.client_secret) {
        console.warn("[manager-subscriptions/pro/complete] missing payment intent", {
          stripeSubscriptionId: stripeSub.id,
          latestInvoiceId,
          invoiceStatus: maybeInvoiceWithPI.status,
          collectionMethod: maybeInvoiceWithPI.collection_method,
          billingReason: maybeInvoiceWithPI.billing_reason,
          amountDue: maybeInvoiceWithPI.amount_due,
          currency: maybeInvoiceWithPI.currency,
        });
        throw new HttpError(500, "Stripe payment intent missing client secret");
      }

      await subRepo.update(sub.id, {
        stripeSubscriptionId: stripeSub.id,
        plan: "pro",
        status: "incomplete",
        currentPeriodEnd: stripeSub.items?.data?.[0]?.current_period_end
          ? new Date(stripeSub.items.data[0].current_period_end * 1000)
          : null,
      });

      res.json({
        intentType: "payment",
        clientSecret: paymentIntent.client_secret,
        subscriptionId: stripeSub.id,
      });
    } catch (e) {
      next(e);
    }
  },
);

managerSubscriptionRouter.get(
  "/me",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const sub = await service.getSubscription(req.appAuth!.activeAcademyId!);
      if (!sub) {
        res.status(404).json({ error: "No subscription found" });
        return;
      }
      res.json(sub);
    } catch (e) {
      next(e);
    }
  },
);

managerSubscriptionRouter.get(
  "/limits",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const limits = await service.getLimits(req.appAuth!.activeAcademyId!);
      res.json(limits);
    } catch (e) {
      next(e);
    }
  },
);

managerSubscriptionRouter.get(
  "/invoices",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.STRIPE_SECRET_KEY) {
        throw new HttpError(503, "Stripe is not configured");
      }

      const stripe = getStripe();
      const academyId = req.appAuth!.activeAcademyId!;

      const sub = await service.getSubscription(academyId);
      if (!sub?.stripeCustomerId) {
        res.json({ items: [] satisfies ManagerInvoiceItem[] });
        return;
      }

      const stripeSubscriptionId = sub.stripeSubscriptionId ?? undefined;

      const invoices = await stripe.invoices.list({
        customer: sub.stripeCustomerId,
        subscription: stripeSubscriptionId,
        limit: 3,
        expand: ["data.payments.data.payment.payment_intent.payment_method"],
      });

      const items: ManagerInvoiceItem[] = [];
      for (const inv of invoices.data) {
        let last4: string | null = null;

        const paidEntry = inv.payments?.data?.find((p) => p.status === "paid");
        const pi =
          paidEntry?.payment.payment_intent &&
          typeof paidEntry.payment.payment_intent === "object"
            ? paidEntry.payment.payment_intent
            : null;
        const pm =
          pi && typeof pi.payment_method === "object" ? pi.payment_method : null;
        const cardLast4 = pm?.card?.last4;
        if (typeof cardLast4 === "string") last4 = cardLast4;

        const created = new Date(inv.created * 1000);
        const ref =
          inv.lines?.data?.[0]?.period?.start != null
            ? new Date(inv.lines.data[0].period.start * 1000)
            : created;
        const referenceMonth = `${ref.getUTCFullYear()}-${String(
          ref.getUTCMonth() + 1,
        ).padStart(2, "0")}-01`;

        items.push({
          id: inv.id,
          amountCents: inv.amount_paid ?? inv.amount_due ?? 0,
          currency: inv.currency ?? "brl",
          status: inv.status ?? "unknown",
          createdAt: created.toISOString(),
          referenceMonth,
          paymentMethodLast4: last4,
        });
      }

      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

managerSubscriptionRouter.post(
  "/portal",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const env = loadEnv();
      const stripe = getStripe();
      const sub = await service.getSubscription(req.appAuth!.activeAcademyId!);
      if (!sub?.stripeCustomerId) {
        throw new HttpError(400, "No Stripe customer found");
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: env.API_PUBLIC_URL ?? "tatame://finances",
      });

      res.json({ url: session.url });
    } catch (e) {
      next(e);
    }
  },
);

managerSubscriptionRouter.post(
  "/reactivate",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRO_PRICE_ID) {
        throw new HttpError(503, "Stripe is not configured");
      }

      const stripe = getStripe();
      const academyId = req.appAuth!.activeAcademyId!;
      const sub = await service.getSubscription(academyId);

      if (!sub) {
        throw new HttpError(404, "No subscription found");
      }
      if (sub.status === "active") {
        throw new HttpError(409, "Subscription is already active");
      }

      let stripeCustomerId = sub.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create(
          { metadata: { academyId, userId: req.appAuth!.userId } },
          { idempotencyKey: `create-customer-${academyId}` },
        );
        stripeCustomerId = customer.id;
        await subRepo.update(sub.id, { stripeCustomerId });
      }

      res.json({
        intentType: "setup",
        clientSecret: (
          await stripe.setupIntents.create({
            customer: stripeCustomerId,
            payment_method_types: ["card"],
            usage: "off_session",
            metadata: { academyId, userId: req.appAuth!.userId },
          })
        ).client_secret,
        customerId: stripeCustomerId,
      });
    } catch (e) {
      next(e);
    }
  },
);

export function createWebhookRouter() {
  const webhookRouter = Router();

  webhookRouter.post("/stripe", async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.STRIPE_WEBHOOK_SECRET) {
        throw new HttpError(503, "Stripe webhook secret not configured");
      }

      const stripe = getStripe();
      const sig = req.headers["stripe-signature"];
      if (!sig) {
        res.status(400).json({ error: "Missing stripe-signature header" });
        return;
      }

      const event = stripe.webhooks.constructEvent(
        (req as any).rawBody,
        sig,
        env.STRIPE_WEBHOOK_SECRET,
      );

      await webhookHandler.handleEvent(event);
      res.json({ received: true });
    } catch (e) {
      if (e instanceof Error && e.message.includes("signature")) {
        res.status(400).json({ error: "Invalid webhook signature" });
        return;
      }
      next(e);
    }
  });

  return webhookRouter;
}

