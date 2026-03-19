import { eq } from "drizzle-orm";
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { users } from "@tatame/db";
import { userMeResponseSchema } from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { requireSession } from "../../middleware/require-session.js";

export const userRouter = Router();

userRouter.get("/me", requireSession, async (req, res, next) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const db = getDb();
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    if (!row) {
      res.status(404).json({
        error: "User not provisioned yet; wait for Clerk webhook sync",
      });
      return;
    }

    const body = {
      id: row.id,
      clerkUserId: row.clerkUserId,
      email: row.email,
      name: row.name,
      profileImageUrl: row.profileImageUrl,
    };
    const parsed = userMeResponseSchema.safeParse(body);
    res.json(parsed.success ? parsed.data : body);
  } catch (e) {
    next(e);
  }
});
