"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Users, DollarSign, Calendar, AlertTriangle } from "lucide-react";
import { managerFetch } from "@/lib/manager-api";

// --- Types ---

interface FinancialSummary {
  revenueCurrentMonth: number;
  revenuePreviousMonth: number;
  pendingPaymentsCount: number;
  pendingPaymentsTotal: number;
  activeSubscriptionsCount: number;
}

interface Payment {
  id: string;
  userName: string;
  amountCents: number;
  method: string;
  referenceMonth: string;
  paidAt: string;
}

interface PaymentsResponse {
  items: Payment[];
}

// --- Helpers ---

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

// --- Skeleton ---

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/5 ${className ?? ""}`}
    />
  );
}

function KpiSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-24" />
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <tr>
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

// --- KPI Card ---

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/[0.125]">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <span className="text-2xl font-bold text-text-primary">{value}</span>
    </div>
  );
}

// --- Bar Chart (div-based) ---

// --- Transactions Table ---

function TransactionsTable({ payments }: { payments: Payment[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Transações Recentes
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 pb-3 text-xs font-medium text-text-muted">
                Aluno
              </th>
              <th className="px-4 pb-3 text-xs font-medium text-text-muted">
                Valor
              </th>
              <th className="px-4 pb-3 text-xs font-medium text-text-muted">
                Método
              </th>
              <th className="px-4 pb-3 text-xs font-medium text-text-muted">
                Referência
              </th>
              <th className="px-4 pb-3 text-xs font-medium text-text-muted">
                Data
              </th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-text-muted"
                >
                  Nenhuma transação encontrada.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border/50 last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {p.userName}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {formatCurrency(p.amountCents)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary capitalize">
                    {p.method === "manual" ? "Manual" : p.method === "stripe" ? "Cartão" : "PIX"}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {p.referenceMonth?.slice(0, 7)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {formatDate(p.paidAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Page ---

export default function FinancialDashboardPage() {
  const { getToken } = useAuth();

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      setError("");
      try {
        const token = await getToken();

        const [summaryData, paymentsData] = await Promise.all([
          managerFetch<FinancialSummary>("/finances/summary", token),
          managerFetch<PaymentsResponse>(
            "/payments?limit=10",
            token,
          ),
        ]);

        setSummary(summaryData);
        setPayments(paymentsData.items ?? []);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar dados",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [getToken]);

  return (
    <div className="flex flex-col gap-6 p-5 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-text-primary">
          Financeiro
        </h1>
        <p className="text-sm text-text-secondary">
          Resumo financeiro da sua academia
        </p>
      </div>

      {error && (
        <div className="rounded-[10px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : summary ? (
          <>
            <KpiCard
              label="Membros Ativos"
              value={summary.activeSubscriptionsCount.toString()}
              icon={Users}
            />
            <KpiCard
              label="Receita Mensal"
              value={formatCurrency(summary.revenueCurrentMonth)}
              icon={DollarSign}
            />
            <KpiCard
              label="Pagamentos Pendentes"
              value={summary.pendingPaymentsCount.toString()}
              icon={Calendar}
            />
            <KpiCard
              label="Total Pendente"
              value={formatCurrency(summary.pendingPaymentsTotal)}
              icon={AlertTriangle}
            />
          </>
        ) : null}
      </div>

      {/* Transactions */}
      {loading ? (
        <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <Skeleton className="h-4 w-40" />
          </div>
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <TransactionsTable payments={payments} />
      )}
    </div>
  );
}
