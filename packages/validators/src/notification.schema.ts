import { z } from "zod";

const notificationCategoryValues = [
  "class_change",
  "payment",
  "belt_promotion",
  "announcement",
  "marketplace",
  "tournament",
  "new_member",
  "subscription_alert",
  "checkin_anomaly",
  "streak",
  "inactivity",
  "milestone",
  "weekly_summary",
  "wrapped",
] as const;

export const sendNotificationBodySchema = z.object({
  recipientIds: z.array(z.string().min(1)).min(1),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  category: z.enum(notificationCategoryValues),
  data: z.record(z.unknown()).optional(),
  academyId: z.string().uuid().optional(),
});

export type SendNotificationBody = z.infer<typeof sendNotificationBodySchema>;

export const listNotificationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
