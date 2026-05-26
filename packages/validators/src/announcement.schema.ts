import { z } from "zod";

export const createAnnouncementBodySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  imageUrl: z.string().url().optional(),
});

export const updateAnnouncementBodySchema = createAnnouncementBodySchema.partial();

export type CreateAnnouncementBody = z.infer<typeof createAnnouncementBodySchema>;
export type UpdateAnnouncementBody = z.infer<typeof updateAnnouncementBodySchema>;
