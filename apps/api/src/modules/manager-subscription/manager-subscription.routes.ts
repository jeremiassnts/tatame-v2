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
import { requireSession } from "../../middleware/require-session.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { PostgresClassRepository } from "../class/class.repository.postgres.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";
import { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import { getNotificationQueue } from "../notification/notification.queue.js";
import { PostgresNotificationRepository } from "../notification/notification.repository.postgres.js";
import { NotificationService } from "../notification/notification.service.js";
import { AbacatePayWebhookHandler } from "../payment/abacatepay-webhook.handler.js";
import { PostgresPaymentRepository } from "../payment/payment.repository.postgres.js";
import { StripeCheckoutWebhookHandler } from "../payment/stripe-checkout-webhook.handler.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import { PostgresStudentSubscriptionRepository, PostgresSubscriptionPlanRepository } from "../subscription/subscription.repository.postgres.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { UserService } from "../user/user.service.js";
import { PostgresManagerSubscriptionRepository } from "./manager-subscription.repository.postgres.js";
import { ManagerSubscriptionService } from "./manager-subscription.service.js";
import { StripeSubscriptionWebhookHandler } from "./stripe-subscription-webhook.handler.js";

const db = getDb();
const env = loadEnv();
const subRepo = new PostgresManagerSubscriptionRepository(db);
const acadRepo = new PostgresAcademyRepository(db);
const userRepo = new PostgresUserRepository(db);

const membershipRepo = new PostgresMembershipRepository(db);
const planRepo = new PostgresSubscriptionPlanRepository(db);
const classRepo = new PostgresClassRepository(db);

const userService = new UserService(userRepo);

const emailService = env.REDIS_URL
  ? new EmailService(getEmailQueue(env.REDIS_URL))
  : null;

const notifQueue = env.REDIS_URL ? getNotificationQueue(env.REDIS_URL) : null;
const webhookDispatcher = new NotificationDispatcher(
  new NotificationService(
    new PostgresNotificationRepository(db),
    new PostgresPushTokenRepository(db),
    notifQueue,
  ),
  userRepo,
  new PostgresMembershipRepository(db),
);

const paymentRepo = new PostgresPaymentRepository(db);

function getService() {
  return new ManagerSubscriptionService(
    subRepo,
    acadRepo,
    getStripe(),
    membershipRepo,
    planRepo,
    classRepo,
  );
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

// GET /manager-subscriptions/limits — get plan limits and usage
managerSubscriptionRouter.get(
  "/limits",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const limits = await getService().getLimits(req.appAuth!.activeAcademyId!);
      res.json(limits);
    } catch (e) {
      next(e);
    }
  },
);

// POST /manager-subscriptions/free — create free plan for new managers
managerSubscriptionRouter.post(
  "/free",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const sub = await getService().createFree(req.appAuth!.activeAcademyId!);
      res.status(201).json(sub);
    } catch (e) {
      next(e);
    }
  },
);

// POST /manager-subscriptions/checkout — create Stripe Checkout session
// Uses requireSession (not authorize) because the user may not be provisioned yet
// (they just created a Clerk account on the web and haven't done onboarding)
managerSubscriptionRouter.post(
  "/checkout",
  requireSession,
  async (req, res, next) => {
    try {
      if (!env.STRIPE_PRO_PRICE_ID) {
        throw new HttpError(503, "Stripe price not configured");
      }

      const { getAuth } = await import("@clerk/express");
      const { userId: clerkUserId } = getAuth(req);
      if (!clerkUserId) {
        throw new HttpError(401, "Unauthorized");
      }

      const { successUrl, cancelUrl } = req.body as {
        successUrl?: string;
        cancelUrl?: string;
      };
      if (!successUrl || !cancelUrl) {
        throw new HttpError(400, "successUrl and cancelUrl are required");
      }

      // Provision user if not yet in our DB (web signup flow)
      let user = await userRepo.findByClerkId(clerkUserId);
      if (!user) {
        const { clerkClient } = await import("@clerk/express");
        const clerkUser = await clerkClient.users.getUser(clerkUserId);
        const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
        if (!email) {
          throw new HttpError(400, "No email found for user");
        }
        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email;
        await userService.upsertFromClerk({
          clerkUserId,
          email,
          name,
          profileImageUrl: clerkUser.imageUrl ?? null,
        });
        user = await userRepo.findByClerkId(clerkUserId);
        if (!user) throw new HttpError(500, "Failed to provision user");
      }
      const email = user.email;

      // Paying for Pro declares manager intent. Reconcile the role for every
      // user (not just freshly-provisioned ones): a user who signed up in the
      // mobile app first and picked a non-manager role would otherwise stay
      // stuck in the student flow after paying. Real academy members are left
      // untouched — we only flag them for follow-up.
      const roleOutcome = await userService.ensureManagerRole(user.id);
      if (roleOutcome === "skipped-member") {
        logger.warn(
          { userId: user.id },
          "[checkout] user paying Pro has an active academy membership; role not auto-promoted to manager",
        );
      }

      const url = await getService().createCheckoutSession(
        clerkUserId,
        email,
        env.STRIPE_PRO_PRICE_ID,
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

  // AbacatePay student payments
  const studentSubRepo = new PostgresStudentSubscriptionRepository(db);
  const abacatePayHandler = new AbacatePayWebhookHandler(
    paymentRepo,
    userRepo,
    acadRepo,
    emailService,
    webhookDispatcher,
    studentSubRepo,
  );

  webhookRouter.post("/abacatepay", async (req, res, next) => {
    try {
      await abacatePayHandler.handleEvent(req.body as Parameters<typeof abacatePayHandler.handleEvent>[0]);
      res.json({ received: true });
    } catch (e) {
      next(e);
    }
  });

  // Stripe webhooks (student payments + manager subscriptions)
  const stripeCheckoutHandler = new StripeCheckoutWebhookHandler(
    paymentRepo,
    userRepo,
    acadRepo,
    emailService,
    webhookDispatcher,
    studentSubRepo,
  );

  const stripeSubHandler = new StripeSubscriptionWebhookHandler(
    subRepo,
    acadRepo,
    userRepo,
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
        (req as unknown as { rawBody: string | Buffer }).rawBody,
        sig,
        env.STRIPE_WEBHOOK_SECRET,
      );
      await stripeCheckoutHandler.handleEvent(event);
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

  return webhookRouter;
}
