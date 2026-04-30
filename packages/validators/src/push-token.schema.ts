import { z } from "zod";

export const registerPushTokenBodySchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android"]),
  deviceId: z.string().min(1),
});

export type RegisterPushTokenBody = z.infer<typeof registerPushTokenBodySchema>;
