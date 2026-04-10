import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { ArrowLeft, User } from "lucide-react";
import { adminFetch } from "@/lib/api";
import { KpiCard } from "../../components/kpi-card";
import { PaymentsTable } from "../../components/payments-table";

type AcademyDetail = {
  academy: {
    id: string;
    name: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string | null;
    managerPlan: string | null;
    managerPlanStatus: string | null;
  };
  studentCount: number;
  revenueCentsCurrentMonth: number;
  transferredCents: number;
  pendingTransferCents: number;
};

type PaymentItem = {
  id: string;
  userName: string;
  amountCents: number;
  method: "manual" | "stripe" | "pix";
  referenceMonth: string;
  paidAt: string;
  transferredAt: string | null;
};

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

export default async function AcademyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ limit?: string; offset?: string }>;
}) {
  const { id } = await params;
  const { limit: limitStr, offset: offsetStr } = await searchParams;
  const limit = Number(limitStr) || 20;
  const offset = Number(offsetStr) || 0;

  const { getToken } = await auth();
  const token = (await getToken()) ?? "";

  const [detail, paymentsData] = await Promise.all([
    adminFetch<AcademyDetail>(`/academies/${id}`, token),
    adminFetch<{ items: PaymentItem[]; total: number }>(
      `/academies/${id}/payments?limit=${limit}&offset=${offset}`,
      token,
    ),
  ]);

  const { academy } = detail;

  return (
    <div className="flex flex-col gap-6 p-8 px-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface"
        >
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <div className="flex flex-col gap-0.5">
          <h1 className="font-[family-name:var(--font-sora)] text-[26px] font-bold tracking-tight text-text-primary">
            {academy.name}
          </h1>
          <p className="text-sm text-text-secondary">Resumo da academia</p>
        </div>
      </div>

      {/* Manager Info */}
      <div className="flex items-center gap-3.5 rounded-[14px] border border-border bg-surface px-5 py-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/[0.125]">
          <User className="h-[22px] w-[22px] text-primary" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-text-muted">Responsável</span>
          <span className="text-[15px] font-semibold text-text-primary">
            {academy.ownerName}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-text-muted">E-mail</span>
          <span className="text-sm text-text-secondary">{academy.ownerEmail}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-text-muted">Telefone</span>
          <span className="text-sm text-text-secondary">
            {academy.ownerPhone ?? "—"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-text-muted">Plano</span>
          <span className="rounded-md bg-primary/[0.125] px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
            {academy.managerPlan ?? "—"}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="flex gap-4">
        <KpiCard label="Alunos" value={detail.studentCount.toLocaleString("pt-BR")} />
        <KpiCard label="Receita no Mês" value={formatBRL(detail.revenueCentsCurrentMonth)} />
        <KpiCard
          label="Já Repassado"
          value={formatBRL(detail.transferredCents)}
          valueColor="text-success"
        />
        <KpiCard
          label="A Repassar"
          value={formatBRL(detail.pendingTransferCents)}
          valueColor="text-[#FFD60A]"
        />
      </div>

      {/* Payments Table */}
      <PaymentsTable
        payments={paymentsData.items}
        academyId={id}
        total={paymentsData.total}
        limit={limit}
        offset={offset}
      />
    </div>
  );
}
