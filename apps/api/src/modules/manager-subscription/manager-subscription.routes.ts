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
        const customer = await stripe.customers.create({
          metadata: { academyId, userId },
        });
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

      const stripeSub = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: env.STRIPE_PRO_PRICE_ID }],
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
      });

      const invoice = stripeSub.latest_invoice as Stripe.Invoice;
      const paymentIntent = (invoice as any)
        .payment_intent as Stripe.PaymentIntent | null | undefined;
      if (!paymentIntent?.client_secret) {
        throw new HttpError(500, "Stripe payment intent missing client secret");
      }

      await subRepo.update(sub!.id, {
        stripeSubscriptionId: stripeSub.id,
        status: "incomplete",
      });

      res.json({
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
        const customer = await stripe.customers.create({
          metadata: { academyId, userId: req.appAuth!.userId },
        });
        stripeCustomerId = customer.id;
        await subRepo.update(sub.id, { stripeCustomerId });
      }

      const stripeSub = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: env.STRIPE_PRO_PRICE_ID }],
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
      });

      const invoice = stripeSub.latest_invoice as Stripe.Invoice;
      const paymentIntent = (invoice as any)
        .payment_intent as Stripe.PaymentIntent | null | undefined;
      if (!paymentIntent?.client_secret) {
        throw new HttpError(500, "Stripe payment intent missing client secret");
      }

      await subRepo.update(sub.id, {
        stripeSubscriptionId: stripeSub.id,
        status: "incomplete",
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        subscriptionId: stripeSub.id,
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

