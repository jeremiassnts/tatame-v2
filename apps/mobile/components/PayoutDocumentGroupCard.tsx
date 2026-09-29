import type { PayoutAccountDocumentGroup } from "@/lib/hooks/use-payout-account";
import { CheckCircle2, ExternalLink } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";
const ACCENT = "#A078E8";
const GREEN = "#32D74B";
const RED = "#FF453A";
const AMBER = "#FFD60A";

/**
 * Asaas reports every review area with the same free-form vocabulary. The maps
 * below translate the values it actually sends and fall back to the raw string,
 * so a value we have never seen shows up instead of breaking the screen.
 */
const ASAAS_STATUS_LABELS: Record<string, string> = {
  NOT_SENT: "Não enviado",
  PENDING: "Pendente",
  AWAITING_APPROVAL: "Em análise",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
};

const ASAAS_STATUS_COLORS: Record<string, string> = {
  NOT_SENT: TEXT_SECONDARY,
  PENDING: AMBER,
  AWAITING_APPROVAL: AMBER,
  APPROVED: GREEN,
  REJECTED: RED,
};

export function asaasStatusLabel(value: string | null | undefined): string {
  if (!value) return "Não informado";
  return ASAAS_STATUS_LABELS[value] ?? value;
}

export function asaasStatusColor(value: string | null | undefined): string {
  if (!value) return TEXT_SECONDARY;
  return ASAAS_STATUS_COLORS[value] ?? TEXT_SECONDARY;
}

/** A translucent chip in the status colour, the pattern the finance cards use. */
export function StatusChip({ value }: { value: string | null | undefined }) {
  const color = asaasStatusColor(value);

  return (
    <View
      className="rounded-full"
      style={{ paddingHorizontal: 10, paddingVertical: 3, backgroundColor: `${color}20` }}
    >
      <Text className="font-poppins-medium text-[10px]" style={{ color }}>
        {asaasStatusLabel(value)}
      </Text>
    </View>
  );
}

type PayoutDocumentGroupCardProps = {
  group: PayoutAccountDocumentGroup;
  onOpenOnboardingUrl: (url: string) => void;
};

/**
 * Reports what Asaas wants and how far each document got. Sending happens in
 * the manager's own Asaas account, never here: a standard subaccount has access
 * to the Asaas interface and that is where Asaas expects the mandatory
 * documents, so an uploader in this app would duplicate a flow Asaas already
 * runs — and one that cannot take the PDFs a CNPJ academy needs.
 *
 * The exception Asaas itself defines: a group carrying an `onboardingUrl` is
 * finished through that link and nowhere else.
 */
export function PayoutDocumentGroupCard({
  group,
  onOpenOnboardingUrl,
}: PayoutDocumentGroupCardProps) {
  const isApproved = group.status === "APPROVED";
  const sentCount = group.documents.length;

  const instruction = isApproved
    ? "O Asaas já aprovou este documento."
    : group.onboardingUrl
      ? "O Asaas pede este documento por um link próprio."
      : "Envie este documento pela sua conta no Asaas.";

  return (
    <View
      className="rounded-2xl border border-surface-border bg-surface"
      style={{ padding: 14, gap: 12 }}
    >
      <View className="flex-row items-start justify-between" style={{ gap: 10 }}>
        <View className="flex-1" style={{ gap: 4 }}>
          <Text className="font-poppins-semibold text-[15px] text-primary">
            {group.title}
          </Text>
          <Text
            className="font-poppins text-[11px]"
            style={{ color: TEXT_SECONDARY }}
          >
            {instruction}
          </Text>
        </View>
        <StatusChip value={group.status} />
      </View>

      {sentCount > 0 ? (
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <CheckCircle2 size={14} color={GREEN} />
          <Text className="font-poppins text-[11px]" style={{ color: TEXT_SECONDARY }}>
            {sentCount === 1
              ? "1 arquivo enviado"
              : `${sentCount} arquivos enviados`}
            {" · "}
            {group.documents.map((doc) => asaasStatusLabel(doc.status)).join(", ")}
          </Text>
        </View>
      ) : null}

      {isApproved ? (
        sentCount > 0 ? null : (
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <CheckCircle2 size={14} color={GREEN} />
            <Text className="font-poppins text-[11px]" style={{ color: TEXT_SECONDARY }}>
              Nada pendente aqui
            </Text>
          </View>
        )
      ) : group.onboardingUrl ? (
        <View style={{ gap: 10 }}>
          <Text className="font-poppins text-[11px]" style={{ color: TEXT_MUTED }}>
            Toque abaixo para concluir por lá e volte para atualizar a situação.
          </Text>
          <Pressable
            onPress={() =>
              group.onboardingUrl && onOpenOnboardingUrl(group.onboardingUrl)
            }
            className="flex-row items-center justify-center rounded-xl"
            style={{ height: 44, gap: 8, backgroundColor: "#2A2A2A" }}
          >
            <ExternalLink size={16} color={ACCENT} />
            <Text className="font-poppins-semibold text-sm" style={{ color: ACCENT }}>
              Abrir o link do Asaas
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
