import { createHmac } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { loadEnv } from "@tatame/config";
import { getDb } from "../../lib/db.js";
import { HttpError } from "../../lib/http-error.js";
import { adminOnly } from "../../middleware/admin-only.js";
import { PostgresAdminRepository } from "./admin.repository.postgres.js";
import { AdminService } from "./admin.service.js";
import { emitEvent } from "../../telemetry/events.js";

export const adminRouter = Router();

const db = getDb();
const adminService = new AdminService(new PostgresAdminRepository(db));

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

adminRouter.post("/login", (req, res) => {
  const env = loadEnv();
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.ADMIN_JWT_SECRET) {
    res.status(503).json({ error: "Admin not configured" });
    return;
  }

  const body = loginBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  if (body.data.email !== env.ADMIN_EMAIL || body.data.password !== env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "E-mail ou senha incorretos" });
    return;
  }

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  })).toString("base64url");
  const signature = createHmac("sha256", env.ADMIN_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");

  res.json({ token: `${header}.${payload}.${signature}` });
});

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
    const data = await adminService.getAcademyDetail(req.params.id);
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
    const data = await adminService.listAcademyPayments(req.params.id, {
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
    // One event for the batch, not one per payment: the id list is the detail,
    // and a 200-payment payout should not become 200 log lines.
    emitEvent("payment.transferred", {
      extra: { count: body.data.paymentIds.length, batch: true },
    });
    res.json({ updated });
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/payments/:id/transfer", async (req, res, next) => {
  try {
    const updated = await adminService.confirmTransfer([req.params.id]);
    emitEvent("payment.transferred", { paymentId: req.params.id });
    res.json({ updated });
  } catch (e) {
    next(e);
  }
});
