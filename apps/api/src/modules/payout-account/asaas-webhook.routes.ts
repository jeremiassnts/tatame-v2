import { loadEnv } from "@tatame/config";
import { Router } from "express";
import { AsaasClient } from "../../lib/asaas.js";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import { emitEvent } from "../../telemetry/events.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { getEmailQueue } from "../email/email.queue.js";
import { EmailService } from "../email/email.service.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { NotificationDispatcher } from "../notification/notification-dispatcher.js";
import { getNotificationQueue } from "../notification/notification.queue.js";
import { PostgresNotificationRepository } from "../notification/notification.repository.postgres.js";
import { NotificationService } from "../notification/notification.service.js";
import {
  AsaasPaymentWebhookHandler,
  PAYMENT_EVENT_PREFIX,
  type AsaasPaymentEvent,
} from "../payment/asaas-payment.handler.js";
import { PostgresPaymentRepository } from "../payment/payment.repository.postgres.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import { PostgresStudentSubscriptionRepository } from "../subscription/subscription.repository.postgres.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { PostgresPayoutAccountRepository } from "./payout-account.repository.postgres.js";
import { payoutAccountService } from "./payout-account.routes.js";
import {
  ACCOUNT_STATUS_EVENT_PREFIX,
  AsaasAccountWebhookHandler,
  type AsaasAccountStatusEvent,
} from "./asaas-account-webhook.handler.js";

/**
 * The single public endpoint Asaas delivers to.
 *
 * Asaas identifies itself with a header token and nothing else — there is no
 * signature to verify — so that check is the whole boundary between this route
 * and anyone able to POST JSON at it.
 *
 * Deliveries are answered 200 once they have been processed. Asaas retries a
 * non-2xx, and for account status a retry is harmless, but answering 200 before
 * the work is done would turn a database outage into silently lost approvals.
 */
export const asaasWebhookRouter = Router();

const db = getDb();
const env = loadEnv();

const accountHandler = new AsaasAccountWebhookHandler(
  new PostgresPayoutAccountRepository(db),
  payoutAccountService,
);

/**
 * Our own account id at Asaas, asked once and kept.
 *
 * It is what tells a delivery from this environment's Asaas account apart from
 * one belonging to another — the sandbox key and the production key are
 * different accounts, so the same webhook url or token living in both is no
 * longer enough for an event to be processed in the wrong place.
 *
 * A failed lookup is not cached: the next delivery asks again, and until one
 * succeeds every event is accepted. Refusing payments because Asaas was
 * briefly unreachable would cost real money to prevent a misconfiguration.
 */
let rootAccountId: Promise<string | null> | null = null;

function resolveRootAccountId(): Promise<string | null> {
  rootAccountId ??= AsaasClient.root()
    .getAccountStatus()
    .then((status) => status.id ?? null)
    .catch(() => {
      rootAccountId = null;
      return null;
    });
  return rootAccountId;
}

const paymentHandler = new AsaasPaymentWebhookHandler(
  new PostgresPaymentRepository(db),
  new PostgresUserRepository(db),
  new PostgresAcademyRepository(db),
  env.REDIS_URL ? new EmailService(getEmailQueue(env.REDIS_URL)) : null,
  new NotificationDispatcher(
    new NotificationService(
      new PostgresNotificationRepository(db),
      new PostgresPushTokenRepository(db),
      env.REDIS_URL ? getNotificationQueue(env.REDIS_URL) : null,
    ),
    new PostgresUserRepository(db),
    new PostgresMembershipRepository(db),
  ),
  new PostgresStudentSubscriptionRepository(db),
  resolveRootAccountId,
);

type AsaasWebhookEvent = AsaasAccountStatusEvent & AsaasPaymentEvent;

/**
 * Which token a delivery has to carry, decided by the stream it belongs to.
 *
 * The two registrations cost very different things to rotate. Both can be
 * changed in place with `PUT /v3/webhooks/{id}`, but the account-status token
 * lives on every subaccount, so rotating it means iterating each academy and
 * decrypting its stored key — code that does not exist. The root webhook is
 * one registration and one call. Binding the money stream to its own value is
 * what keeps it cheap to rotate.
 *
 * An event belonging to neither stream is accepted on either token — it is
 * going to be reported as unhandled anyway, and guessing which registration
 * sent it would just turn a report into a 401.
 */
function tokensFor(
  type: string,
  env: { ASAAS_WEBHOOK_TOKEN?: string; ASAAS_PAYMENT_WEBHOOK_TOKEN?: string },
): string[] {
  const account = env.ASAAS_WEBHOOK_TOKEN!;
  // Falling back keeps an environment that never split them working.
  const payment = env.ASAAS_PAYMENT_WEBHOOK_TOKEN ?? account;

  if (type.startsWith(ACCOUNT_STATUS_EVENT_PREFIX)) return [account];
  if (type.startsWith(PAYMENT_EVENT_PREFIX)) return [payment];
  return [account, payment];
}

asaasWebhookRouter.post("/", async (req, res, next) => {
  try {
    const env = loadEnv();
    if (!env.ASAAS_WEBHOOK_TOKEN) {
      throw new HttpError(503, "Webhook do Asaas não está configurado");
    }
    // Read before authenticating, because which token is expected depends on
    // the stream. It is already-parsed JSON either way — nothing acts on it
    // until the check below passes.
    const event = req.body as AsaasWebhookEvent;
    const type = event?.event ?? "";

    const token = req.get("asaas-access-token");
    if (token === undefined || !tokensFor(type, env).includes(token)) {
      // Deliberately terse: an attacker learns nothing from a 401 body.
      throw new HttpError(401, "Unauthorized");
    }

    // Two streams share one url because Asaas delivers per registered webhook,
    // not per path: `ACCOUNT_STATUS_*` from each academy's subaccount, and
    // `PAYMENT_*` from the platform's root account, where every charge lives.
    if (type.startsWith(ACCOUNT_STATUS_EVENT_PREFIX)) {
      await accountHandler.handleEvent(event);
    } else if (type.startsWith(PAYMENT_EVENT_PREFIX)) {
      await paymentHandler.handleEvent(event);
    } else {
      // Neither stream. Asaas has event families we register for nothing —
      // invoices, transfers, bills — and one arriving here means a webhook was
      // registered with events nobody handles.
      emitEvent("payment.webhook_unhandled", {
        reason: "UNKNOWN_EVENT_TYPE",
        extra: { provider: "asaas", type: type || "(missing)" },
      });
    }

    res.status(200).json({ received: true });
  } catch (e) {
    next(e);
  }
});
