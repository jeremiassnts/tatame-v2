"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { managerFetch } from "@/lib/manager-api";

type Subscription = {
  id: string;
  plan: "free" | "pro" | string;
  status: "active" | "trialing" | "past_due" | "canceled" | string;
  currentPeriodEnd: string | null;
  subscribedAt: string;
  createdAt: string;
  canceledAt: string | null;
};

/**
 * The card used to hardcode "Pro" and "R$49". An account on the retired free
 * plan therefore read as a paying Pro subscriber, which is exactly how a
 * declined card looked like an active subscription.
 */
const PLAN_LABELS: Record<string, { name: string; price: string | null }> = {
  pro: { name: "Pro", price: "R$49" },
  free: { name: "Gratuito", price: null },
};

type BillingPortalResponse = { url: string };
type CancelResponse = { canceled: boolean };
type ReactivateResponse = { reactivated: boolean };

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: {
      label: "Ativo",
      className: "bg-success/20 text-success",
    },
    trialing: {
      label: "Período de teste",
      className: "bg-blue-500/20 text-blue-400",
    },
    past_due: {
      label: "Pagamento pendente",
      className: "bg-[#FFD60A]/20 text-[#FFD60A]",
    },
    canceled: {
      label: "Cancelado",
      className: "bg-red-500/20 text-red-400",
    },
    incomplete: {
      label: "Pagamento não confirmado",
      className: "bg-red-500/20 text-red-400",
    },
  };

  const config = map[status] ?? {
    label: status,
    className: "bg-border text-text-secondary",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

/**
 * Returns "—" for a missing or unparseable date. Without this a null
 * `currentPeriodEnd` rendered as "31 de dezembro de 1969" — `new Date(null)`
 * is the epoch, not an error.
 */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h3 className="text-base font-semibold text-text-primary">
          Tem certeza?
        </h3>
        <p className="mt-2 text-sm text-text-secondary">
          Sua assinatura será cancelada ao fim do período atual. Você pode
          reativar a qualquer momento.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-border-light hover:text-text-primary disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Cancelando..." : "Cancelar assinatura"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AssinaturaPage() {
  const { getToken } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const data = await managerFetch<Subscription>(
        "/manager-subscriptions/me",
        token,
      );
      setSubscription(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar assinatura.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBillingPortal() {
    setPortalLoading(true);
    setActionError(null);
    try {
      const token = await getToken();
      const { url } = await managerFetch<BillingPortalResponse>(
        "/manager-subscriptions/billing-portal",
        token,
        {
          method: "POST",
          body: JSON.stringify({ returnUrl: window.location.href }),
        },
      );
      window.location.href = url;
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erro ao abrir portal.",
      );
      setPortalLoading(false);
    }
  }

  async function handleCancel() {
    setCancelLoading(true);
    setActionError(null);
    try {
      const token = await getToken();
      await managerFetch<CancelResponse>(
        "/manager-subscriptions/cancel",
        token,
        { method: "POST" },
      );
      setConfirmOpen(false);
      await load();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erro ao cancelar assinatura.",
      );
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleReactivate() {
    setReactivateLoading(true);
    setActionError(null);
    try {
      const token = await getToken();
      await managerFetch<ReactivateResponse>(
        "/manager-subscriptions/reactivate",
        token,
        { method: "POST" },
      );
      await load();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Erro ao reativar assinatura.",
      );
    } finally {
      setReactivateLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-text-muted">Carregando...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:border-border-light hover:text-text-primary"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const isCanceled = Boolean(subscription?.canceledAt);
  const planInfo = PLAN_LABELS[subscription?.plan ?? ""] ?? {
    name: subscription?.plan ?? "—",
    price: null,
  };

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleCancel}
        loading={cancelLoading}
      />

      <div className="flex flex-col gap-7 p-6 md:p-10">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="font-[family-name:var(--font-sora)] text-[26px] font-bold tracking-tight text-text-primary">
            Assinatura
          </h1>
          <p className="text-sm text-text-secondary">
            Gerencie seu plano e método de pagamento
          </p>
        </div>

        {/* Plan card */}
        {subscription && (
          <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6">
            {/* Plan name + badge */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="font-[family-name:var(--font-sora)] text-xl font-bold text-text-primary">
                  {planInfo.name}
                </span>
                <StatusBadge status={subscription.status} />
              </div>
              {planInfo.price && (
                <span className="text-lg font-semibold text-text-primary">
                  {planInfo.price}
                  <span className="text-sm font-normal text-text-secondary">
                    /mês
                  </span>
                </span>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* Details */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                  Próxima cobrança
                </span>
                <span className="text-sm font-medium text-text-primary">
                  {isCanceled
                    ? "—"
                    : formatDate(subscription.currentPeriodEnd)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                  Assinante desde
                </span>
                <span className="text-sm font-medium text-text-primary">
                  {formatDate(subscription.subscribedAt ?? subscription.createdAt)}
                </span>
              </div>
              {isCanceled && subscription.canceledAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">
                    Cancelado em
                  </span>
                  <span className="text-sm font-medium text-red-400">
                    {formatDate(subscription.canceledAt)}
                  </span>
                </div>
              )}
            </div>

            {/* Billing portal button */}
            <button
              type="button"
              onClick={handleBillingPortal}
              disabled={portalLoading}
              className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-background text-sm font-medium text-text-primary transition-colors hover:border-border-light hover:bg-white/[0.03] disabled:opacity-50"
            >
              {portalLoading ? "Redirecionando..." : "Dados de pagamento"}
            </button>
          </div>
        )}

        {/* Action error */}
        {actionError && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {actionError}
          </p>
        )}

        {/* Cancel / Reactivate */}
        {subscription && (
          <div className="flex flex-col gap-2">
            {isCanceled ? (
              <button
                type="button"
                onClick={handleReactivate}
                disabled={reactivateLoading}
                className="flex h-11 w-full items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
              >
                {reactivateLoading ? "Reativando..." : "Reativar assinatura"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="flex h-11 w-full items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/15"
              >
                Cancelar assinatura
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
