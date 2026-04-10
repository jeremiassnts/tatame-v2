import { Router } from "express";
import { z } from "zod";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import { adminOnly } from "../../middleware/admin-only.js";
import { PostgresAdminRepository } from "./admin.repository.postgres.js";
import { AdminService } from "./admin.service.js";

export const adminRouter = Router();

const db = getDb();
const adminService = new AdminService(new PostgresAdminRepository(db));

adminRouter.use(adminOnly);

adminRouter.get("/dashboard", async (_req, res, next) => {
  try {
    const data = await adminService.getDashboard();
    res.json(data);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/dashboard/checkins", async (_req, res, next) => {
  try {
    const data = await adminService.getCheckins();
    res.json({ items: data });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/dashboard/financial-summary", async (_req, res, next) => {
  try {
    const data = await adminService.getFinancialSummary();
    res.json(data);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/dashboard/academies", async (_req, res, next) => {
  try {
    const data = await adminService.listAcademies();
    res.json({ items: data });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/academies/:id", async (req, res, next) => {
  try {
    const data = await adminService.getAcademyDetail(req.params.id!);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

const listPaymentsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

adminRouter.get("/academies/:id/payments", async (req, res, next) => {
  try {
    const query = listPaymentsQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new HttpError(400, "Invalid query");
    }
    const data = await adminService.listAcademyPayments(req.params.id!, {
      limit: query.data.limit,
      offset: query.data.offset,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

const transferBodySchema = z.object({
  paymentIds: z.array(z.string().uuid()).min(1),
});

adminRouter.patch("/payments/transfer", async (req, res, next) => {
  try {
    const body = transferBodySchema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, "Invalid body: paymentIds must be a non-empty array of UUIDs");
    }
    const updated = await adminService.confirmTransfer(body.data.paymentIds);
    res.json({ updated });
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/payments/:id/transfer", async (req, res, next) => {
  try {
    const updated = await adminService.confirmTransfer([req.params.id!]);
    res.json({ updated });
  } catch (e) {
    next(e);
  }
});
