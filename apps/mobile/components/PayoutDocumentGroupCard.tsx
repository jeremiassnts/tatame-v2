import { ModalSelect } from "@/components/ModalSelect";
import type {
  PayoutAccountDocumentGroup,
  PayoutDocumentType,
} from "@/lib/hooks/use-payout-account";
import { asaasDocumentTypeSchema } from "@tatame/validators";
import { CheckCircle2, ExternalLink, Upload } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

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

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  ALLOW_BANK_ACCOUNT_DEPOSIT_STATEMENT: "Autorização de depósito em conta",
  CUSTOM: "Outro documento",
  EMANCIPATION_OF_MINORS: "Emancipação de menor",
  ENTREPRENEUR_REQUIREMENT: "Requerimento de empresário",
  IDENTIFICATION_SELFIE: "Selfie com documento",
  IDENTIFICATION: "Documento de identificação",
  INVOICE: "Nota fiscal",
  MEI_CERTIFICATE: "Certificado do MEI",
  MINUTES_OF_CONSTITUTION: "Ata de constituição",
  MINUTES_OF_ELECTION: "Ata de eleição",
  POWER_OF_ATTORNEY: "Procuração",
  SOCIAL_CONTRACT: "Contrato social",
};

const DOCUMENT_TYPE_OPTIONS = asaasDocumentTypeSchema.options.map((value) => ({
  value,
  label: DOCUMENT_TYPE_LABELS[value] ?? value,
}));

/**
 * The group already carries the type Asaas expects, so it is the default. Only
 * a value outside the enum the API accepts forces us to ask the manager.
 */
export function resolveDocumentType(
  groupType: string,
): PayoutDocumentType | null {
  const parsed = asaasDocumentTypeSchema.safeParse(groupType);
  return parsed.success ? parsed.data : null;
}

type PayoutDocumentGroupCardProps = {
  group: PayoutAccountDocumentGroup;
  /** Set while this group — and only this group — is being uploaded. */
  isUploading: boolean;
  errorMessage?: string;
  successMessage?: string;
  /** Chosen type, only used when the group type is not one Asaas accepts. */
  selectedType: string;
  onSelectType: (value: string) => void;
  onPickFile: (type: PayoutDocumentType) => void;
  onOpenOnboardingUrl: (url: string) => void;
};

export function PayoutDocumentGroupCard({
  group,
  isUploading,
  errorMessage,
  successMessage,
  selectedType,
  onSelectType,
  onPickFile,
  onOpenOnboardingUrl,
}: PayoutDocumentGroupCardProps) {
  const knownType = resolveDocumentType(group.type);
  const effectiveType = knownType ?? resolveDocumentType(selectedType);
  const sentCount = group.documents.length;

  // The single branch that matters: Asaas refuses an API upload for any group
  // that carries an onboarding link, so those get a link and never a picker.
  const mustUseOnboardingLink = !group.canUploadInApp || !!group.onboardingUrl;
  // Asaas approves a group on its own — instantly in sandbox, after review in
  // production — and an approved group has nothing left to ask for.
  const isApproved = group.status === "APPROVED";

  /*
    Asaas sends a `description` written for Asaas's own screens: "para enviar
    esse documento acesse nosso aplicativo ou utilize o link de onboarding",
    where "nosso aplicativo" is theirs and the link is `onboardingUrl` — null on
    every group we can upload to. Rendering it verbatim pointed the manager away
    from the button directly below it, so the instruction is ours and follows
    whichever branch the card is about to render.
  */
  const instruction = isApproved
    ? "O Asaas já aprovou este documento."
    : mustUseOnboardingLink
      ? "O Asaas só aceita este documento pelo site dele."
      : "Envie uma foto nítida do documento, com todas as bordas visíveis.";

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
      ) : mustUseOnboardingLink ? (
        <View style={{ gap: 10 }}>
          <Text className="font-poppins text-[11px]" style={{ color: TEXT_MUTED }}>
            Toque abaixo para concluir por lá e volte para atualizar a situação.
          </Text>
          <Pressable
            onPress={() =>
              group.onboardingUrl && onOpenOnboardingUrl(group.onboardingUrl)
            }
            disabled={!group.onboardingUrl}
            className="flex-row items-center justify-center rounded-xl"
            style={{
              height: 44,
              gap: 8,
              backgroundColor: group.onboardingUrl ? "#2A2A2A" : "#1F1F1F",
            }}
          >
            <ExternalLink size={16} color={group.onboardingUrl ? ACCENT : TEXT_MUTED} />
            <Text
              className="font-poppins-semibold text-sm"
              style={{ color: group.onboardingUrl ? ACCENT : TEXT_MUTED }}
            >
              Enviar no site do Asaas
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {knownType ? null : (
            <View style={{ gap: 8 }}>
              <Text
                className="font-poppins-medium text-xs"
                style={{ color: TEXT_SECONDARY }}
              >
                Tipo do documento
              </Text>
              <ModalSelect
                value={selectedType}
                onChange={onSelectType}
                options={DOCUMENT_TYPE_OPTIONS}
                placeholder="Selecionar tipo"
                disabled={isUploading}
              />
            </View>
          )}
          <Pressable
            onPress={() => effectiveType && onPickFile(effectiveType)}
            disabled={isUploading || !effectiveType}
            className="flex-row items-center justify-center rounded-xl"
            style={{
              height: 44,
              gap: 8,
              backgroundColor: effectiveType && !isUploading ? ACCENT : "#3A3A3A",
            }}
          >
            {isUploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Upload size={16} color="#FFFFFF" />
                <Text className="font-poppins-semibold text-sm text-white">
                  {sentCount > 0 ? "Enviar outro arquivo" : "Enviar documento"}
                </Text>
              </>
            )}
          </Pressable>
          {isUploading ? (
            <Text className="font-poppins text-[11px]" style={{ color: TEXT_SECONDARY }}>
              Enviando o arquivo para o Asaas...
            </Text>
          ) : null}
        </View>
      )}

      {errorMessage ? (
        <Text className="font-poppins text-[11px]" style={{ color: RED }}>
          {errorMessage}
        </Text>
      ) : null}
      {successMessage ? (
        <Text className="font-poppins text-[11px]" style={{ color: GREEN }}>
          {successMessage}
        </Text>
      ) : null}
    </View>
  );
}
