import { ArrowRight, Info, Landmark } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  FEES_UNAVAILABLE,
  isPayoutErrorCode,
  usePayoutAccount,
  usePayoutAccountFees,
  type PayoutAccountFees,
  type PayoutAccountStatus,
} from "@/lib/hooks/use-payout-account";
import {
  calculateCardFee,
  calculatePixFee,
  formatCents,
  formatPercentage,
  remainingFreePixCredits,
} from "@/lib/utils/payout-fees";

/**
 * What the plan screens say about money: the Asaas fee against the price being
 * typed, and the state of the academy's receiving account.
 *
 * Both plan screens show exactly the same thing, so it is built once here.
 * Copy and status vocabulary follow `PayoutAccountCard`, which is where the
 * manager meets the same account on the finances dashboard.
 */

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";
const ACCENT = "#A078E8";
const RED = "#FF453A";
const AMBER = "#FFD60A";

export const PAYOUT_ONBOARDING_ROUTE =
  "/(app)/(manager)/(finances)/payout-account/onboarding";
const PAYOUT_DOCUMENTS_ROUTE = "/(app)/(manager)/(finances)/payout-account/documents";

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="rounded-2xl border border-surface-border bg-surface"
      style={{ padding: 14, gap: 8 }}
    >
      {children}
    </View>
  );
}

function Body({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <Text
      className="font-poppins text-xs"
      style={{ color: color ?? TEXT_SECONDARY, lineHeight: 18 }}
    >
      {children}
    </Text>
  );
}

/** Describes the rate itself, e.g. `R$ 0,49 + 2,99%`. */
function describeRate(fixed: number, percentage: number): string {
  const parts: string[] = [];
  if (fixed > 0) parts.push(formatCents(Math.round(fixed * 100)));
  if (percentage > 0) parts.push(formatPercentage(percentage));
  return parts.length > 0 ? parts.join(" + ") : "sem taxa";
}

/** A zero bound means "no bound" in the payload, so there is nothing to show. */
function describePixBounds(pix: PayoutAccountFees["pix"]): string | null {
  const parts: string[] = [];
  if (pix.minFee > 0) parts.push(`mínimo de ${formatCents(Math.round(pix.minFee * 100))}`);
  if (pix.maxFee > 0) parts.push(`máximo de ${formatCents(Math.round(pix.maxFee * 100))}`);
  return parts.length > 0 ? `Taxa Pix com ${parts.join(" e ")} por cobrança.` : null;
}

function FeeLine({ label, value }: { label: string; value: string }) {
  return (
    <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY, lineHeight: 18 }}>
      <Text className="font-poppins-semibold text-xs text-primary">{label}: </Text>
      {value}
    </Text>
  );
}

/**
 * The fee and the net value for the price currently typed.
 *
 * `priceCents` is the plan price in cents, exactly as the form holds it.
 */
export function PlanFeeDisclosure({ priceCents }: { priceCents: number }) {
  const { data: fees, isPending, error } = usePayoutAccountFees();
  const hasPrice = Number.isFinite(priceCents) && priceCents > 0;

  return (
    <CardShell>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Info size={16} color={ACCENT} />
        <Text className="font-poppins-semibold text-sm text-primary">
          Taxas de pagamento
        </Text>
      </View>

      {isPending ? (
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <ActivityIndicator size="small" color={ACCENT} />
          <Body>Consultando as taxas...</Body>
        </View>
      ) : null}

      {/*
        Never a stale or invented number: when the rates do not arrive, the
        screen says so and stays usable. The two reasons read differently —
        FEES_UNAVAILABLE is Asaas not answering, while any other failure here
        is the payment integration being unavailable altogether.
      */}
      {!isPending && error ? (
        <Body color={AMBER}>
          {isPayoutErrorCode(error, FEES_UNAVAILABLE)
            ? "As taxas estão indisponíveis no momento. Você pode salvar o plano normalmente e conferir os valores depois."
            : "Não foi possível consultar as taxas agora: a integração de pagamentos está indisponível. Você pode salvar o plano normalmente."}
        </Body>
      ) : null}

      {fees ? <FeeContent fees={fees} priceCents={hasPrice ? priceCents : 0} /> : null}

      <Text className="font-poppins text-[11px]" style={{ color: TEXT_MUTED, lineHeight: 16 }}>
        Essas taxas são cobradas pelo processador de pagamento, não pelo Tatame — cobramos
        apenas a mensalidade da assinatura.
      </Text>
    </CardShell>
  );
}

