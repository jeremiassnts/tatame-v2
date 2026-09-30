import { ApiError } from "@/lib/api";

/**
 * Guard messages the API answers in English. They are written for a log, not
 * for a person, and they are the ones a user is most likely to hit — so they
 * are translated here rather than shown raw. Anything not listed is either
 * prose the API already wrote in Portuguese or a code, both handled below.
 */
const TRANSLATED: Record<string, string> = {
  "No active academy membership":
    "Você precisa fazer parte de uma academia para continuar.",
  "Subscription plan not found": "Plano não encontrado.",
  "No active subscription found": "Nenhuma assinatura ativa encontrada.",
  "Payment already exists for this period":
    "O pagamento deste mês já foi registrado.",
  "Only students or guardians can select a plan":
    "Apenas alunos e responsáveis podem escolher um plano.",
  "dependentId is required for guardians":
    "Selecione o dependente antes de escolher o plano.",
};

/** `PLAN_LIMIT_PLANS`, `PAYOUT_ACCOUNT_REQUIRED` — identifiers, never prose. */
function isCode(value: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(value);
}

const BY_STATUS: Record<number, string> = {
  400: "Os dados enviados são inválidos. Revise o formulário e tente de novo.",
  401: "Sua sessão expirou. Entre novamente.",
  403: "Você não tem permissão para fazer isso.",
  404: "Não encontramos o que você procura.",
  409: "Esta ação já foi registrada.",
};

/**
 * The sentence to show the user for a failed request.
 *
 * The blanket "Tente novamente" the dependent screens used to show made a 403
 * from the academy guard, a 400 from schema validation and a 500 look
 * identical, which is why the original failure in TAT-186 was never diagnosed.
 * This keeps whatever the API actually said and falls back by status, so the
 * three are told apart on screen.
 */
export function describeApiError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  // The API's human sentence, when it sent one — for Asaas this is the whole
  // value, since it names the field the Receita refused.
  if (error.detail) return error.detail;

  const translated = TRANSLATED[error.message];
  if (translated) return translated;

  if (error.message && !isCode(error.message)) return error.message;

  if (error.status >= 500) {
    return "O servidor não respondeu. Tente novamente em instantes.";
  }

  return BY_STATUS[error.status] ?? fallback;
}
