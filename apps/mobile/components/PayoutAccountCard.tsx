import { usePayoutAccount } from "@/lib/hooks/use-payout-account";
import type { PayoutAccount } from "@/lib/hooks/use-payout-account";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  CircleCheck,
  Clock,
  ExternalLink,
  FileUp,
  Landmark,
  Plus,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react-native";
import { Linking, Pressable, Text, View } from "react-native";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";
const ACCENT = "#A078E8";
const GREEN = "#32D74B";
const RED = "#FF453A";
const AMBER = "#FFD60A";

const ONBOARDING_ROUTE = "/(app)/(manager)/(finances)/payout-account/onboarding";
const DOCUMENTS_ROUTE = "/(app)/(manager)/(finances)/payout-account/documents";
const ASAAS_LOGIN_URL = "https://www.asaas.com/login";

/** Small pill that carries the account state, mirroring the dashboard palette. */
function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <View
      className="rounded-full"
      style={{ paddingHorizontal: 10, paddingVertical: 3, backgroundColor: `${color}20` }}
    >
      <Text className="font-poppins-medium text-[10px]" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

function CardShell({
  children,
  borderColor,
}: {
  children: React.ReactNode;
  /** Only the suspended state paints its own border — everything else inherits. */
  borderColor?: string;
}) {
  return (
    <View
      className="rounded-2xl border border-surface-border bg-surface"
      style={borderColor ? { padding: 14, gap: 12, borderColor } : { padding: 14, gap: 12 }}
    >
      {children}
    </View>
  );
}

function CardHeader({
  icon,
  pill,
}: {
  icon: React.ReactNode;
  pill?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {icon}
        <Text className="font-poppins-bold text-[15px] text-primary">
          Conta de recebimento
        </Text>
      </View>
      {pill}
    </View>
  );
}

function PrimaryButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-center rounded-lg"
      style={{ height: 44, gap: 8, backgroundColor: ACCENT }}
    >
      {icon}
      <Text className="font-poppins-semibold text-sm text-white">{label}</Text>
    </Pressable>
  );
}

/** Secondary, quieter action — used for the links that leave the app. */
function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between rounded-lg"
      style={{ padding: 10, paddingHorizontal: 12, backgroundColor: "#2A2A2A" }}
    >
      <Text className="font-poppins-medium text-xs" style={{ color: TEXT_SECONDARY }}>
        {label}
      </Text>
      <ExternalLink size={14} color={TEXT_SECONDARY} />
    </Pressable>
  );
}

function Description({ children }: { children: React.ReactNode }) {
  return (
    <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY, lineHeight: 18 }}>
      {children}
    </Text>
  );
}

/** What Asaas is still waiting on, in the order the manager sees it happen. */
const IN_REVIEW_COPY: Record<string, { pill: string; text: string }> = {
  pending: {
    pill: "Em criação",
    text: "Sua conta foi criada e está aguardando o envio dos documentos para ser liberada.",
  },
  awaiting_documents: {
    pill: "Documentos pendentes",
    text: "Faltam documentos para o Asaas liberar os recebimentos da sua academia.",
  },
  under_review: {
    pill: "Em análise",
    text: "Seus documentos foram enviados e estão em análise pelo Asaas. Isso costuma levar alguns dias úteis.",
  },
};

export function PayoutAccountCard() {
  const router = useRouter();
  const { data: account, isPending, isError } = usePayoutAccount();

  // The card is an extra on a dashboard that already works without it: while the
  // account is loading, or if the request failed, it simply stays out of the way.
  if (isPending || isError) return null;

  if (!account) return <NoAccountCard onPress={() => router.push(ONBOARDING_ROUTE)} />;

  switch (account.status) {
    case "pending":
    case "awaiting_documents":
    case "under_review":
      return (
        <InReviewCard
          account={account}
          onPress={() => router.push(DOCUMENTS_ROUTE)}
        />
      );
    case "rejected":
      return (
        <RejectedCard
          account={account}
          onPress={() => router.push(DOCUMENTS_ROUTE)}
        />
      );
    case "suspended":
      return (
        <SuspendedCard
          account={account}
          onPress={() => router.push(DOCUMENTS_ROUTE)}
        />
      );
    case "approved":
      return <ApprovedCard />;
    default:
      return null;
  }
}

