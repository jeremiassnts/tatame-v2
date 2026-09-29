import { z } from "zod";

export const roleEnumSchema = z.enum(["manager", "instructor", "student", "guardian"]);

export const syncUserBodySchema = z.object({
  role: roleEnumSchema.optional(),
});

export type SyncUserBody = z.infer<typeof syncUserBodySchema>;

export const updateProfileBodySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).nullable().optional(),
  instagram: z
    .string()
    .max(30)
    .transform((v) => v.replace(/^@/, ""))
    .nullable()
    .optional(),
  birthDate: z.string().date().nullable().optional(),
});

export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;

export const activeAcademySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  logoUrl: z.string().nullable(),
});

export type ActiveAcademy = z.infer<typeof activeAcademySchema>;

export const activeMembershipSchema = z.object({
  id: z.string().uuid(),
  academyId: z.string().uuid(),
  academyName: z.string(),
  academyLogoUrl: z.string().nullable(),
  role: roleEnumSchema,
  status: z.enum(["pending", "active", "blocked"]),
  joinedAt: z.coerce.date().nullable(),
});

export type ActiveMembership = z.infer<typeof activeMembershipSchema>;

export const userMeResponseSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string(),
  email: z.string().email(),
  name: z.string(),
  profileImageUrl: z.string().nullable(),
  phone: z.string().nullable(),
  instagram: z.string().nullable(),
  birthDate: z.string().nullable(),
  /** Null until a role is assigned via POST /users/me/sync. */
  activeRole: roleEnumSchema.nullable(),
  /** Non-null for managers who own an academy. */
  activeAcademy: activeAcademySchema.nullable(),
  /** Non-null for instructors/students with a pending or active membership. */
  activeMembership: activeMembershipSchema.nullable(),
  /** True when user has paid via Stripe but hasn't created an academy yet. */
  hasPendingSubscription: z.boolean().optional(),
  /**
   * Whether a Pix charge for this user would have to ask for a CPF/CNPJ.
   *
   * Asaas refuses to charge a customer with no document and the platform stores
   * none (D7), so the student types it — but only ever on the first charge:
   * `ensureCustomer` returns early once `asaas_customer_id` is set and ignores
   * whatever was sent. The screen reads this to render the field up front
   * instead of asking every month for a value that is discarded, or asking only
   * after a `CPF_REQUIRED` 400, which puts an error on the normal path.
   *
   * A boolean and nothing more. The document itself is never stored and never
   * served.
   */
  documentRequired: z.boolean().optional(),
});

export type UserMeResponse = z.infer<typeof userMeResponseSchema>;
