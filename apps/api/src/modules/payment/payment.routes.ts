import { loadEnv } from "@tatame/config";
import { Role } from "@tatame/types";
import type { ConfirmManualPaymentBody } from "@tatame/validators";
import {
  confirmManualPaymentBodySchema,
  createCheckoutBodySchema,
  createPixChargeBodySchema,
  listPaymentsQuerySchema,
  type CreateCheckoutBody,
  type CreatePixChargeBody,
} from "@tatame/validators";
import { Router } from "express";
import { AsaasClient } from "../../lib/asaas.js";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import { emitEvent } from "../../telemetry/events.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { requireActivePlan } from "../../middleware/require-active-plan.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { PostgresManagerSubscriptionRepository } from "../manager-subscription/manager-subscription.repository.postgres.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import { getNotificationQueue } from "../notification/notification.queue.js";
import { PostgresNotificationRepository } from "../notification/notification.repository.postgres.js";
import { NotificationService } from "../notification/notification.service.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import { PostgresStudentSubscriptionRepository } from "../subscription/subscription.repository.postgres.js";
import { PostgresPayoutAccountRepository } from "../payout-account/payout-account.repository.postgres.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { AsaasCustomerService } from "./asaas-customer.service.js";
import { PostgresDependentRepository } from "../dependent/dependent.repository.postgres.js";
import { PostgresGraduationRepository } from "../graduation/graduation.repository.postgres.js";
import { DependentService } from "../dependent/dependent.service.js";
import { PostgresPaymentRepository } from "./payment.repository.postgres.js";
import { PaymentService } from "./payment.service.js";

export const paymentRouter = Router();

function buildDispatcher(db: ReturnType<typeof getDb>) {
  const env = loadEnv();
  const queue = env.REDIS_URL ? getNotificationQueue(env.REDIS_URL) : null;
  const notificationService = new NotificationService(
    new PostgresNotificationRepository(db),
    new PostgresPushTokenRepository(db),
    queue,
  );
  return new NotificationDispatcher(
    notificationService,
    new PostgresUserRepository(db),
    new PostgresMembershipRepository(db),
  );
}

const db = getDb();
const env = loadEnv();
const academyRepo = new PostgresAcademyRepository(db);
const userRepo = new PostgresUserRepository(db);
const emailService = env.REDIS_URL
  ? new EmailService(getEmailQueue(env.REDIS_URL))
  : null;

const managerSubRepo = new PostgresManagerSubscriptionRepository(db);

const dependentService = new DependentService(
  new PostgresDependentRepository(db),
  new PostgresMembershipRepository(db),
  new PostgresGraduationRepository(db),
  new PostgresStudentSubscriptionRepository(db),
);

const payoutAccountRepo = new PostgresPayoutAccountRepository(db);

const paymentService = new PaymentService(
  new PostgresPaymentRepository(db),
  new PostgresStudentSubscriptionRepository(db),
  academyRepo,
  buildDispatcher(db),
  managerSubRepo,
  payoutAccountRepo,
  // `AsaasClient` itself is the factory; `root()` throws when the keys are
  // absent, which `requireAsaas` turns into a 503 rather than a 500.
  AsaasClient,
  new AsaasCustomerService(userRepo, AsaasClient),
);

