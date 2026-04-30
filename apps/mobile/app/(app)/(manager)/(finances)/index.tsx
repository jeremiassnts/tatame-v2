import { BackButton } from "@/components/BackButton";
import { ModalSelect } from "@/components/ModalSelect";
import { useAcademyContext } from "@/lib/academy-context";
import { useFinancialSummary, usePaymentHistory } from "@/lib/hooks/use-finances";
import { useAcademy, useUpdatePixKey } from "@/lib/hooks/use-academy";
import { useManagerSubscription } from "@/lib/hooks/use-manager-subscription";
import { useRouter } from "expo-router";
import {
  CreditCard,
  FileText,
  Crown,
  KeyRound,
  Pencil,
  Plus,
  QrCode,
  Receipt,
  Users,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Constants from "expo-constants";
import { SafeAreaView } from "react-native-safe-area-context";

const TEXT_SECONDARY = "#ABABAB";
const TEXT_MUTED = "#525252";
const PORTAL_URL = Constants.expoConfig?.extra?.managerPortalUrl ?? "https://tatame.app/conta";

const PIX_TYPE_LABELS: Record<string, string> = {
  cpf: "CPF",
  email: "E-mail",
  phone: "Telefone",
  random: "Chave aleatória",
};

const PIX_TYPE_OPTIONS = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
];

