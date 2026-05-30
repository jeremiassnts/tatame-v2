import { Router } from "express";
import { Role } from "@tatame/types";
import { getDb } from "../../lib/db.js";
import { authorize } from "../../middleware/authorize.js";
import { PostgresTutorialRepository } from "./tutorial.repository.postgres.js";
import { TutorialService } from "./tutorial.service.js";

export const tutorialRouter = Router();

function buildService() {
  return new TutorialService(new PostgresTutorialRepository(getDb()));
}

// GET / — list all tutorials
tutorialRouter.get(
  "/",
  authorize(Role.Manager, Role.Instructor, Role.Student, Role.Guardian),
  async (_req, res, next) => {
    try {
      const service = buildService();
      const tutorials = await service.listAll();
      res.json(tutorials);
    } catch (e) {
      next(e);
    }
  },
);
