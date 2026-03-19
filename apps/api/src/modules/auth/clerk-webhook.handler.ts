import type { Request, Response } from "express";
import { verifyWebhook } from "@clerk/express/webhooks";
import { clerkWebhookSigningSecret, loadEnv } from "@tatame/config";
import { getDb } from "../../lib/db.js";
import {
  deleteUserByClerkId,
  upsertUserFromClerk,
} from "../user/user.service.js";

export async function handleClerkWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  const env = loadEnv();
  const signingSecret = clerkWebhookSigningSecret(env);
  if (!signingSecret) {
    res
      .status(503)
      .json({ error: "CLERK_WEBHOOK_SIGNING_SECRET is not configured" });
    return;
  }

  try {
    const evt = await verifyWebhook(req, { signingSecret });
    const db = getDb();

    if (evt.type === "user.created" || evt.type === "user.updated") {
      await upsertUserFromClerk(db, evt.data);
      res.json({ received: true });
      return;
    }

    if (evt.type === "user.deleted") {
      const id = evt.data.id;
      if (id) await deleteUserByClerkId(db, id);
      res.json({ received: true });
      return;
    }

    res.json({ received: true, ignored: evt.type });
  } catch (err) {
    console.error("[clerk webhook]", err);
    res.status(400).json({ error: "Webhook verification or handling failed" });
  }
}