function NoAccountCard({ onPress }: { onPress: () => void }) {
  return (
    <CardShell>
      <CardHeader icon={<Landmark size={18} color={ACCENT} />} />
      <View className="items-center" style={{ gap: 8, paddingVertical: 8 }}>
        <Landmark size={32} color={TEXT_MUTED} />
        <Text className="font-poppins-medium text-sm" style={{ color: TEXT_SECONDARY }}>
          Nenhuma conta cadastrada
        </Text>
        <Text
          className="font-poppins text-xs text-center"
          style={{ color: TEXT_MUTED, lineHeight: 18 }}
        >
          Os pagamentos dos alunos vão direto para a conta da academia. Crie sua conta de
          recebimento para começar a cobrar pelo app.
        </Text>
      </View>
      <PrimaryButton
        label="Criar conta de recebimento"
        icon={<Plus size={16} color="#FFFFFF" />}
        onPress={onPress}
      />
    </CardShell>
  );
}

function InReviewCard({
  account,
  onPress,
}: {
  account: PayoutAccount;
  onPress: () => void;
}) {
  const copy = IN_REVIEW_COPY[account.status] ?? IN_REVIEW_COPY.pending;

  return (
    <CardShell>
      <CardHeader
        icon={<Clock size={18} color={AMBER} />}
        pill={<StatusPill label={copy.pill} color={AMBER} />}
      />
      <Description>{copy.text}</Description>
      <PrimaryButton
        label={account.status === "under_review" ? "Acompanhar análise" : "Enviar documentos"}
        icon={<FileUp size={16} color="#FFFFFF" />}
        onPress={onPress}
      />
      {account.onboardingUrl && (
        <>
          <Text className="font-poppins text-[11px]" style={{ color: TEXT_MUTED }}>
            Alguns documentos só podem ser enviados no site do Asaas.
          </Text>
          <LinkRow
            label="Continuar no site do Asaas"
            onPress={() => Linking.openURL(account.onboardingUrl as string)}
          />
        </>
      )}
    </CardShell>
  );
}

function RejectedCard({
  account,
  onPress,
}: {
  account: PayoutAccount;
  onPress: () => void;
}) {
  return (
    <CardShell>
      <CardHeader
        icon={<TriangleAlert size={18} color={RED} />}
        pill={<StatusPill label="Recusada" color={RED} />}
      />
      <Description>
        O Asaas recusou os dados da sua conta de recebimento. Corrija o que foi apontado e
        envie novamente.
      </Description>
      {account.rejectionReason && (
        <View className="rounded-lg" style={{ padding: 10, backgroundColor: `${RED}15` }}>
          <Text className="font-poppins text-xs" style={{ color: RED, lineHeight: 18 }}>
            {account.rejectionReason}
          </Text>
        </View>
      )}
      <PrimaryButton
        label="Reenviar documentos"
        icon={<FileUp size={16} color="#FFFFFF" />}
        onPress={onPress}
      />
    </CardShell>
  );
}

/**
 * The academy was receiving and stopped. This is not an onboarding step, so it
 * reads as an interruption: red border, money-stopped copy, resolution first.
 */
function SuspendedCard({
  account,
  onPress,
}: {
  account: PayoutAccount;
  onPress: () => void;
}) {
  return (
    <CardShell borderColor={RED}>
      <CardHeader
        icon={<ShieldAlert size={18} color={RED} />}
        pill={<StatusPill label="Suspensa" color={RED} />}
      />
      <View className="rounded-lg" style={{ padding: 10, gap: 4, backgroundColor: `${RED}15` }}>
        <Text className="font-poppins-semibold text-sm" style={{ color: RED }}>
          Você não está mais recebendo
        </Text>
        <Text className="font-poppins text-xs" style={{ color: RED, lineHeight: 18 }}>
          O Asaas suspendeu a conta da academia. Os pagamentos dos alunos não entram
          enquanto a suspensão não for resolvida.
        </Text>
      </View>
      {account.rejectionReason && (
        <Description>{account.rejectionReason}</Description>
      )}
      <PrimaryButton
        label="Resolver pendências"
        icon={<ArrowRight size={16} color="#FFFFFF" />}
        onPress={onPress}
      />
      <LinkRow
        label="Abrir minha conta no Asaas"
        onPress={() => Linking.openURL(ASAAS_LOGIN_URL)}
      />
    </CardShell>
  );
}

function ApprovedCard() {
  return (
    <CardShell>
      <CardHeader
        icon={<CircleCheck size={18} color={GREEN} />}
        pill={<StatusPill label="Ativa" color={GREEN} />}
      />
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN }} />
        <Text className="font-poppins text-xs" style={{ color: GREEN }}>
          Conta liberada para recebimentos
        </Text>
      </View>
      <Description>
        Os pagamentos dos alunos caem direto na conta da academia. Acesse o Asaas para
        transferir o saldo e ver os extratos.
      </Description>
      <LinkRow
        label="Acessar minha conta no Asaas"
        onPress={() => Linking.openURL(ASAAS_LOGIN_URL)}
      />
    </CardShell>
  );
}
