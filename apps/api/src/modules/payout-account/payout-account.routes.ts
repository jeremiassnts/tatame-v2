import { loadEnv } from "@tatame/config";
import { Role } from "@tatame/types";
import {
  createPayoutAccountBodySchema,
  type CreatePayoutAccountBody,
} from "@tatame/validators";
import { Router } from "express";
import { AsaasClient } from "../../lib/asaas.js";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { PayoutAccountFeesService } from "./payout-account.fees.js";
import { PostgresPayoutAccountRepository } from "./payout-account.repository.postgres.js";
import { PayoutAccountService } from "./payout-account.service.js";

export const payoutAccountRouter = Router();

const db = getDb();
const payoutAccountRepo = new PostgresPayoutAccountRepository(db);

export const payoutAccountService = new PayoutAccountService(
  payoutAccountRepo,
  new PostgresAcademyRepository(db),
  AsaasClient,
);

const feesService = new PayoutAccountFeesService(AsaasClient);

/**
 * Every route here is the manager's own academy, so the academy id comes from
 * the session context rather than the path — there is nothing to address by id.
 */
const managerOnly = [
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
] as const;

function assertAsaasConfigured() {
  const env = loadEnv();
  if (!env.ASAAS_API_KEY || !env.ASAAS_BASE_URL) {
    throw new HttpError(503, "Integração de pagamentos não está configurada");
  }
}

payoutAccountRouter.get("/", ...managerOnly, async (req, res, next) => {
  try {
    const account = await payoutAccountService.get(
      req.appAuth!.userId,
      req.appAuth!.activeAcademyId!,
    );
    res.json({ account });
  } catch (e) {
    next(e);
  }
});

payoutAccountRouter.post(
  "/",
  ...managerOnly,
  validateBody(createPayoutAccountBodySchema),
  async (req, res, next) => {
    try {
      assertAsaasConfigured();
      const body = req.validatedBody as CreatePayoutAccountBody;
      const account = await payoutAccountService.create(
        req.appAuth!.userId,
        req.appAuth!.activeAcademyId!,
        body,
      );
      res.status(201).json({ account });
    } catch (e) {
      next(e);
    }
  },
);

payoutAccountRouter.get("/status", ...managerOnly, async (req, res, next) => {
  try {
    assertAsaasConfigured();
    const account = await payoutAccountService.refreshStatus(
      req.appAuth!.userId,
      req.appAuth!.activeAcademyId!,
    );
    res.json({ account });
  } catch (e) {
    next(e);
  }
});

payoutAccountRouter.get("/documents", ...managerOnly, async (req, res, next) => {
  try {
    assertAsaasConfigured();
    const documents = await payoutAccountService.listDocuments(
      req.appAuth!.userId,
      req.appAuth!.activeAcademyId!,
    );
    res.json(documents);
  } catch (e) {
    next(e);
  }
});

payoutAccountRouter.get("/fees", ...managerOnly, async (_req, res, next) => {
  try {
    assertAsaasConfigured();
    res.json(await feesService.getFees());
  } catch (e) {
    next(e);
  }
});
