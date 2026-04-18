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
import { PostgresClassRepository } from "../class/class.repository.postgres.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresSubscriptionPlanRepository } from "../subscription/subscription.repository.postgres.js";
import { PostgresManagerSubscriptionRepository } from "./manager-subscription.repository.postgres.js";
import { ManagerSubscriptionService } from "./manager-subscription.service.js";
import { RevenueCatClient } from "./revenuecat-client.js";
import { RevenueCatWebhookHandler } from "./revenuecat-webhook.handler.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";
import { PostgresPaymentRepository } from "../payment/payment.repository.postgres.js";
import { AbacatePayWebhookHandler } from "../payment/abacatepay-webhook.handler.js";
import { StripeCheckoutWebhookHandler } from "../payment/stripe-checkout-webhook.handler.js";
import type { RevenueCatEvent } from "./revenuecat-events.js";

const db = getDb();
const env = loadEnv();
const subRepo = new PostgresManagerSubscriptionRepository(db);
const acadRepo = new PostgresAcademyRepository(db);
const memRepo = new PostgresMembershipRepository(db);
const classRepo = new PostgresClassRepository(db);
const planRepo = new PostgresSubscriptionPlanRepository(db);
const userRepo = new PostgresUserRepository(db);

const emailService = env.REDIS_URL
  ? new EmailService(getEmailQueue(env.REDIS_URL))
  : null;

const paymentRepo = new PostgresPaymentRepository(db);

const revenuecat = env.REVENUECAT_SECRET_API_KEY
  ? new RevenueCatClient(env.REVENUECAT_SECRET_API_KEY)
  : null;

const service = new ManagerSubscriptionService(
  subRepo,
  acadRepo,
  memRepo,
  classRepo,
  planRepo,
  revenuecat,
);

const webhookHandler = new RevenueCatWebhookHandler(
  subRepo,
  userRepo,
  acadRepo,
  emailService,
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
  "/refresh",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const user = await userRepo.findById(req.appAuth!.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const sub = await service.refreshFromRevenueCat(
        user.clerkUserId,
        req.appAuth!.activeAcademyId!,
      );
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

export function createWebhookRouter() {
  const webhookRouter = Router();

  webhookRouter.post("/revenuecat", async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.REVENUECAT_WEBHOOK_SECRET) {
        throw new HttpError(503, "RevenueCat webhook secret not configured");
      }

      const auth = req.headers["authorization"];
      if (auth !== env.REVENUECAT_WEBHOOK_SECRET) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const payload = req.body as RevenueCatEvent;
      if (!payload?.event?.type || !payload.event.app_user_id) {
        res.status(400).json({ error: "invalid payload" });
        return;
      }

      await webhookHandler.handleEvent(payload);
      res.json({ received: true });
    } catch (e) {
      logger.error({ err: e }, "[revenuecat webhook] handler error");
      next(e);
    }
  });

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

  const stripeCheckoutHandler = new StripeCheckoutWebhookHandler(
    paymentRepo,
    userRepo,
    acadRepo,
    emailService,
  );

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
