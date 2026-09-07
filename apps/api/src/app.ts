import "./express-augment.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import { clerkMiddleware } from "@clerk/express";
import { clerkAuthorizedParties, loadEnv } from "@tatame/config";
import { apiRouter } from "./router.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createWebhookRouter } from "./modules/manager-subscription/manager-subscription.routes.js";

function buildRateLimitStore(redisUrl: string | undefined): RedisStore | undefined {
  if (!redisUrl) return undefined;
  try {
    const client = createClient({ url: redisUrl });
    client.connect().catch(() => {});
    return new RedisStore({
      sendCommand: (...args: string[]) => client.sendCommand(args),
    });
  } catch {
    return undefined;
  }
}

/** Express app without `listen` — used by `server.ts` and tests. */
export function createApp(): express.Express {
  const env = loadEnv();
  const app = express();

  // Trust proxy (Coolify/Traefik/Caddy sets X-Forwarded-For)
  app.set("trust proxy", 1);

  // 0. Static assets (email logo, etc.)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  app.use("/public", express.static(path.join(__dirname, "..", "public")));

  // 1. Security headers
  app.use(helmet());

  // 2. CORS with origin whitelist
  const origins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(",").map((s) => s.trim())
    : undefined;
  app.use(cors({ origin: origins ?? true, credentials: true }));

  // 3. Webhook raw body (before JSON parser)
  app.use(
    "/v1/webhooks",
    express.raw({ type: "application/json" }),
    (req, _res, next) => {
      const raw = req.body as Buffer;
      req.rawBody = raw;
      req.body = JSON.parse(raw.toString()) as unknown;
      next();
    },
  );

  // 4. Clerk auth
  if (env.CLERK_SECRET_KEY) {
    app.use(
      clerkMiddleware({
        authorizedParties: clerkAuthorizedParties(env),
      }),
    );
  }

  // 5. JSON body parser with explicit size limit
  app.use(express.json({ limit: "100kb" }));

  // 6. Rate limiting (skip in test to avoid false failures)
  if (env.NODE_ENV !== "test") {
    const store = buildRateLimitStore(env.REDIS_URL);

    const globalLimiter = rateLimit({
      windowMs: 60 * 1000,
      limit: 100,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      store,
      message: { error: "Too many requests, please try again later" },
    });

    const authLimiter = rateLimit({
      windowMs: 60 * 1000,
      limit: 10,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      store,
      message: { error: "Too many requests, please try again later" },
    });

    app.use("/v1", globalLimiter);
    app.use("/v1/admin/login", authLimiter);
    app.use("/v1/users/me/sync", authLimiter);
  }

  // 7. Routes
  app.use("/v1/webhooks", createWebhookRouter());
  app.use("/v1", apiRouter);

  // 8. Error handler
  app.use(errorHandler);

  return app;
}
