import { BackButton } from "@/components/BackButton";
import {
  PayoutDocumentGroupCard,
  StatusChip,
  asaasStatusColor,
  asaasStatusLabel,
  resolveDocumentType,
} from "@/components/PayoutDocumentGroupCard";
import { ApiError } from "@/lib/api";
import {
  usePayoutAccount,
  usePayoutAccountDocuments,
  useRefreshPayoutAccountStatus,
  useUploadPayoutDocument,
  type PayoutAccountStatus,
  type PayoutDocumentType,
} from "@/lib/hooks/use-payout-account";
import * as ImagePicker from "expo-image-picker";
import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { AlertTriangle, CheckCircle2, FileText } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";
const ACCENT = "#A078E8";
const GREEN = "#32D74B";
const RED = "#FF453A";
const AMBER = "#FFD60A";

const ONBOARDING_ROUTE =
  "/(app)/(manager)/(finances)/payout-account/onboarding";

/** multer refuses anything larger before the route handler even runs. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Same wording and palette the dashboard card uses, so the two never disagree. */
const ACCOUNT_STATUS_LABELS: Record<PayoutAccountStatus, string> = {
  pending: "Em criação",
  awaiting_documents: "Documentos pendentes",
  under_review: "Em análise",
  approved: "Ativa",
  rejected: "Recusada",
  suspended: "Suspensa",
};

const ACCOUNT_STATUS_DESCRIPTIONS: Record<PayoutAccountStatus, string> = {
  pending:
    "Sua conta foi criada e está aguardando o envio dos documentos para ser liberada.",
  awaiting_documents:
    "Faltam documentos para o Asaas liberar os recebimentos da sua academia.",
  under_review:
    "Seus documentos foram enviados e estão em análise pelo Asaas. Isso costuma levar alguns dias úteis.",
  approved:
    "Os pagamentos dos alunos caem direto na conta da academia.",
  rejected:
    "O Asaas recusou os dados da sua conta de recebimento. Corrija o que foi apontado e envie novamente.",
  suspended:
    "O Asaas suspendeu a conta da academia. Os pagamentos dos alunos não entram enquanto a suspensão não for resolvida.",
};

const ACCOUNT_STATUS_COLORS: Record<PayoutAccountStatus, string> = {
  pending: AMBER,
  awaiting_documents: AMBER,
  under_review: AMBER,
  approved: GREEN,
  rejected: RED,
  suspended: RED,
};

const REVIEW_AREA_LABELS = [
  { key: "generalStatus", label: "Situação geral" },
  { key: "commercialInfoStatus", label: "Dados comerciais" },
  { key: "documentStatus", label: "Documentos" },
  { key: "bankAccountInfoStatus", label: "Dados bancários" },
] as const;

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // The API answers with a code in `error`, which is not worth showing raw.
    if (error.status === 413) {
      return "O arquivo é maior que o limite de 5 MB.";
    }
    return "O Asaas não aceitou este arquivo. Tente outro documento ou outra foto.";
  }
  return "Não foi possível enviar o arquivo. Verifique sua conexão e tente de novo.";
}

type GroupFeedback = { error?: string; success?: string };

