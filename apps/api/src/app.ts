import "./express-augment.js";
import cors from "cors";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { clerkAuthorizedParties, loadEnv } from "@tatame/config";
import { apiRouter } from "./router.js";
import { errorHandler } from "./middleware/error-handler.js";

/** Express app without `listen` — used by `server.ts` and tests. */
export function createApp(): express.Express {
  const env = loadEnv();
  const app = express();

  app.use(cors());
  app.use(express.json());

  if (env.CLERK_SECRET_KEY) {
    app.use(
      clerkMiddleware({
        authorizedParties: clerkAuthorizedParties(env),
      }),
    );
  }

  app.use("/v1", apiRouter);
  app.use(errorHandler);

  return app;
}
