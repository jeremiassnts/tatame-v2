import { Router } from "express";
import multer from "multer";
import { HttpError } from "../../lib/http-error.js";
import { requireSession } from "../../middleware/require-session.js";
import { UploadService } from "./upload.service.js";

export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadService = new UploadService();

uploadRouter.post(
  "/image",
  requireSession,
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new HttpError(400, "No image file provided");
      }

      const url = await uploadService.uploadImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });

      res.status(201).json({ url });
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Invalid file type")) {
        next(new HttpError(400, e.message));
        return;
      }
      if (e instanceof Error && e.message.startsWith("File too large")) {
        next(new HttpError(400, e.message));
        return;
      }
      next(e);
    }
  },
);