paymentRouter.post(
  "/",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  requireActivePlan,
  validateBody(confirmManualPaymentBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as ConfirmManualPaymentBody;
      const managerUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const created = await paymentService.confirmManual(
        managerUserId,
        academyId,
        body,
      );

      // Send payment confirmation email to student
      if (emailService) {
        const student = await userRepo.findById(created.userId);
        const academy = await academyRepo.findById(academyId);
        if (student && academy) {
          await emailService.sendPaymentConfirmed(
            {
              email: student.email,
              studentName: student.name,
              academyName: academy.name,
              amountCents: created.amountCents,
              referenceMonth: created.referenceMonth,
            },
            created.id,
          );
        }
      }

      emitEvent("payment.created", {
        userId: created.userId,
        academyId,
        paymentId: created.id,
        subscriptionId: created.subscriptionId,
        extra: { method: "manual", amountCents: created.amountCents },
      });
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

/**
 * The card checkout, now an Asaas one split whole into the academy's wallet.
 *
 * The path and the `{ checkoutUrl }` shape are unchanged from the Stripe
 * version this replaces, which is the point — mobile changes provider without
 * changing its own contract. The Stripe webhook handler stays, since it
 * is what records sessions already in flight.
 */
paymentRouter.post(
  "/checkout",
  authorize(Role.Student, Role.Guardian),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(createCheckoutBodySchema),
  async (req, res, next) => {
    try {
      const env = loadEnv();
      const body = req.validatedBody as CreateCheckoutBody;
      const studentUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;

      const result = await paymentService.createCheckout(
        studentUserId,
        academyId,
        `${(env.API_PUBLIC_URL ?? `http://localhost:${env.API_PORT}`).replace(/\/$/, "")}/v1`,
        { subscriptionId: body.subscriptionId },
      );

      emitEvent("payment.checkout_started", {
        userId: studentUserId,
        academyId,
        subscriptionId: body.subscriptionId,
        extra: { method: "card", provider: "asaas" },
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

/**
 * The Asaas Pix charge, split whole into the academy's wallet. The rail the
 * current app calls. `/checkout/pix` and `/pix-status/:id` are the AbacatePay
 * pair the shipped build still calls and are live alongside this one for one
 * release — see the note above them.
 */
paymentRouter.post(
  "/pix",
  authorize(Role.Student, Role.Guardian),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(createPixChargeBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as CreatePixChargeBody;
      const studentUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;

      const result = await paymentService.createPixCharge(
        studentUserId,
        academyId,
        { subscriptionId: body.subscriptionId, cpfCnpj: body.cpfCnpj },
      );

      emitEvent("payment.checkout_started", {
        userId: studentUserId,
        academyId,
        subscriptionId: body.subscriptionId,
        extra: { method: "pix", provider: "asaas" },
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

/**
 * The AbacatePay Pix rail, restored after B9 deleted it. `POST /payments/pix`
 * is what the current app calls; these two are what the build on the stores
 * calls, and it cannot be updated over the air. The API has to deploy before a
 * new build clears Apple review, so for one release both are live.
 *
 * **Delete both once `MIN_MOBILE_VERSION` is past the build that stopped
 * calling them.** `api.smoke.test.ts` fails if they go early.
 */
paymentRouter.post(
  "/checkout/pix",
  authorize(Role.Student, Role.Guardian),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(createCheckoutBodySchema),
  async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.ABACATEPAY_API_KEY) {
        throw new HttpError(503, "AbacatePay is not configured");
      }

      const body = req.validatedBody as CreateCheckoutBody;
      const studentUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;

      const result = await paymentService.createPixQrCode(
        studentUserId,
        academyId,
        env.ABACATEPAY_API_KEY,
        { subscriptionId: body.subscriptionId },
      );

      emitEvent("payment.checkout_started", {
        userId: studentUserId,
        academyId,
        subscriptionId: body.subscriptionId,
        extra: { method: "pix" },
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

paymentRouter.get(
  "/pix-status/:pixQrCodeId",
  authorize(Role.Student, Role.Guardian),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.ABACATEPAY_API_KEY) {
        throw new HttpError(503, "AbacatePay is not configured");
      }

      const pixQrCodeId = req.params.pixQrCodeId ?? "";
      const abacateRes = await fetch(
        `https://api.abacatepay.com/v1/pixQrCode/check?id=${encodeURIComponent(pixQrCodeId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${env.ABACATEPAY_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      const rawText = await abacateRes.text();
      let result: { data?: { status?: string } };
      try {
        result = JSON.parse(rawText) as typeof result;
      } catch {
        throw new HttpError(502, "AbacatePay returned invalid response");
      }

      res.json({ status: result.data?.status ?? "UNKNOWN" });
    } catch (e) {
      next(e);
    }
  },
);

/**
 * Where Asaas sends the student's browser when the checkout ends. `expired` is
 * its own outcome because Asaas closes a session after an hour and tells the
 * student nothing about why the link stopped working.
 */
const CHECKOUT_RESULTS = {
  success: {
    icon: "✅",
    title: "Pagamento realizado!",
    body: "Você já pode fechar esta página e voltar ao app.",
  },
  expired: {
    icon: "⏱️",
    title: "O prazo para pagar expirou",
    body: "Nenhuma cobrança foi feita. Volte ao app e gere um novo pagamento.",
  },
  cancel: {
    icon: "❌",
    title: "Pagamento cancelado",
    body: "Nenhuma cobrança foi feita. Feche esta página para voltar ao app.",
  },
} as const;

paymentRouter.get("/checkout-result", (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const result =
    status in CHECKOUT_RESULTS
      ? CHECKOUT_RESULTS[status as keyof typeof CHECKOUT_RESULTS]
      : CHECKOUT_RESULTS.cancel;
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#0C0C0C;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
.card{padding:40px 24px}.icon{font-size:48px;margin-bottom:16px}h1{font-size:20px;margin:0 0 8px}p{color:#ABABAB;font-size:14px;margin:0}</style>
</head><body><div class="card">
<div class="icon">${result.icon}</div>
<h1>${result.title}</h1>
<p>${result.body}</p>
</div></body></html>`);
});

paymentRouter.get(
  "/dependent/:dependentId",
  authorize(Role.Student, Role.Guardian, Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const { dependentId } = req.params;
      if (!dependentId) { res.status(400).json({ error: "dependentId required" }); return; }
      const auth = req.appAuth!;
      await dependentService.getById(auth.userId, auth.role, dependentId, auth.activeAcademyId);
      const items = await paymentService.listForDependent(dependentId);
      res.json({ items });
    } catch (e) { next(e); }
  },
);

paymentRouter.get(
  "/",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const query = listPaymentsQuerySchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "Invalid query");
      }
      const managerUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const items = await paymentService.listForManager(
        managerUserId,
        academyId,
        {
          subscriptionId: query.data.subscriptionId,
          limit: query.data.limit,
        },
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

paymentRouter.get(
  "/me",
  authorize(Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const studentUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const items = await paymentService.listForStudent(
        studentUserId,
        academyId,
      );
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);
