import { loadEnv } from "@tatame/config";
import { Role } from "@tatame/types";
import {
  createPayoutAccountBodySchema,
  uploadPayoutDocumentBodySchema,
  type CreatePayoutAccountBody,
} from "@tatame/validators";
import { Router } from "express";
import multer from "multer";
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

/** Asaas caps uploads at 5 MB; anything larger is refused before it is read. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

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

payoutAccountRouter.post(
  "/documents/:groupId",
  ...managerOnly,
  upload.single("documentFile"),
  async (req, res, next) => {
    try {
      assertAsaasConfigured();
      const groupId = req.params.groupId ?? "";
      if (!req.file) {
        throw new HttpError(400, "Envie o arquivo do documento");
      }
      const parsed = uploadPayoutDocumentBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, "Tipo de documento inválido");
      }

      const document = await payoutAccountService.uploadDocument(
        req.appAuth!.userId,
        req.appAuth!.activeAcademyId!,
        groupId,
        {
          type: parsed.data.type,
          file: {
            buffer: req.file.buffer,
            filename: req.file.originalname,
            contentType: req.file.mimetype,
          },
        },
      );
      res.status(201).json({ document });
    } catch (e) {
      next(e);
    }
  },
);

payoutAccountRouter.get("/fees", ...managerOnly, async (_req, res, next) => {
  try {
    assertAsaasConfigured();
    res.json(await feesService.getFees());
  } catch (e) {
    next(e);
  }
});
