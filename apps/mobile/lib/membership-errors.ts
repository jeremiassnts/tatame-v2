import { ApiError } from "@/lib/api-error";

/**
 * What an invited person is told when the join does not work.
 *
 * Every sentence here is in Brazilian Portuguese because the API's are not:
 * `HttpError(409, "You already have an active academy membership; leave before
 * joining another")` reaches the app as `ApiError.message`, and showing it is
 * what `academy/[academyId].tsx` did before TAT-191.
 *
 * The dispatch is on the status and never on the message text. The two 409s -
 * a membership somewhere else, and a request already in for this academy - are
 * told apart by what the app already knows from `/users/me`, because matching
 * on an English sentence makes the copy break the next time someone rewords it
 * on the server.
 */

const REQUEST_FALLBACK =
  "Não foi possível enviar sua solicitação. Tente novamente.";

const ACADEMY_LOAD_FALLBACK =
  "Não foi possível carregar a academia. Verifique sua conexão e tente novamente.";

export function describeMembershipRequestError(
  error: unknown,
  /** From `/users/me`, not from the error. This is what splits the two 409s. */
  hasMembership: boolean,
): string {
  if (!(error instanceof ApiError)) return REQUEST_FALLBACK;

  switch (error.status) {
    // `existsBlockedOrRejected`. Not a dead end and not a retry - a manager has
    // to act, so the sentence says that rather than offering "tente novamente".
    case 403:
      return "Você não pode solicitar entrada nesta academia novamente até que um gestor libere seu acesso.";

    case 409:
      return hasMembership
        ? "Você já faz parte de uma academia. Saia da atual antes de entrar em outra."
        : "Você já tem uma solicitação pendente nesta academia.";

    // 400 is a malformed academy id and 404 is one nobody has: from where the
    // person is standing both mean the link they were sent points nowhere.
    case 400:
    case 404:
      return "Academia não encontrada. Peça um link de convite novo ao gestor.";

    default:
      return REQUEST_FALLBACK;
  }
}

export function describeAcademyLoadError(error: unknown): string {
  if (
    error instanceof ApiError &&
    (error.status === 400 || error.status === 404)
  ) {
    return "Academia não encontrada. O link de convite pode estar inválido.";
  }

  // Anything else - a 500, the API down, DNS - is us not knowing. Telling
  // someone their academy is gone during an outage is worse than blaming the
  // connection, which is the same split `apps/web/lib/invite.ts` makes.
  return ACADEMY_LOAD_FALLBACK;
}
