import { z } from "zod";

/**
 * The academy's Asaas receiving account.
 *
 * Every field Asaas requires is required here even when the column it was
 * prefilled from is nullable — the form is the source of truth for the Asaas
 * registration, not the academy record, and Asaas rejects a partial one.
 */

/** Digits only. Asaas validates the document itself, at the Receita. */
const cpfCnpjSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(
    z
      .string()
      .refine((v) => v.length === 11 || v.length === 14, {
        message: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)",
      }),
  );

const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(
    z
      .string()
      .min(10, "Informe o celular com DDD")
      .max(11, "Informe o celular com DDD"),
  );

const postalCodeSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(z.string().length(8, "CEP deve ter 8 dígitos"));

export const asaasCompanyTypeSchema = z.enum([
  "MEI",
  "LIMITED",
  "INDIVIDUAL",
  "ASSOCIATION",
]);

export const createPayoutAccountBodySchema = z
  .object({
    /** Asaas checks this against the CPF/CNPJ, so it must be the registered name. */
    name: z.string().trim().min(1, "Informe o nome").max(255),
    email: z.string().trim().email("E-mail inválido"),
    cpfCnpj: cpfCnpjSchema,
    mobilePhone: phoneSchema,
    /** Monthly revenue, in reais. */
    incomeValue: z.number().positive("Informe o faturamento mensal"),
    address: z.string().trim().min(1, "Informe o endereço").max(255),
    addressNumber: z.string().trim().min(1, "Informe o número").max(20),
    complement: z.string().trim().max(255).optional(),
    province: z.string().trim().min(1, "Informe o bairro").max(255),
    postalCode: postalCodeSchema,
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida")
      .optional(),
    companyType: asaasCompanyTypeSchema.optional(),
  })
  .superRefine((value, ctx) => {
    // Asaas splits the registration by person type: a CPF account needs a
    // birth date and refuses a companyType, a CNPJ account is the reverse.
    const isCompany = value.cpfCnpj.length === 14;
    if (isCompany && !value.companyType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["companyType"],
        message: "Informe o tipo de empresa",
      });
    }
    if (!isCompany && !value.birthDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["birthDate"],
        message: "Informe a data de nascimento",
      });
    }
  });

export type CreatePayoutAccountBody = z.infer<
  typeof createPayoutAccountBodySchema
>;

export const asaasDocumentTypeSchema = z.enum([
  "ALLOW_BANK_ACCOUNT_DEPOSIT_STATEMENT",
  "CUSTOM",
  "EMANCIPATION_OF_MINORS",
  "ENTREPRENEUR_REQUIREMENT",
  "IDENTIFICATION_SELFIE",
  "IDENTIFICATION",
  "INVOICE",
  "MEI_CERTIFICATE",
  "MINUTES_OF_CONSTITUTION",
  "MINUTES_OF_ELECTION",
  "POWER_OF_ATTORNEY",
  "SOCIAL_CONTRACT",
]);

export const uploadPayoutDocumentBodySchema = z.object({
  type: asaasDocumentTypeSchema,
});

export type UploadPayoutDocumentBody = z.infer<
  typeof uploadPayoutDocumentBodySchema
>;

export const payoutAccountGroupIdParamSchema = z.object({
  groupId: z.string().min(1),
});
