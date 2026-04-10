"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminFetch, getAdminToken } from "@/lib/api";
import { useRouter } from "next/navigation";
import { KpiCard } from "./components/kpi-card";
import { CheckinsChart } from "./components/checkins-chart";

type DashboardData = {
  activeSubscribers: number;
  totalUsers: number;
  appRevenueCents: number;
  transferredCents: number;
};

type FinancialSummary = {
  transferredCents: number;
  pendingTransferCents: number;
};

type CheckinItem = { date: string; count: number };

type AcademyItem = {
  id: string;
  name: string;
  managerPlan: string | null;
  managerPlanStatus: string | null;
  studentCount: number;
  pendingTransferCents: number;
};

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [financial, setFinancial] = useState<FinancialSummary | null>(null);
  const [checkins, setCheckins] = useState<CheckinItem[]>([]);
  const [academies, setAcademies] = useState<AcademyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAdminToken()) {
      router.replace("/admin/login");
      return;
    }

    Promise.all([
      adminFetch<DashboardData>("/dashboard"),
      adminFetch<FinancialSummary>("/dashboard/financial-summary"),
      adminFetch<{ items: CheckinItem[] }>("/dashboard/checkins"),
      adminFetch<{ items: AcademyItem[] }>("/dashboard/academies"),
    ])
      .then(([d, f, c, a]) => {
        setDashboard(d);
        setFinancial(f);
        setCheckins(c.items);
        setAcademies(a.items);
        setLoading(false);
      })
      .catch(() => {
        // adminFetch redirects to login on 401/403
      });
  }, [router]);

  if (loading || !dashboard || !financial) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-text-muted">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7 p-8 px-10">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-sora)] text-[26px] font-bold tracking-tight text-text-primary">
          Dashboard
        </h1>
        <p className="text-sm text-text-secondary">
          Resumo geral da operação Tatame
        </p>
      </div>

      {/* KPI Cards */}
      <div className="flex gap-4">
        <KpiCard
          label="Assinantes"
          value={dashboard.activeSubscribers.toLocaleString("pt-BR")}
        />
        <KpiCard
          label="Usuários"
          value={dashboard.totalUsers.toLocaleString("pt-BR")}
        />
        <KpiCard
          label="Receita Repassada"
          value={formatBRL(dashboard.appRevenueCents)}
        />
        <KpiCard
          label="Total Movimentado"
          value={formatBRL(dashboard.transferredCents)}
        />
      </div>

      {/* Checkins Chart */}
      <CheckinsChart data={checkins} />

      {/* Financial Summary */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">
          Resumo Financeiro
        </h2>
        <div className="flex gap-4">
          <KpiCard
            label="Total Repassado"
            value={formatBRL(financial.transferredCents)}
            valueColor="text-success"
          />
          <KpiCard
            label="A Repassar"
            value={formatBRL(financial.pendingTransferCents)}
            valueColor="text-[#FFD60A]"
          />
        </div>
      </div>

      {/* Academies Table */}
      <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
        <div className="flex h-12 items-center bg-[#242424] px-5">
          <span className="flex-1 text-xs font-medium text-text-secondary">
            Academia
          </span>
          <span className="w-24 text-xs font-medium text-text-secondary">
            Status
          </span>
          <span className="w-28 text-xs font-medium text-text-secondary">
            Plano
          </span>
          <span className="w-20 text-xs font-medium text-text-secondary">
            Alunos
          </span>
          <span className="w-32 text-right text-xs font-medium text-text-secondary">
            Pendência
          </span>
        </div>
        {academies.map((academy) => (
          <Link
            key={academy.id}
            href={`/admin/academies/${academy.id}`}
            className="flex h-[52px] items-center border-t border-border px-5 hover:bg-white/[0.02]"
          >
            <span className="flex-1 text-sm font-medium text-text-primary">
              {academy.name}
            </span>
            <span className="w-24">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  academy.managerPlanStatus === "active"
                    ? "bg-success/20 text-success"
                    : "bg-[#FFD60A]/20 text-[#FFD60A]"
                }`}
              >
                {academy.managerPlanStatus === "active" ? "Ativo" : "Pendente"}
              </span>
            </span>
            <span className="w-28 text-sm capitalize text-text-secondary">
              {academy.managerPlan ?? "—"}
            </span>
            <span className="w-20 text-sm text-text-secondary">
              {academy.studentCount}
            </span>
            <span
              className={`w-32 text-right text-sm font-semibold ${
                academy.pendingTransferCents > 0
                  ? "text-[#FFD60A]"
                  : "text-text-muted"
              }`}
            >
              {academy.pendingTransferCents > 0
                ? formatBRL(academy.pendingTransferCents)
                : "—"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
