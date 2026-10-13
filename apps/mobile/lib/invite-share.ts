import { ROLE_TO_PAPEL, type InviteRole } from "@tatame/types";
import { APP_HOST } from "@/lib/invite-link";
import { ROLE_LABELS } from "@/lib/invite-copy";

/**
 * Everything the manager's two share actions decide, in one module that imports
 * nothing from the native runtime — not `Share`, not `Alert`, nothing.
 *
 * That rule is the whole reason this file exists separately from the hook that
 * uses it. `vitest.config.ts` runs `environment: "node"`, so a module reaching
 * for either of those cannot be loaded by a test at all — and the parts worth
 * proving here are the `papel` token, the member threshold, the empty-academy
 * branch and dismiss-vs-reject, none of which need a renderer.
 * `lib/hooks/use-invite-share.ts` is the single place both get wired in, and
 * `lib/invite-share.test.ts` asserts this file never names the runtime at all.
 */

/** Where "share the app" lands. Never the apex, which sells subscriptions. */
export const APP_DOWNLOAD_URL = `https://${APP_HOST}/baixar`;

const INVITE_URL_BASE = `https://${APP_HOST}/convite`;

/**
 * The link a manager shares, which is the same link for everybody.
 *
 * `encodeURIComponent` mirrors the `decodeURIComponent` in
 * `parseInviteLink`, so a round trip through both is the identity — that
 * symmetry is asserted rather than assumed, because this is the producer and
 * that is the consumer and nothing else connects them.
 */
export function buildInviteUrl(
  academyId: string,
  role: InviteRole | null,
): string {
  const path = `${INVITE_URL_BASE}/${encodeURIComponent(academyId)}`;

  // `null` is the general invite, and it omits the token rather than inventing
  // one: `papel`'s vocabulary is closed in `@tatame/types`, and an absent token
  // is the shape both readers already handle — `apps/web` renders the generic
  // invite and `(onboarding)/user-type` opens with nothing preselected.
  return role ? `${path}?papel=${ROLE_TO_PAPEL[role]}` : path;
}

export type InviteRoleOption = {
  /** `null` is the general invite: one link, and the person picks their role. */
  role: InviteRole | null;
  label: string;
  description: string;
};

/**
 * The three rows of the picker, in the order a manager needs them: students are
 * the bulk of any academy, instructors are a handful, and a responsible adult
 * is the exception that has to explain itself.
 *
 * Labels come from `ROLE_LABELS`, never from a second copy — the invited person
 * reads the same three words on `(onboarding)/user-type` after following the
 * link, and the two disagreeing is exactly what nobody notices.
 */
export const INVITE_ROLE_OPTIONS: readonly InviteRoleOption[] = [
  {
    // First, because it is the row that corrects what the other three imply.
    // A picker offering role rows only reads as "invite one person at a time,
    // by role", and the link is neither per-person nor per-role — the same URL
    // serves a whole group. (The three labels are not spelt out here, in this
    // comment or anywhere else in this module: `ROLE_LABELS` is their one
    // source, and C1 asserts the absence.)
    role: null,
    label: "Geral",
    description:
      "Um link para a turma toda — cada pessoa escolhe o próprio perfil ao entrar",
  },
  {
    role: "student",
    label: ROLE_LABELS.student,
    description: "Treina na academia, confirma presença e acompanha a graduação",
  },
  {
    role: "instructor",
    label: ROLE_LABELS.instructor,
    description: "Dá aulas e acompanha o progresso dos alunos",
  },
  {
    role: "guardian",
    label: ROLE_LABELS.guardian,
    // The one row that invites somebody other than the person being enrolled: a
    // manager who wants to add a child invites the adult, who then cadastra the
    // child as a dependent. Without this sentence the obvious reading is that
    // the link goes to the kid.
    description:
      "Convide o adulto responsável — é ele que depois cadastra a criança como dependente",
  },
];

/**
 * Both share messages, in one place so an edit reaches every entry point.
 *
 * Written for a WhatsApp group rather than for one person, because the link is
 * neither per-person nor single-use: a manager who reads "convide um aluno"
 * repeats the flow thirty times for no reason. The group clause is the part
 * that must survive a copy edit.
 */
export const APP_SHARE_MESSAGE = [
  "Baixe o Tatame e acompanhe suas aulas, presenças, graduações e pagamentos pelo celular:",
  APP_DOWNLOAD_URL,
].join("\n\n");

/**
 * `null`, `undefined` and `""` are all the same case and all reachable:
 * `useAcademyContext` initialises `academyName` to `""`, so a share fired
 * before the context has filled would otherwise read "organizar a .".
 */
export function inviteShareMessage(
  academyName: string | null | undefined,
  url: string,
): string {
  const trimmed = academyName?.trim();
  const where = trimmed ? `a ${trimmed}` : "a nossa academia";

  return [
    `Oi! Estou usando o Tatame para organizar ${where}.`,
    "Entrem pelo link abaixo para acompanhar aulas, presenças e graduações. É o mesmo link para todos, podem compartilhar com a turma:",
    url,
  ].join("\n\n");
}

/** Short enough for a mobile button; the surrounding copy carries the rest. */
export const INVITE_LABEL = "Convidar";
export const SHARE_APP_LABEL = "Compartilhar app";
/** Two lines, matching the other cards in `Ações rápidas`. */
export const INVITE_QUICK_ACTION_LABEL = "Convidar\nmembro";

export const SHARE_ERROR_TITLE = "Erro";
export const SHARE_ERROR_BODY =
  "Não foi possível abrir o compartilhamento. Tente novamente.";

export type ShareOutcome = { action: string };
export type ShareFn = (content: { message: string }) => Promise<ShareOutcome>;
export type ReportError = (title: string, body: string) => void;

/**
 * Open the share sheet, and treat a dismissal as success.
 *
 * The three outcomes are not two: the sheet resolves `sharedAction` when a
 * target took the message, resolves `dismissedAction` when the manager backed
 * out, and rejects only when the OS could not present it at all. Dismissing is
 * the ordinary case and must leave nothing behind — an alert there would fire
 * every time somebody changed their mind.
 */
export async function shareMessage(
  message: string,
  share: ShareFn,
  reportError: ReportError,
): Promise<void> {
  try {
    await share({ message });
  } catch {
    reportError(SHARE_ERROR_TITLE, SHARE_ERROR_BODY);
  }
}

/**
 * Above this many active members the welcome card has done its job and leaves.
 *
 * Counted the way the API counts it: `activeMembers` is every `active` row in
 * `academy_memberships`, **including the manager's own**
 * (`academy.repository.postgres.ts`), so a brand-new academy reads `1`, not
 * `0`. Five therefore means the manager plus up to four other people — enough
 * to show they have found a way to bring members in, and few enough that the
 * card is still gone before the home screen gets busy.
 */
export const INVITE_WELCOME_MEMBER_THRESHOLD = 5;

/**
 * `undefined` is "the count has not arrived", which is both the pending and the
 * failed query, and in neither case should the card flash in and out.
 */
export function shouldShowInviteWelcome(
  activeMembers: number | undefined,
): boolean {
  if (typeof activeMembers !== "number") return false;
  return activeMembers < INVITE_WELCOME_MEMBER_THRESHOLD;
}
