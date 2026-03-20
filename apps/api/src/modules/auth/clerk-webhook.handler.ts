import type { UserJSON } from "@clerk/backend";
import type { Request, Response } from "express";
import { verifyWebhook } from "@clerk/express/webhooks";
import { clerkWebhookSigningSecret, loadEnv } from "@tatame/config";
import { getDb } from "../../lib/db.js";
import { PostgresAcademyRepository } from "../academy/academy.repository.postgres.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { UserService } from "../user/user.service.js";

function primaryEmail(data: UserJSON): string | undefined {
  const list = data.email_addresses ?? [];
  const primaryId = data.primary_email_address_id;
  const chosen = primaryId
    ? list.find((e) => e.id === primaryId)
    : list[0];
  return chosen?.email_address;
}

function displayName(data: UserJSON): string {
  const parts = [data.first_name, data.last_name].filter(
    (x): x is string => Boolean(x?.trim()),
  );
  if (parts.length) return parts.join(" ");
  if (data.username) return data.username;
  return primaryEmail(data) ?? "User";
}

const db = getDb();
const userService = new UserService(new PostgresUserRepository(db));
const academyRepo = new PostgresAcademyRepository(db);

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

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const email = primaryEmail(evt.data);
      if (!email) {
        throw new Error("Clerk user has no email; cannot upsert into users");
      }
      await userService.upsertFromClerk({
        clerkUserId: evt.data.id,
        email,
        name: displayName(evt.data),
        profileImageUrl: evt.data.image_url ?? null,
      });
      res.json({ received: true });
      return;
    }

    if (evt.type === "user.deleted") {
      const clerkId = evt.data.id;
      if (clerkId) {
        const user = await userService.getByClerkId(clerkId);
        if (user && (await academyRepo.existsByOwner(user.id))) {
          console.warn(
            `[clerk webhook] Blocked deletion of user ${clerkId}: owns active academies`,
          );
          res.status(409).json({
            error: "Cannot delete user who owns active academies",
          });
          return;
        }
        await userService.deleteByClerkId(clerkId);
      }
      res.json({ received: true });
      return;
    }

    res.json({ received: true, ignored: evt.type });
  } catch (err) {
    console.error("[clerk webhook]", err);
    res.status(400).json({ error: "Webhook verification or handling failed" });
  }
}
