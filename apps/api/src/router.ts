import { sql } from "drizzle-orm";
import { Router } from "express";
import { loadEnv } from "@tatame/config";
import { healthResponseSchema } from "@tatame/validators";
import { getDb } from "./lib/db.js";
import { getRedis } from "./lib/redis.js";
import { academyRouter } from "./modules/academy/academy.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { checkinRouter } from "./modules/checkin/checkin.routes.js";
import { classRouter } from "./modules/class/class.routes.js";
import { financeRouter } from "./modules/finance/finance.routes.js";
import { graduationRouter } from "./modules/graduation/graduation.routes.js";
import { membershipRouter } from "./modules/membership/membership.routes.js";
import { managerSubscriptionRouter } from "./modules/manager-subscription/manager-subscription.routes.js";
import { paymentRouter } from "./modules/payment/payment.routes.js";
import { subscriptionRouter } from "./modules/subscription/subscription.routes.js";
import { announcementRouter } from "./modules/announcement/announcement.routes.js";
import { tutorialRouter } from "./modules/tutorial/tutorial.routes.js";
import { dependentRouter } from "./modules/dependent/dependent.routes.js";
import { notificationRouter } from "./modules/notification/notification.routes.js";
import { pushTokenRouter } from "./modules/push-token/push-token.routes.js";
import { uploadRouter } from "./modules/upload/upload.routes.js";
import { userRouter } from "./modules/user/user.routes.js";

export const apiRouter = Router();

apiRouter.get("/version", (_req, res) => {
  const env = loadEnv();
  res.json({
    minMobileVersion: env.MIN_MOBILE_VERSION,
  });
});

apiRouter.get("/health", (_req, res) => {
  const body = { ok: true as const, service: "tatame-api" };
  const parsed = healthResponseSchema.safeParse(body);
  res.json(parsed.success ? parsed.data : body);
});

apiRouter.get("/ready", async (_req, res) => {
  let database: "up" | "down" = "down";
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    database = "up";
  } catch {
    return res
      .status(503)
      .json({ ok: false, database, redis: "skipped" as const });
  }

  const env = loadEnv();
  if (!env.REDIS_URL) {
    return res.json({ ok: true, database, redis: "skipped" as const });
  }

  try {
    const redis = await getRedis();
    if (!redis) {
      return res
        .status(503)
        .json({ ok: false, database, redis: "down" as const });
    }
    await redis.ping();
    return res.json({ ok: true, database, redis: "up" as const });
  } catch {
    return res
      .status(503)
      .json({ ok: false, database, redis: "down" as const });
  }
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/academies", academyRouter);
apiRouter.use("/classes", classRouter);
apiRouter.use("/checkins", checkinRouter);
apiRouter.use("/memberships", membershipRouter);
apiRouter.use("/manager-subscriptions", managerSubscriptionRouter);
apiRouter.use("/graduations", graduationRouter);
apiRouter.use("/subscriptions", subscriptionRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/finances", financeRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/announcements", announcementRouter);
apiRouter.use("/dependents", dependentRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/push-tokens", pushTokenRouter);
apiRouter.use("/uploads", uploadRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/tutorials", tutorialRouter);
