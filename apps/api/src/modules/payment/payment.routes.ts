import { loadEnv } from "@tatame/config";
import { Role } from "@tatame/types";
import type { ConfirmManualPaymentBody } from "@tatame/validators";
import {
  confirmManualPaymentBodySchema,
  createCheckoutBodySchema,
  listPaymentsQuerySchema,
  type CreateCheckoutBody,
} from "@tatame/validators";
import { Router } from "express";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import { getStripe } from "../../lib/stripe.js";
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
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
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

const paymentService = new PaymentService(
  new PostgresPaymentRepository(db),
  new PostgresStudentSubscriptionRepository(db),
  academyRepo,
  buildDispatcher(db),
  managerSubRepo,
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

      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

paymentRouter.post(
  "/checkout",
  authorize(Role.Student, Role.Guardian),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(createCheckoutBodySchema),
  async (req, res, next) => {
    try {
      const env = loadEnv();
      if (!env.STRIPE_SECRET_KEY) {
        throw new HttpError(503, "Stripe is not configured");
      }

      const body = req.validatedBody as CreateCheckoutBody;
      const studentUserId = req.appAuth!.userId;
      const academyId = req.appAuth!.activeAcademyId!;
      const stripe = getStripe();

      const student = await userRepo.findById(studentUserId);
      if (!student) {
        throw new HttpError(404, "Student not found");
      }

      const result = await paymentService.createCheckoutSession(
        studentUserId,
        academyId,
        student.email,
        stripe,
        `${(env.API_PUBLIC_URL ?? `http://localhost:${env.API_PORT}`).replace(/\/$/, "")}/v1`,
        { subscriptionId: body.subscriptionId },
      );

      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

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

      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

paymentRouter.get("/checkout-result", (_req, res) => {
  const success = _req.query.status === "success";
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#0C0C0C;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
.card{padding:40px 24px}.icon{font-size:48px;margin-bottom:16px}h1{font-size:20px;margin:0 0 8px}p{color:#ABABAB;font-size:14px;margin:0}</style>
</head><body><div class="card">
<div class="icon">${success ? "✅" : "❌"}</div>
<h1>${success ? "Pagamento realizado!" : "Pagamento cancelado"}</h1>
<p>${success ? "Você já pode fechar esta página e voltar ao app." : "Nenhuma cobrança foi feita. Feche esta página para voltar ao app."}</p>
</div></body></html>`);
});

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

paymentRouter.get(
  "/dependent/:dependentId",
  authorize(Role.Student, Role.Guardian, Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const { dependentId } = req.params;
      if (!dependentId) { res.status(400).json({ error: "dependentId required" }); return; }
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
