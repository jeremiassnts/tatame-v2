import { Router } from "express";
import { Role } from "@tatame/types";
import {
  createAnnouncementBodySchema,
  updateAnnouncementBodySchema,
} from "@tatame/validators";
import type {
  CreateAnnouncementBody,
  UpdateAnnouncementBody,
} from "@tatame/validators";
import { getDb } from "../../lib/db.js";
import { authorize } from "../../middleware/authorize.js";
import {
  attachActiveAcademyContext,
  requireActiveAcademy,
} from "../../middleware/academy-context.js";
import { validateBody } from "../../middleware/validate.js";
import { PostgresAnnouncementRepository } from "./announcement.repository.postgres.js";
import { AnnouncementService } from "./announcement.service.js";

export const announcementRouter = Router();

function buildService() {
  return new AnnouncementService(
    new PostgresAnnouncementRepository(getDb()),
  );
}

// POST / — create (manager only)
announcementRouter.post(
  "/",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(createAnnouncementBodySchema),
  async (req, res, next) => {
    try {
      const body = req.validatedBody as CreateAnnouncementBody;
      const academyId = req.appAuth!.activeAcademyId!;
      const authorId = req.appAuth!.userId;
      const service = buildService();
      const announcement = await service.create({
        academyId,
        authorId,
        title: body.title,
        body: body.body,
        imageUrl: body.imageUrl ?? null,
      });
      res.status(201).json(announcement);
    } catch (e) {
      next(e);
    }
  },
);

// GET / — list by academy
announcementRouter.get(
  "/",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const academyId = req.appAuth!.activeAcademyId!;
      const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      const rawLimit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
      const limit = Math.min(Math.max(rawLimit, 1), 50);
      const service = buildService();
      const [listResult, total] = await Promise.all([
        service.listByAcademy(academyId, cursor, limit),
        service.countByAcademy(academyId),
      ]);
      res.json({ ...listResult, total });
    } catch (e) {
      next(e);
    }
  },
);

// GET /:id — detail
announcementRouter.get(
  "/:id",
  authorize(Role.Manager, Role.Instructor, Role.Student),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }
      const academyId = req.appAuth!.activeAcademyId!;
      const service = buildService();
      const announcement = await service.getById(id, academyId);
      res.json(announcement);
    } catch (e) {
      next(e);
    }
  },
);

// PUT /:id — update (manager only)
announcementRouter.put(
  "/:id",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  validateBody(updateAnnouncementBodySchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }
      const body = req.validatedBody as UpdateAnnouncementBody;
      const academyId = req.appAuth!.activeAcademyId!;
      const service = buildService();
      const updated = await service.update(id, academyId, body);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);

// DELETE /:id — delete (manager only)
announcementRouter.delete(
  "/:id",
  authorize(Role.Manager),
  attachActiveAcademyContext,
  requireActiveAcademy,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "id is required" });
        return;
      }
      const academyId = req.appAuth!.activeAcademyId!;
      const service = buildService();
      await service.delete(id, academyId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  },
);
