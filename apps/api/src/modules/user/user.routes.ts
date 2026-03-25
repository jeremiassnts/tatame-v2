import { getAuth } from "@clerk/express";
import type { SyncUserBody } from "@tatame/validators";
import {
  syncUserBodySchema,
  userMeResponseSchema,
} from "@tatame/validators";
import { Router } from "express";
import { getClerkClient } from "../../lib/clerk.js";
import { getDb } from "../../lib/db.js";
import { requireSession } from "../../middleware/require-session.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresUserRepository } from "./user.repository.postgres.js";
import { UserService } from "./user.service.js";

export const userRouter = Router();

const db = getDb();
const userService = new UserService(new PostgresUserRepository(db));

function buildMeResponse(
  row: NonNullable<Awaited<ReturnType<typeof userService.getByClerkId>>>,
  activeRole: string | null,
  activeAcademy: Awaited<
    ReturnType<typeof userService.getActiveAcademyForManager>
  >,
) {
  return userMeResponseSchema.parse({
    id: row.id,
    clerkUserId: row.clerkUserId,
    email: row.email,
    name: row.name,
    profileImageUrl: row.profileImageUrl,
    activeRole,
    activeAcademy,
  });
}

userRouter.get("/me", requireSession, async (req, res, next) => {
  try {
    const { userId: clerkUserId } = getAuth(req);
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const row = await userService.getByClerkId(clerkUserId);

    if (!row) {
      res.status(404).json({
        error: "Usuário não encontrado; faça login novamente",
      });
      return;
    }

    const activeRole = await userService.getActiveRole(row.id);

    let activeAcademy = null;
    if (activeRole === "manager") {
      activeAcademy = await userService.getActiveAcademyForManager(row.id);
    }

    res.json(buildMeResponse(row, activeRole, activeAcademy));
  } catch (e) {
    next(e);
  }
});

userRouter.post(
  "/me/sync",
  requireSession,
  validateBody(syncUserBodySchema),
  async (req, res, next) => {
    try {
      const { userId: clerkUserId } = getAuth(req);
      if (!clerkUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const clerkClient = getClerkClient();
      const clerkUser = await clerkClient.users.getUser(clerkUserId);

      const email =
        clerkUser.emailAddresses.find(
          (e) => e.id === clerkUser.primaryEmailAddressId,
        )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

      if (!email) {
        res.status(400).json({ error: "Clerk user has no email address" });
        return;
      }

      const nameParts = [clerkUser.firstName, clerkUser.lastName].filter(
        (x): x is string => Boolean(x?.trim()),
      );
      const name = nameParts.length
        ? nameParts.join(" ")
        : (clerkUser.username ?? email);

      await userService.upsertFromClerk({
        clerkUserId,
        email,
        name,
        profileImageUrl: clerkUser.imageUrl ?? null,
      });

      const row = await userService.getByClerkId(clerkUserId);
      if (!row) {
        res.status(500).json({ error: "Failed to upsert user" });
        return;
      }

      const { role } = req.validatedBody as SyncUserBody;
      if (role) {
        try {
          await userService.assignInitialRole(row.id, role);
        } catch (err: unknown) {
          // Unique constraint violation (concurrent sync) — role already assigned, ignore
          const isConstraintViolation =
            err instanceof Error &&
            "code" in err &&
            (err as { code: string }).code === "23505";
          if (!isConstraintViolation) throw err;
        }
      }

      const activeRole = await userService.getActiveRole(row.id);

      let activeAcademy = null;
      if (activeRole === "manager") {
        activeAcademy = await userService.getActiveAcademyForManager(row.id);
      }

      res.json(buildMeResponse(row, activeRole, activeAcademy));
    } catch (e) {
      next(e);
    }
  },
);
