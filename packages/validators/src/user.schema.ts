import { z } from "zod";

export const userMeResponseSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string(),
  email: z.string().email(),
  name: z.string(),
  profileImageUrl: z.string().nullable(),
});

export type UserMeResponse = z.infer<typeof userMeResponseSchema>;