function FeeContent({
  fees,
  priceCents,
}: {
  fees: PayoutAccountFees;
  priceCents: number;
}) {
  const pixBounds = describePixBounds(fees.pix);

  if (priceCents <= 0) {
    return (
      <>
        <FeeLine
          label="Pix"
          value={`taxa de ${describeRate(fees.pix.fixedFee, fees.pix.percentageFee)} por cobrança`}
        />
        <FeeLine
          label="Cartão"
          value={`taxa de ${describeRate(fees.creditCard.operationFee, fees.creditCard.percentage)} por cobrança`}
        />
        {pixBounds ? <Body>{pixBounds}</Body> : null}
        <CardDelay days={fees.creditCard.daysToReceive} />
        <FreePixCredits pix={fees.pix} />
        <Body>Digite o valor do plano para ver quanto a academia recebe.</Body>
      </>
    );
  }

  const pix = calculatePixFee(priceCents, fees.pix);
  const card = calculateCardFee(priceCents, fees.creditCard);
  const priceCoversFees = pix.netCents > 0 && card.netCents > 0;

  return (
    <>
      <FeeLine
        label="Pix"
        value={`taxa ${formatCents(pix.feeCents)} · você recebe ${formatCents(pix.netCents)}`}
      />
      <FeeLine
        label="Cartão"
        value={`taxa ${formatCents(card.feeCents)} · você recebe ${formatCents(card.netCents)}`}
      />
      {!priceCoversFees ? (
        <Body color={RED}>
          O valor do plano não cobre a taxa da cobrança. Aumente o valor para a academia
          receber algo.
        </Body>
      ) : null}
      <CardDelay days={fees.creditCard.daysToReceive} />
      <FreePixCredits pix={fees.pix} />
    </>
  );
}

/** Card money is not immediate, and the manager has to hear it in days. */
function CardDelay({ days }: { days: number }) {
  if (!days || days <= 0) return null;
  return (
    <Body>
      O dinheiro do cartão não cai na hora: leva {days} {days === 1 ? "dia" : "dias"} para
      chegar na conta da academia. O Pix cai na hora.
    </Body>
  );
}

function FreePixCredits({ pix }: { pix: PayoutAccountFees["pix"] }) {
  if (pix.monthlyFreeCredits <= 0) return null;
  const available = remainingFreePixCredits(pix);
  return (
    <Body>
      As primeiras {pix.monthlyFreeCredits} cobranças Pix do mês são gratuitas
      {available > 0
        ? ` — ainda restam ${available} neste mês.`
        : " — as gratuitas deste mês já foram usadas."}
    </Body>
  );
}

/** Same vocabulary the finances dashboard uses for the very same account. */
const STATUS_LABELS: Record<PayoutAccountStatus, string> = {
  pending: "Em criação",
  awaiting_documents: "Documentos pendentes",
  under_review: "Em análise",
  approved: "Ativa",
  rejected: "Recusada",
  suspended: "Suspensa",
};

const STATUS_MESSAGES: Record<PayoutAccountStatus, string> = {
  pending:
    "Sua conta de recebimento foi criada e está aguardando o envio dos documentos para ser liberada.",
  awaiting_documents:
    "Faltam documentos para o Asaas liberar os recebimentos da sua academia.",
  under_review:
    "Seus documentos estão em análise pelo Asaas. Isso costuma levar alguns dias úteis.",
  approved: "",
  rejected:
    "O Asaas recusou os dados da sua conta de recebimento. Corrija o que foi apontado e envie novamente.",
  suspended:
    "O Asaas suspendeu a conta da academia. Os pagamentos dos alunos não entram enquanto a suspensão não for resolvida.",
};

/**
 * Says why the academy cannot be paid yet and points at where to resolve it.
 *
 * `blocking` only changes the copy: the API refuses to create a plan without an
 * approved account, while it does not gate editing an existing one.
 */
export function PlanPayoutAccountNotice({ blocking }: { blocking: boolean }) {
  const router = useRouter();
  const { data: account, isPending, isError } = usePayoutAccount();

  // Nothing to say while the answer is unknown — an unreachable API is not
  // evidence that the account is missing.
  if (isPending || isError) return null;
  if (account?.status === "approved") return null;

  const message = account
    ? STATUS_MESSAGES[account.status]
    : "Sua academia ainda não tem uma conta de recebimento. Os pagamentos dos alunos vão direto para ela, então ela precisa existir antes dos planos.";
  const label = account ? STATUS_LABELS[account.status] : "Nenhuma conta cadastrada";
  // Mirrors the dashboard card: onboarding creates the account, documents is
  // where an existing one gets unblocked.
  const route = account ? PAYOUT_DOCUMENTS_ROUTE : PAYOUT_ONBOARDING_ROUTE;

  return (
    <CardShell>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Landmark size={16} color={AMBER} />
          <Text className="font-poppins-semibold text-sm text-primary">
            Conta de recebimento
          </Text>
        </View>
        <View
          className="rounded-full"
          style={{ paddingHorizontal: 10, paddingVertical: 3, backgroundColor: `${AMBER}20` }}
        >
          <Text className="font-poppins-medium text-[10px]" style={{ color: AMBER }}>
            {label}
          </Text>
        </View>
      </View>

      <Body>
        {message}{" "}
        {blocking
          ? "Enquanto ela não estiver ativa não é possível criar planos, porque o pagamento do aluno não teria para onde ir."
          : "Você pode editar este plano normalmente, mas os alunos só conseguem pagar depois que ela estiver ativa."}
      </Body>

      <Pressable
        onPress={() => router.push(route)}
        className="flex-row items-center"
        style={{ gap: 6 }}
      >
        <Text className="font-poppins-semibold text-xs" style={{ color: ACCENT }}>
          {account ? "Resolver pendências" : "Criar conta de recebimento"}
        </Text>
        <ArrowRight size={14} color={ACCENT} />
      </Pressable>
    </CardShell>
  );
}
