import { sql } from "drizzle-orm";
import { Router } from "express";
import { healthResponseSchema } from "@tatame/validators";
import { getDb } from "./lib/db.js";
import { academyRouter } from "./modules/academy/academy.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { checkinRouter } from "./modules/checkin/checkin.routes.js";
import { classRouter } from "./modules/class/class.routes.js";
import { graduationRouter } from "./modules/graduation/graduation.routes.js";
import { membershipRouter } from "./modules/membership/membership.routes.js";
import { subscriptionRouter } from "./modules/subscription/subscription.routes.js";
import { userRouter } from "./modules/user/user.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  const body = { ok: true as const, service: "tatame-api" };
  const parsed = healthResponseSchema.safeParse(body);
  res.json(parsed.success ? parsed.data : body);
});

apiRouter.get("/ready", async (_req, res) => {
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    res.json({ ok: true, database: "up" });
  } catch {
    res.status(503).json({ ok: false, database: "down" });
  }
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/academies", academyRouter);
apiRouter.use("/classes", classRouter);
apiRouter.use("/checkins", checkinRouter);
apiRouter.use("/memberships", membershipRouter);
apiRouter.use("/graduations", graduationRouter);
apiRouter.use("/subscriptions", subscriptionRouter);
apiRouter.use("/users", userRouter);
