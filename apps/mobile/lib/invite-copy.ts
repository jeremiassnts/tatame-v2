import type { InviteRole } from "@tatame/types";

/**
 * The three roles, named the way the invited person reads them.
 *
 * One table in `apps/mobile`, read by both the invite headline and the role
 * cards on `(onboarding)/user-type`. Two copies would be two places to decide
 * whether a `guardian` is a "Responsável" or a "Pai/Mãe", and the headline
 * disagreeing with the card it points at is exactly the kind of thing nobody
 * notices until an invited person does.
 *
 * `apps/web/lib/invite.ts` keeps its own copy on purpose: a different app, a
 * different bundle, already shipped, and the vocabulary that must not drift
 * between them is `papel` - which does live in one place, `@tatame/types`.
 */
export const ROLE_LABELS: Record<InviteRole, string> = {
  student: "Aluno",
  instructor: "Instrutor",
  guardian: "Responsável",
};

/**
 * What the invite says, in one sentence, with both halves optional.
 *
 * The role is absent whenever the link carried no `papel` or one nobody can be
 * invited as; the academy name is absent while the public lookup is in flight
 * and stays absent if it fails. Neither is an error and neither blocks the role
 * step - the fallback phrasing just stops naming what it does not know, rather
 * than rendering "undefined" at someone.
 */
export function inviteHeadline(
  role: InviteRole | null,
  academyName: string | null,
): string {
  const what = role ? `ser ${ROLE_LABELS[role]}` : "entrar";
  const where = academyName ? `na ${academyName}` : "nesta academia";
  return `Você foi convidado para ${what} ${where}`;
}

/** The invited role is a suggestion, and the screen has to say so out loud. */
export const INVITE_ROLE_HINT = "Você pode escolher outro perfil se preferir.";

/** Nothing was suggested, so there is nothing to offer changing. */
export const INVITE_ROLE_PROMPT = "Selecione o seu perfil para continuar.";

export function inviteRoleHint(role: InviteRole | null): string {
  return role ? INVITE_ROLE_HINT : INVITE_ROLE_PROMPT;
}
