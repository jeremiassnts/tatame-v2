import { loadEnv } from "@tatame/config";
import { HttpError } from "./http-error.js";

/**
 * Typed client for the Asaas REST API.
 *
 * Two identities share one client because Asaas splits the surface between
 * them: the platform's root key creates subaccounts, reads the rates every
 * charge is priced with, and owns the charges themselves; each academy's own
 * subaccount key is the only thing that can read or complete that academy's
 * onboarding (`/myAccount/*`). `root()` and `forSubaccount()` differ in exactly
 * one header.
 *
 * Every failure leaves here as an `HttpError`, so a route never has to know
 * that an upstream existed. The one case that is deliberately transparent is a
 * 400: Asaas writes its validation messages in Portuguese and they are more
 * useful to the manager than anything this layer could invent — an invalid CEP
 * or a CPF already tied to another account has to reach the form intact.
 */

const API_PREFIX = "/v3";

export type AsaasPersonType = "FISICA" | "JURIDICA";
export type AsaasCompanyType = "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";

/** The four registration areas Asaas reviews, and the states each can be in. */
export type AsaasRegistrationStatus =
  | "PENDING"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED";

export type AsaasDocumentStatus =
  | "NOT_SENT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "IGNORED";

export type AsaasDocumentType =
  | "ALLOW_BANK_ACCOUNT_DEPOSIT_STATEMENT"
  | "CUSTOM"
  | "EMANCIPATION_OF_MINORS"
  | "ENTREPRENEUR_REQUIREMENT"
  | "IDENTIFICATION_SELFIE"
  | "IDENTIFICATION"
  | "INVOICE"
  | "MEI_CERTIFICATE"
  | "MINUTES_OF_CONSTITUTION"
  | "MINUTES_OF_ELECTION"
  | "POWER_OF_ATTORNEY"
  | "SOCIAL_CONTRACT";

export interface AsaasWebhookInput {
  name: string;
  url: string;
  email: string;
  enabled: boolean;
  interrupted: boolean;
  /** Always 3 — the only version this client speaks. */
  apiVersion: number;
  /** Asaas requires between 32 and 255 characters. */
  authToken: string;
  sendType: "SEQUENTIALLY" | "NON_SEQUENTIALLY";
  events: string[];
}

export interface CreateAsaasAccountInput {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
  /** Defaults to `email` on the Asaas side; it becomes the subaccount login. */
  loginEmail?: string;
  /** CPF accounts only. */
  birthDate?: string;
  /** CNPJ accounts only. */
  companyType?: AsaasCompanyType;
  phone?: string;
  site?: string;
  complement?: string;
  webhooks?: AsaasWebhookInput[];
}

export interface AsaasAccount {
  id: string;
  walletId: string;
  /**
   * Returned exactly once, here. There is no endpoint that reads it back, so a
   * caller that drops this value has locked the academy out of its own
   * onboarding permanently.
   */
  apiKey: string;
  name?: string;
  email?: string;
  loginEmail?: string;
  cpfCnpj?: string;
  personType?: AsaasPersonType;
  companyType?: AsaasCompanyType | null;
}

export interface AsaasAccountStatus {
  id: string;
  commercialInfo: AsaasRegistrationStatus;
  bankAccountInfo: AsaasRegistrationStatus;
  documentation: AsaasRegistrationStatus;
  general: AsaasRegistrationStatus;
}

export interface AsaasDocumentGroup {
  id: string;
  status: AsaasDocumentStatus;
  /** An `AsaasDocumentType` in practice, but left open: this is a display
   *  field, and a new Asaas type must not break parsing. */
  type: string;
  title: string;
  description: string;
  /**
   * When present, Asaas refuses an API upload for this group and the holder
   * has to finish through the link. The whole document flow branches on it.
   */
  onboardingUrl: string | null;
  onboardingUrlExpirationDate?: string | null;
  /**
   * Absent — not empty — for a group nothing has been uploaded to yet, which is
   * the state every freshly created subaccount is in. Optional here so the
   * normalisation below is the only place that has to know.
   */
  documents?: { id: string; status: AsaasDocumentStatus }[];
}

export interface AsaasDocumentsResponse {
  rejectReasons: string | null;
  data: AsaasDocumentGroup[];
}

export interface AsaasUploadedDocument {
  id: string;
  status: AsaasDocumentStatus;
}

export interface AsaasFees {
  payment: {
    pix: {
      fixedFeeValue: number;
      /**
       * The promotional rate Asaas actually charges until `discountExpiration`.
       * It is reported next to the standard rate, not instead of it.
       */
      fixedFeeValueWithDiscount?: number | null;
      discountExpiration?: string | null;
      percentageFee: number;
      minimumFeeValue: number;
      maximumFeeValue: number;
      monthlyCreditsWithoutFee: number;
      creditsReceivedOfCurrentMonth: number;
    };
    creditCard: {
      operationValue: number;
      oneInstallmentPercentage: number;
      discountOneInstallmentPercentage?: number | null;
      /** Asaas's own verdict on whether the promotional rate is in force. */
      hasValidDiscount?: boolean;
      discountExpiration?: string | null;
      daysToReceive: number;
    };
  };
}

