import "./express-augment.js";
import cors from "cors";
import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { clerkAuthorizedParties, loadEnv } from "@tatame/config";
import { apiRouter } from "./router.js";
import { errorHandler } from "./middleware/error-handler.js";
import { handleClerkWebhook } from "./modules/auth/clerk-webhook.handler.js";

const env = loadEnv();
const app = express();

app.use(cors());

app.post(
  "/v1/auth/webhooks/clerk",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    void handleClerkWebhook(req, res).catch(next);
  },
);

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

app.listen(env.API_PORT, () => {
  console.log(`API listening on http://localhost:${env.API_PORT}/v1`);
});
