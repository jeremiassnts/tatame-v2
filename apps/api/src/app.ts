import "./express-augment.js";
import cors from "cors";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { clerkAuthorizedParties, loadEnv } from "@tatame/config";
import { apiRouter } from "./router.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createWebhookRouter } from "./modules/manager-subscription/manager-subscription.routes.js";

/** Express app without `listen` — used by `server.ts` and tests. */
export function createApp(): express.Express {
  const env = loadEnv();
  const app = express();

  app.use(cors());

  app.use(
    "/v1/webhooks",
    express.raw({ type: "application/json" }),
    (req, _res, next) => {
      (req as any).rawBody = req.body;
      req.body = JSON.parse(req.body.toString());
      next();
    },
  );

  if (env.CLERK_SECRET_KEY) {
    app.use(
      clerkMiddleware({
        authorizedParties: clerkAuthorizedParties(env),
      }),
    );
  }

  app.use(express.json());

  app.use("/v1/webhooks", createWebhookRouter());
  app.use("/v1", apiRouter);
  app.use(errorHandler);

  return app;
}