export default function PayoutAccountDocumentsScreen() {
  const {
    data: account,
    isPending: isAccountPending,
    isError: isAccountError,
  } = usePayoutAccount();
  const documentsQuery = usePayoutAccountDocuments({ enabled: !!account });
  const refreshStatus = useRefreshPayoutAccountStatus();
  const uploadDocument = useUploadPayoutDocument();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [uploadingGroupId, setUploadingGroupId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, GroupFeedback>>({});
  const [selectedTypes, setSelectedTypes] = useState<Record<string, string>>({});

  const setGroupFeedback = (groupId: string, value: GroupFeedback) => {
    setFeedback((current) => ({ ...current, [groupId]: value }));
  };

  /**
   * Pull-to-refresh has to prove the status, not repeat it: it asks Asaas for
   * the live account and only then reloads the document list.
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      await refreshStatus.mutateAsync();
    } catch {
      setRefreshError(
        "Não foi possível consultar o Asaas agora. Os dados abaixo podem estar desatualizados.",
      );
    }
    await documentsQuery.refetch();
    setIsRefreshing(false);
  };

  const handleOpenOnboardingUrl = async (url: string) => {
    await WebBrowser.openBrowserAsync(url);
  };

  const handlePickFile = async (groupId: string, type: PayoutDocumentType) => {
    setGroupFeedback(groupId, {});

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];

    // The 5 MB cap is enforced by multer before the handler, so a file over it
    // fails with no useful message. Catching it here keeps the reason readable.
    if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
      setGroupFeedback(groupId, {
        error: `O arquivo tem ${formatMegabytes(asset.fileSize)} e o limite é 5 MB. Escolha um arquivo menor.`,
      });
      return;
    }

    setUploadingGroupId(groupId);
    try {
      await uploadDocument.mutateAsync({
        groupId,
        type,
        file: {
          uri: asset.uri,
          name: asset.fileName ?? `documento-${Date.now()}.jpg`,
          type: asset.mimeType ?? "image/jpeg",
        },
      });
      setGroupFeedback(groupId, {
        success: "Documento enviado. O Asaas vai analisar em seguida.",
      });
    } catch (error) {
      setGroupFeedback(groupId, { error: readErrorMessage(error) });
    } finally {
      setUploadingGroupId(null);
    }
  };

  if (isAccountPending) {
    return (
      <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
        <View
          className="flex-row items-center px-6"
          style={{ paddingTop: 8, paddingBottom: 8, minHeight: 62 }}
        >
          <BackButton />
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  // Without an account there is nothing to track — the manager belongs in the
  // onboarding form, not in an error state.
  if (!isAccountError && !account) {
    return <Redirect href={ONBOARDING_ROUTE} />;
  }

  const statusLabel = account
    ? ACCOUNT_STATUS_LABELS[account.status] ?? account.status
    : "";
  const statusColor = account
    ? ACCOUNT_STATUS_COLORS[account.status] ?? TEXT_SECONDARY
    : TEXT_SECONDARY;
  const statusDescription = account
    ? ACCOUNT_STATUS_DESCRIPTIONS[account.status] ?? ""
    : "";

  const documents = documentsQuery.data;
  const groups = documents?.groups ?? [];
  const rejectionReason = documents?.rejectReasons ?? account?.rejectionReason;
  const isApproved = account?.status === "approved";

  return (
    <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 24,
          gap: 18,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={ACCENT}
          />
        }
      >
        <View
          className="flex-row items-center gap-3"
          style={{ minHeight: 62, paddingTop: 8 }}
        >
          <BackButton />
          <Text className="flex-1 text-center font-poppins-bold text-lg text-primary">
            Conta de recebimento
          </Text>
          <View className="h-10 w-10" />
        </View>

        {isAccountError && !account ? (
          <View
            className="rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 14, gap: 6 }}
          >
            <Text className="font-poppins-semibold text-sm text-primary">
              Não foi possível carregar a conta
            </Text>
            <Text className="font-poppins text-[11px]" style={{ color: TEXT_SECONDARY }}>
              Puxe a tela para baixo para tentar de novo.
            </Text>
          </View>
        ) : null}

        {account ? (
          <View
            className="rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 14, gap: 12 }}
          >
            <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
              <Text className="font-poppins-semibold text-[15px] text-primary">
                Situação da conta
              </Text>
              <View
                className="rounded-full"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  backgroundColor: `${statusColor}20`,
                }}
              >
                <Text
                  className="font-poppins-medium text-[10px]"
                  style={{ color: statusColor }}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>
            <Text className="font-poppins text-[11px]" style={{ color: TEXT_SECONDARY }}>
              {statusDescription}
            </Text>

            <View style={{ gap: 8 }}>
              {REVIEW_AREA_LABELS.map((area) => (
                <View
                  key={area.key}
                  className="flex-row items-center justify-between"
                  style={{ gap: 10 }}
                >
                  <Text
                    className="font-poppins text-xs"
                    style={{ color: TEXT_SECONDARY }}
                  >
                    {area.label}
                  </Text>
                  <Text
                    className="font-poppins-medium text-xs"
                    style={{ color: asaasStatusColor(account[area.key]) }}
                  >
                    {asaasStatusLabel(account[area.key])}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {refreshError ? (
          <Text className="font-poppins text-[11px]" style={{ color: AMBER }}>
            {refreshError}
          </Text>
        ) : null}

        {rejectionReason ? (
          <View
            className="rounded-2xl border bg-surface"
            style={{ padding: 14, gap: 8, borderColor: `${RED}55` }}
          >
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <AlertTriangle size={16} color={RED} />
              <Text className="font-poppins-semibold text-sm" style={{ color: RED }}>
                Motivo da recusa
              </Text>
            </View>
            <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
              {rejectionReason}
            </Text>
            <Text className="font-poppins text-[11px]" style={{ color: TEXT_MUTED }}>
              Corrija o que foi apontado e reenvie os documentos abaixo.
            </Text>
          </View>
        ) : null}

        <Text
          className="font-poppins-semibold text-sm"
          style={{ color: TEXT_SECONDARY }}
        >
          Documentos
        </Text>

        {documentsQuery.isPending && account ? (
          <View className="items-center py-8">
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : null}

        {documentsQuery.isError ? (
          <View
            className="rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 14, gap: 6 }}
          >
            <Text className="font-poppins-medium text-sm text-primary">
              Não foi possível carregar os documentos
            </Text>
            <Text className="font-poppins text-[11px]" style={{ color: TEXT_SECONDARY }}>
              Puxe a tela para baixo para tentar de novo.
            </Text>
          </View>
        ) : null}

        {!documentsQuery.isPending && !documentsQuery.isError && groups.length === 0 ? (
          <View
            className="items-center rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 20, gap: 8 }}
          >
            {isApproved ? (
              <CheckCircle2 size={32} color={GREEN} />
            ) : (
              <FileText size={32} color={TEXT_MUTED} />
            )}
            <Text className="font-poppins-medium text-sm" style={{ color: TEXT_SECONDARY }}>
              {isApproved
                ? "Conta ativa, nada pendente"
                : "Nenhum documento pendente"}
            </Text>
            <Text
              className="text-center font-poppins text-xs"
              style={{ color: TEXT_MUTED }}
            >
              {isApproved
                ? "Sua conta está aprovada e não há nenhum documento aguardando envio."
                : "O Asaas leva cerca de 15 segundos para liberar a lista depois que a conta é criada. Puxe a tela para baixo para atualizar."}
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          {groups.map((group) => (
            <PayoutDocumentGroupCard
              key={group.id}
              group={group}
              isUploading={uploadingGroupId === group.id}
              errorMessage={feedback[group.id]?.error}
              successMessage={feedback[group.id]?.success}
              selectedType={
                selectedTypes[group.id] ??
                (resolveDocumentType(group.type) ? group.type : "")
              }
              onSelectType={(value) =>
                setSelectedTypes((current) => ({ ...current, [group.id]: value }))
              }
              onPickFile={(type) => handlePickFile(group.id, type)}
              onOpenOnboardingUrl={handleOpenOnboardingUrl}
            />
          ))}
        </View>

        {account?.onboardingUrl && groups.length === 0 && !isApproved ? (
          <Text className="font-poppins text-[11px]" style={{ color: TEXT_MUTED }}>
            O Asaas também disponibiliza um site para concluir o cadastro, caso
            algum dado ainda esteja faltando.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
