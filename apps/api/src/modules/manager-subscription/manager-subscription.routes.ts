import { loadEnv } from "@tatame/config";
import { Role } from "@tatame/types";
import { Router } from "express";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import { logger } from "../../lib/logger.js";
import { getStripe } from "../../lib/stripe.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { PostgresManagerSubscriptionRepository } from "./manager-subscription.repository.postgres.js";
import { ManagerSubscriptionService } from "./manager-subscription.service.js";
import { StripeSubscriptionWebhookHandler } from "./stripe-subscription-webhook.handler.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";
import { PostgresPaymentRepository } from "../payment/payment.repository.postgres.js";
import { AbacatePayWebhookHandler } from "../payment/abacatepay-webhook.handler.js";
import { StripeCheckoutWebhookHandler } from "../payment/stripe-checkout-webhook.handler.js";

const db = getDb();
const env = loadEnv();
const subRepo = new PostgresManagerSubscriptionRepository(db);
const acadRepo = new PostgresAcademyRepository(db);
const userRepo = new PostgresUserRepository(db);

const emailService = env.REDIS_URL
  ? new EmailService(getEmailQueue(env.REDIS_URL))
  : null;

const paymentRepo = new PostgresPaymentRepository(db);

function getService() {
  return new ManagerSubscriptionService(subRepo, acadRepo, getStripe());
}

export const managerSubscriptionRouter = Router();

// GET /manager-subscriptions/me — get current subscription
managerSubscriptionRouter.get(
  "/me",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const sub = await getService().getSubscription(req.appAuth!.activeAcademyId!);
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

// POST /manager-subscriptions/checkout — create Stripe Checkout session
managerSubscriptionRouter.post(
  "/checkout",
  authorize(Role.Manager),
  async (req, res, next) => {
    try {
      if (!env.STRIPE_MANAGER_PRICE_ID) {
        throw new HttpError(503, "Stripe price not configured");
      }

      const user = await userRepo.findById(req.appAuth!.userId);
      if (!user) {
        throw new HttpError(404, "User not found");
      }

      const { successUrl, cancelUrl } = req.body as {
        successUrl?: string;
        cancelUrl?: string;
      };
      if (!successUrl || !cancelUrl) {
        throw new HttpError(400, "successUrl and cancelUrl are required");
      }

      const url = await getService().createCheckoutSession(
        user.clerkUserId,
        user.email,
        env.STRIPE_MANAGER_PRICE_ID,
        successUrl,
        cancelUrl,
      );

      res.json({ url });
    } catch (e) {
      next(e);
    }
  },
);

// POST /manager-subscriptions/cancel — cancel at period end
managerSubscriptionRouter.post(
  "/cancel",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      await getService().cancelSubscription(req.appAuth!.activeAcademyId!);
      res.json({ canceled: true });
    } catch (e) {
      next(e);
    }
  },
);

// POST /manager-subscriptions/reactivate — undo cancel
managerSubscriptionRouter.post(
  "/reactivate",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      await getService().reactivateSubscription(req.appAuth!.activeAcademyId!);
      res.json({ reactivated: true });
    } catch (e) {
      next(e);
    }
  },
);

// POST /manager-subscriptions/billing-portal — get Stripe billing portal URL
managerSubscriptionRouter.post(
  "/billing-portal",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const { returnUrl } = req.body as { returnUrl?: string };
      if (!returnUrl) {
        throw new HttpError(400, "returnUrl is required");
      }

      const url = await getService().createBillingPortalSession(
        req.appAuth!.activeAcademyId!,
        returnUrl,
      );

      res.json({ url });
    } catch (e) {
      next(e);
    }
  },
);

export function createWebhookRouter() {
  const webhookRouter = Router();

  // Stripe manager subscription webhooks
  const stripeSubHandler = new StripeSubscriptionWebhookHandler(
    subRepo,
    acadRepo,
    userRepo,
    emailService,
  );

  webhookRouter.post("/stripe-subscription", async (req, res, next) => {
    try {
      if (!env.STRIPE_MANAGER_WEBHOOK_SECRET) {
        throw new HttpError(503, "Stripe manager webhook secret not configured");
      }
      const sig = req.headers["stripe-signature"];
      if (!sig) {
        res.status(400).json({ error: "Missing stripe-signature header" });
        return;
      }
      const stripeInstance = getStripe();
      const event = stripeInstance.webhooks.constructEvent(
        (req as any).rawBody,
        sig,
        env.STRIPE_MANAGER_WEBHOOK_SECRET,
      );
      await stripeSubHandler.handleEvent(event);
      res.json({ received: true });
    } catch (e) {
      if (e instanceof Error && e.message.includes("signature")) {
        res.status(400).json({ error: "Invalid webhook signature" });
        return;
      }
      next(e);
    }
  });

  // AbacatePay student payments
  const abacatePayHandler = new AbacatePayWebhookHandler(
    paymentRepo,
    userRepo,
    acadRepo,
    emailService,
  );

  webhookRouter.post("/abacatepay", async (req, res, next) => {
    try {
      await abacatePayHandler.handleEvent(req.body);
      res.json({ received: true });
    } catch (e) {
      next(e);
    }
  });

  // Stripe checkout student payments
  const stripeCheckoutHandler = new StripeCheckoutWebhookHandler(
    paymentRepo,
    userRepo,
    acadRepo,
    emailService,
  );

  webhookRouter.post("/stripe", async (req, res, next) => {
    try {
      if (!env.STRIPE_WEBHOOK_SECRET) {
        throw new HttpError(503, "Stripe webhook secret not configured");
      }
      const stripeInstance = getStripe();
      const sig = req.headers["stripe-signature"];
      if (!sig) {
        res.status(400).json({ error: "Missing stripe-signature header" });
        return;
      }
      const event = stripeInstance.webhooks.constructEvent(
        (req as any).rawBody,
        sig,
        env.STRIPE_WEBHOOK_SECRET,
      );
      await stripeCheckoutHandler.handleEvent(event);
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