function formatCurrency(cents: number): string {
  return `R$${(cents / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function formatCurrencyFull(cents: number): string {
  const str = (cents / 100).toFixed(2).replace(".", ",");
  return `R$ ${str.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function formatDate(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function percentChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

export default function FinancialDashboard() {
  const router = useRouter();
  const {
    data: summary,
    isPending,
    isFetching,
    refetch,
  } = useFinancialSummary();
  const { data: recentPayments } = usePaymentHistory({ limit: 10 });
  const { data: subscription } = useManagerSubscription();
  const { academyId } = useAcademyContext();
  const { data: academy } = useAcademy(academyId);
  const updatePixKey = useUpdatePixKey(academyId);
  const [pixModalVisible, setPixModalVisible] = useState(false);
  const [pixKeyType, setPixKeyType] = useState("");
  const [pixKeyValue, setPixKeyValue] = useState("");

  if (isPending) {
    return (
      <SafeAreaView className="flex-1 bg-background pt-4" edges={["top"]}>
        <View
          className="flex-row items-center px-6"
          style={{ paddingTop: 8, paddingBottom: 8, minHeight: 62 }}
        >
          <BackButton />
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#A078E8" />
        </View>
      </SafeAreaView>
    );
  }

  const pctLabel = summary
    ? percentChange(summary.revenueCurrentMonth, summary.revenuePreviousMonth)
    : "";
  const pctColor =
    pctLabel.startsWith("+") || pctLabel === "0%" ? "#32D74B" : "#FF453A";

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
            refreshing={isFetching && !isPending}
            onRefresh={() => refetch()}
            tintColor="#A078E8"
          />
        }
      >
        <View className="flex-row items-center gap-3" style={{ minHeight: 62, paddingTop: 8 }}>
          <BackButton />
          <Text className="flex-1 text-center font-poppins-bold text-lg text-primary">
            Financeiro
          </Text>
          <View className="h-10 w-10" />
        </View>

        <View className="flex-row" style={{ gap: 10 }}>
          <View
            className="flex-1 rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 14, gap: 6 }}
          >
            <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
              Receita (mês)
            </Text>
            <Text className="font-poppins-bold text-xl text-primary">
              {formatCurrencyFull(summary?.revenueCurrentMonth ?? 0)}
            </Text>
            <Text
              className="font-poppins text-[11px]"
              style={{ color: pctColor }}
            >
              {pctLabel} vs mês anterior
            </Text>
          </View>
          <Pressable
            onPress={() =>
              router.push(
                "/(app)/(manager)/(finances)/subscriptions?filter=pending",
              )
            }
            className="flex-1 rounded-2xl border border-surface-border bg-surface"
            style={{ padding: 14, gap: 6 }}
          >
            <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
              Pagamentos em atraso
            </Text>
            <Text className="font-poppins-bold text-xl" style={{ color: "#FF453A" }}>
              {summary?.pendingPaymentsCount ?? 0}
            </Text>
            <Text className="font-poppins text-[11px]" style={{ color: "#FF453A" }}>
              {formatCurrency(summary?.pendingPaymentsTotal ?? 0)} pendente
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push("/(app)/(manager)/(members)")}
          className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 14 }}
        >
          <View style={{ gap: 4 }}>
            <Text className="font-poppins text-xs" style={{ color: TEXT_SECONDARY }}>
              Membros ativos
            </Text>
            <Text className="font-poppins-bold text-2xl text-primary">
              {summary?.activeSubscriptionsCount ?? 0}
            </Text>
          </View>
          <View
            className="items-center justify-center rounded-lg"
            style={{
              width: 40,
              height: 40,
              backgroundColor: "#A078E820",
            }}
          >
            <Users size={20} color="#A078E8" />
          </View>
        </Pressable>

        <Pressable
          onPress={() => Linking.openURL(PORTAL_URL)}
          className="flex-row items-center justify-between rounded-2xl border border-surface-border bg-surface"
          style={{ padding: 14 }}
        >
          <View style={{ gap: 4 }}>
            <Text className="font-poppins-semibold text-sm text-white">
              Gerenciar minha conta
            </Text>
            <Text className="font-poppins text-[11px]" style={{ color: TEXT_SECONDARY }}>
              Assinatura, pagamento e dados
            </Text>
          </View>
          <View
            className="items-center justify-center rounded-lg"
            style={{
              width: 40,
              height: 40,
              backgroundColor: "#A078E820",
            }}
          >
            <Crown size={20} color="#A078E8" />
          </View>
        </Pressable>

        <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
          Ações rápidas
        </Text>
        <View className="flex-row" style={{ gap: 8 }}>
          {[
            {
              icon: FileText,
              label: "Planos",
              href: "/(app)/(manager)/(finances)/plans" as const,
            },
            {
              icon: Receipt,
              label: "Assinaturas",
              href: "/(app)/(manager)/(finances)/subscriptions" as const,
            },
            {
              icon: CreditCard,
              label: "Confirmar\nPagamento",
              href: "/(app)/(manager)/(finances)/confirm-payment" as const,
            },
          ].map((action) => (
            <Pressable
              key={action.label}
              onPress={() => router.push(action.href)}
              className="flex-1 items-center justify-center rounded-xl border border-surface-border bg-surface"
              style={{ paddingVertical: 14, gap: 6 }}
            >
              <action.icon size={20} color="#FFFFFF" />
              <Text className="font-poppins-medium text-[11px] text-primary text-center">
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {academy?.pixKey ? (
          <View className="rounded-2xl border border-surface-border bg-surface" style={{ padding: 14, gap: 12 }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <QrCode size={18} color="#A078E8" />
                <Text className="font-poppins-bold text-[15px] text-primary">Chave PIX</Text>
              </View>
              <Pressable
                onPress={() => { setPixKeyType(academy!.pixKeyType ?? ""); setPixKeyValue(academy!.pixKey ?? ""); setPixModalVisible(true); }}
                className="flex-row items-center rounded-lg"
                style={{ padding: 6, paddingHorizontal: 12, gap: 6, backgroundColor: "#2A2A2A" }}
              >
                <Pencil size={14} color="#ABABAB" />
                <Text className="font-poppins text-xs" style={{ color: "#ABABAB" }}>Editar</Text>
              </Pressable>
            </View>
            <View style={{ gap: 4 }}>
              <Text className="font-poppins text-xs" style={{ color: "#ABABAB" }}>{PIX_TYPE_LABELS[academy!.pixKeyType as string] ?? academy!.pixKeyType}</Text>
              <Text className="font-poppins-medium text-sm text-primary">{academy!.pixKey}</Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#32D74B" }} />
              <Text className="font-poppins text-xs" style={{ color: "#32D74B" }}>Chave ativa para recebimentos</Text>
            </View>
          </View>
        ) : (
          <View className="rounded-2xl border border-surface-border bg-surface" style={{ padding: 14, gap: 16 }}>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <QrCode size={18} color="#A078E8" />
              <Text className="font-poppins-bold text-[15px] text-primary">Chave PIX</Text>
            </View>
            <View className="items-center" style={{ gap: 8, paddingVertical: 8 }}>
              <KeyRound size={32} color="#525252" />
              <Text className="font-poppins-medium text-sm" style={{ color: "#ABABAB" }}>Nenhuma chave cadastrada</Text>
              <Text className="font-poppins text-xs text-center" style={{ color: "#525252" }}>
                Cadastre sua chave PIX para receber pagamentos dos alunos diretamente.
              </Text>
            </View>
            <Pressable
              onPress={() => { setPixKeyType(""); setPixKeyValue(""); setPixModalVisible(true); }}
              className="flex-row items-center justify-center rounded-lg"
              style={{ height: 44, gap: 8, backgroundColor: "#A078E8" }}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text className="font-poppins-semibold text-sm text-white">Cadastrar chave PIX</Text>
            </Pressable>
          </View>
        )}

        <Text className="font-poppins-semibold text-sm" style={{ color: TEXT_SECONDARY }}>
          Histórico de pagamentos
        </Text>
        <View style={{ gap: 10 }}>
          {(recentPayments ?? []).map((p) => (
            <View
              key={p.id}
              className="rounded-xl border border-surface-border bg-surface"
              style={{ padding: 12, paddingHorizontal: 14, gap: 4 }}
            >
              <View className="flex-row items-center justify-between">
                <Text className="font-poppins-semibold text-sm text-primary">
                  {p.userName}
                </Text>
                <Text
                  className="font-poppins-bold text-sm"
                  style={{ color: "#32D74B" }}
                >
                  {formatCurrency(p.amountCents)}
                </Text>
              </View>
              <Text className="font-poppins text-[11px]" style={{ color: TEXT_MUTED }}>
                {formatDate(p.paidAt)} · Manual · Ref. {p.referenceMonth.slice(0, 7)}
              </Text>
            </View>
          ))}
          {(recentPayments ?? []).length === 0 && (
            <Text className="font-poppins text-sm" style={{ color: TEXT_MUTED }}>
              Nenhum pagamento registrado
            </Text>
          )}
        </View>
      </ScrollView>

      <Modal visible={pixModalVisible} transparent animationType="fade" onRequestClose={() => setPixModalVisible(false)}>
        <View className="flex-1 justify-center px-6">
          <Pressable className="absolute inset-0 bg-black/60" onPress={() => setPixModalVisible(false)} />
          <View className="rounded-2xl border border-surface-border bg-surface" style={{ padding: 20, gap: 16 }}>
            <Text className="font-poppins-bold text-base text-primary">
              {academy?.pixKey ? "Editar chave PIX" : "Cadastrar chave PIX"}
            </Text>
            <View style={{ gap: 8 }}>
              <Text className="font-poppins-medium text-xs" style={{ color: "#ABABAB" }}>Tipo da chave</Text>
              <ModalSelect value={pixKeyType} onChange={setPixKeyType} options={PIX_TYPE_OPTIONS} placeholder="Selecionar tipo" />
            </View>
            <View style={{ gap: 8 }}>
              <Text className="font-poppins-medium text-xs" style={{ color: "#ABABAB" }}>Chave</Text>
              <TextInput
                value={pixKeyValue}
                onChangeText={setPixKeyValue}
                placeholder="Digite sua chave PIX"
                placeholderTextColor="#525252"
                className="h-[52px] rounded-xl border border-surface-border bg-surface px-4 font-poppins text-[15px] text-primary"
              />
            </View>
            <Pressable
              onPress={async () => {
                if (!pixKeyType || !pixKeyValue.trim()) return;
                await updatePixKey.mutateAsync({ pixKeyType, pixKey: pixKeyValue.trim() });
                setPixModalVisible(false);
              }}
              disabled={!pixKeyType || !pixKeyValue.trim() || updatePixKey.isPending}
              className="items-center justify-center rounded-xl"
              style={{ height: 48, backgroundColor: pixKeyType && pixKeyValue.trim() ? "#A078E8" : "#3A3A3A" }}
            >
              {updatePixKey.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-poppins-semibold text-base text-white">Salvar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