/** An upstream that answers HTML on a gateway timeout must not throw here. */
function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

interface AsaasErrorBody {
  errors?: { code?: string; description?: string }[];
}

export class AsaasClient {
  private constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string,
  ) {}

  /** The platform account: creates subaccounts, owns charges, sets the rates. */
  static root(): AsaasClient {
    const env = loadEnv();
    if (!env.ASAAS_API_KEY) {
      throw new Error("ASAAS_API_KEY is not configured");
    }
    if (!env.ASAAS_BASE_URL) {
      throw new Error("ASAAS_BASE_URL is not configured");
    }
    return new AsaasClient(env.ASAAS_BASE_URL, env.ASAAS_API_KEY);
  }

  /** One academy, acting on its own `/myAccount/*` resources. */
  static forSubaccount(accessToken: string): AsaasClient {
    const env = loadEnv();
    if (!env.ASAAS_BASE_URL) {
      throw new Error("ASAAS_BASE_URL is not configured");
    }
    return new AsaasClient(env.ASAAS_BASE_URL, accessToken);
  }

  async createAccount(input: CreateAsaasAccountInput): Promise<AsaasAccount> {
    const body = await this.request<
      Partial<AsaasAccount> & { accessToken?: { apiKey?: string } }
    >("POST", "/accounts", { json: input });

    // The OpenAPI schema nests the key under `accessToken.apiKey`; some
    // responses carry it at the top level. Read both, because the cost of
    // missing it is an academy that can never finish onboarding.
    const apiKey = body.accessToken?.apiKey ?? body.apiKey;
    if (!apiKey) {
      throw new HttpError(
        502,
        "Asaas criou a conta mas não retornou a chave de API",
      );
    }
    if (!body.id || !body.walletId) {
      throw new HttpError(
        502,
        "Asaas criou a conta mas não retornou id ou walletId",
      );
    }

    return { ...body, id: body.id, walletId: body.walletId, apiKey };
  }

  getAccountStatus(): Promise<AsaasAccountStatus> {
    return this.request<AsaasAccountStatus>("GET", "/myAccount/status");
  }

  async listDocuments(): Promise<AsaasDocumentsResponse> {
    const body = await this.request<Partial<AsaasDocumentsResponse>>(
      "GET",
      "/myAccount/documents",
    );
    return { rejectReasons: body.rejectReasons ?? null, data: body.data ?? [] };
  }

  uploadDocument(
    groupId: string,
    input: {
      type: AsaasDocumentType;
      file: { buffer: Buffer; filename: string; contentType: string };
    },
  ): Promise<AsaasUploadedDocument> {
    const form = new FormData();
    form.append("type", input.type);
    form.append(
      "documentFile",
      new File([new Uint8Array(input.file.buffer)], input.file.filename, {
        type: input.file.contentType,
      }),
    );
    // No Content-Type header: fetch has to set it so the multipart boundary matches.
    return this.request<AsaasUploadedDocument>(
      "POST",
      `/myAccount/documents/${encodeURIComponent(groupId)}`,
      { form },
    );
  }

  getFees(): Promise<AsaasFees> {
    return this.request<AsaasFees>("GET", "/myAccount/fees");
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    opts: { json?: unknown; form?: FormData } = {},
  ): Promise<T> {
    const url = `${this.baseUrl.replace(/\/+$/, "")}${API_PREFIX}${path}`;
    const headers: Record<string, string> = {
      access_token: this.accessToken,
      accept: "application/json",
    };
    if (opts.json !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: opts.form ?? (opts.json !== undefined ? JSON.stringify(opts.json) : undefined),
      });
    } catch {
      // The cause is a socket-level message with the upstream host in it —
      // useful in a log, never in a response body.
      throw new HttpError(502, "Não foi possível falar com o Asaas agora");
    }

    const text = await response.text();
    const parsed = parseJson(text);

    if (!response.ok) throw this.toHttpError(response.status, parsed);
    return parsed as T;
  }

  private toHttpError(status: number, body: unknown): HttpError {
    const errors = (body as AsaasErrorBody | undefined)?.errors ?? [];
    const description = errors
      .map((e) => e.description)
      .filter((d): d is string => Boolean(d))
      .join(" ");
    const code = errors[0]?.code;

    // A 400 is the manager's data — the CEP, the CPF/CNPJ, the e-mail already
    // in use. Asaas already says why, in Portuguese, and that sentence is what
    // has to reach the form. This is also the path the 60-day evaluation caps
    // arrive on, which the spec requires be surfaced verbatim.
    if (status === 400 || status === 422) {
      return new HttpError(
        400,
        description || "O Asaas recusou os dados enviados",
        code ? { code } : undefined,
      );
    }
    // Our credentials, not the caller's request.
    if (status === 401 || status === 403) {
      return new HttpError(502, "Credencial do Asaas inválida ou sem permissão");
    }
    if (status === 404) {
      return new HttpError(404, description || "Recurso não encontrado no Asaas");
    }
    if (status === 429) {
      return new HttpError(503, "Asaas está limitando as requisições, tente novamente em instantes");
    }
    return new HttpError(502, "Asaas está indisponível no momento");
  }
}
