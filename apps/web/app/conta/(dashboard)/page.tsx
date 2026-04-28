"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Users, DollarSign, Calendar, AlertTriangle } from "lucide-react";
import { managerFetch } from "@/lib/manager-api";

// --- Types ---

interface FinancialSummary {
  activeStudents: number;
  monthlyRevenue: number;
  monthlyCheckins: number;
  defaultRate: number;
  revenueByPlan: { planName: string; revenue: number }[];
  received: number;
  pending: number;
  overdue: number;
}

interface Payment {
  id: string;
  studentName: string;
  planName: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  date: string;
}

interface PaymentsResponse {
  data: Payment[];
  total: number;
}

// --- Helpers ---

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

const STATUS_LABEL: Record<Payment["status"], string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Atrasado",
};

const STATUS_CLASS: Record<Payment["status"], string> = {
  paid: "bg-green-500/15 text-green-400",
  pending: "bg-yellow-500/15 text-yellow-400",
  overdue: "bg-red-500/15 text-red-400",
};

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

function RevenueByPlan({
  items,
}: {
  items: { planName: string; revenue: number }[];
}) {
  const max = Math.max(...items.map((i) => i.revenue), 1);

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-text-primary">
        Receita por Plano
      </h2>
      <div className="flex flex-col gap-3 pt-1">
        {items.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum dado disponível.</p>
        ) : (
          items.map((item) => {
            const pct = Math.round((item.revenue / max) * 100);
            return (
              <div key={item.planName} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">{item.planName}</span>
                  <span className="font-medium text-text-primary">
                    {formatCurrency(item.revenue)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- Month Summary ---

function MonthSummary({
  received,
  pending,
  overdue,
}: {
  received: number;
  pending: number;
  overdue: number;
}) {
  const rows = [
    { label: "Recebido", value: received, color: "text-green-400" },
    { label: "Pendente", value: pending, color: "text-yellow-400" },
    { label: "Atrasado", value: overdue, color: "text-red-400" },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-text-primary">
        Resumo do Mês
      </h2>
      <div className="flex flex-col divide-y divide-border">
        {rows.map(({ label, value, color }) => (
          <div
            key={label}
            className="flex items-center justify-between py-3 first:pt-1 last:pb-1"
          >
            <span className="text-sm text-text-secondary">{label}</span>
            <span className={`text-sm font-semibold ${color}`}>
              {formatCurrency(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
                Plano
              </th>
              <th className="px-4 pb-3 text-xs font-medium text-text-muted">
                Valor
              </th>
              <th className="px-4 pb-3 text-xs font-medium text-text-muted">
                Status
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
                  colSpan={5}
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
                    {p.studentName}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{p.planName}</td>
                  <td className="px-4 py-3 text-text-primary">
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[p.status]}`}
                    >
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {formatDate(p.date)}
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
            "/payments?limit=10&page=1",
            token,
          ),
        ]);

        setSummary(summaryData);
        setPayments(paymentsData.data ?? []);
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
              label="Alunos Ativos"
              value={summary.activeStudents.toString()}
              icon={Users}
            />
            <KpiCard
              label="Receita Mensal"
              value={formatCurrency(summary.monthlyRevenue)}
              icon={DollarSign}
            />
            <KpiCard
              label="Check-ins do Mês"
              value={summary.monthlyCheckins.toString()}
              icon={Calendar}
            />
            <KpiCard
              label="Inadimplência"
              value={`${summary.defaultRate.toFixed(1)}%`}
              icon={AlertTriangle}
            />
          </>
        ) : null}
      </div>

      {/* Charts + Summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loading ? (
          <>
            <Skeleton className="h-[220px] rounded-[14px]" />
            <Skeleton className="h-[220px] rounded-[14px]" />
          </>
        ) : summary ? (
          <>
            <RevenueByPlan items={summary.revenueByPlan ?? []} />
            <MonthSummary
              received={summary.received}
              pending={summary.pending}
              overdue={summary.overdue}
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
