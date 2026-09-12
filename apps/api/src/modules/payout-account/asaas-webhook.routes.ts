import { loadEnv } from "@tatame/config";
import { Router } from "express";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
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

const accountHandler = new AsaasAccountWebhookHandler(
  new PostgresPayoutAccountRepository(getDb()),
  payoutAccountService,
);

asaasWebhookRouter.post("/", async (req, res, next) => {
  try {
    const env = loadEnv();
    if (!env.ASAAS_WEBHOOK_TOKEN) {
      throw new HttpError(503, "Webhook do Asaas não está configurado");
    }
    const token = req.get("asaas-access-token");
    if (token !== env.ASAAS_WEBHOOK_TOKEN) {
      // Deliberately terse: an attacker learns nothing from a 401 body.
      throw new HttpError(401, "Unauthorized");
    }

    const event = req.body as AsaasAccountStatusEvent;
    if (event?.event?.startsWith(ACCOUNT_STATUS_EVENT_PREFIX)) {
      await accountHandler.handleEvent(event);
    }
    // PAYMENT_* lands here too, and is answered 200 until TAT-104 adds its
    // handler — Asaas would otherwise retry it for days against an endpoint
    // that has nothing to do with it yet.

    res.status(200).json({ received: true });
  } catch (e) {
    next(e);
  }
});
