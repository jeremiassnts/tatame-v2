"use client";

import { useState, useTransition } from "react";
import { confirmTransfer } from "../actions";

type Payment = {
  id: string;
  userName: string;
  amountCents: number;
  method: "manual" | "stripe" | "pix";
  referenceMonth: string;
  paidAt: string;
  transferredAt: string | null;
};

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function originLabel(method: string): { label: string; color: string } {
  return method === "manual"
    ? { label: "Manager", color: "bg-[#FFD60A]/20 text-[#FFD60A]" }
    : { label: "App", color: "bg-primary/20 text-primary" };
}

export function PaymentsTable({
  payments,
  academyId,
  total,
  limit,
  offset,
}: {
  payments: Payment[];
  academyId: string;
  total: number;
  limit: number;
  offset: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const appPending = payments.filter(
    (p) => p.method !== "manual" && !p.transferredAt,
  );
  const selectableIds = new Set(appPending.map((p) => p.id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === selectableIds.size) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  }

  function handleBulkTransfer() {
    const ids = Array.from(selected);
    startTransition(async () => {
      await confirmTransfer(ids, academyId);
      setSelected(new Set());
    });
  }

  function handleSingleTransfer(id: string) {
    startTransition(async () => {
      await confirmTransfer([id], academyId);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  const selectedTotal = payments
    .filter((p) => selected.has(p.id))
    .reduce((sum, p) => sum + p.amountCents, 0);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Pagamentos</h2>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex h-12 items-center justify-between rounded-[10px] bg-primary/[0.125] px-4">
          <div className="flex items-center gap-2 text-sm text-primary">
            <span className="font-medium">{selected.size} selecionados</span>
            <span className="text-text-muted">&middot;</span>
            <span>Total: {formatBRL(selectedTotal)}</span>
          </div>
          <button
            onClick={handleBulkTransfer}
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {isPending ? "Processando..." : "Confirmar Repasse"}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
        {/* Header */}
        <div className="flex h-12 items-center bg-[#242424] px-4">
          <span className="w-10">
            {selectableIds.size > 0 && (
              <input
                type="checkbox"
                checked={selected.size === selectableIds.size && selectableIds.size > 0}
                onChange={toggleAll}
                className="accent-primary"
              />
            )}
          </span>
          <span className="flex-1 text-xs font-medium text-text-secondary">Aluno</span>
          <span className="w-24 text-xs font-medium text-text-secondary">Valor</span>
          <span className="w-20 text-xs font-medium text-text-secondary">Método</span>
          <span className="w-20 text-xs font-medium text-text-secondary">Origem</span>
          <span className="w-28 text-xs font-medium text-text-secondary">Repasse</span>
          <span className="w-24 text-xs font-medium text-text-secondary">Status</span>
          <span className="w-28 text-right text-xs font-medium text-text-secondary">Ação</span>
        </div>

        {/* Rows */}
        {payments.map((payment) => {
          const isApp = payment.method !== "manual";
          const isPendingTransfer = isApp && !payment.transferredAt;
          const origin = originLabel(payment.method);

          return (
            <div
              key={payment.id}
              className={`flex h-[52px] items-center border-t border-border px-4 ${
                selected.has(payment.id) ? "bg-primary/[0.06]" : ""
              }`}
            >
              <span className="w-10">
                {isPendingTransfer && (
                  <input
                    type="checkbox"
                    checked={selected.has(payment.id)}
                    onChange={() => toggleSelect(payment.id)}
                    className="accent-primary"
                  />
                )}
              </span>
              <span className="flex-1 text-sm text-text-primary">
                {payment.userName}
              </span>
              <span className="w-24 text-sm text-text-primary">
                {formatBRL(payment.amountCents)}
              </span>
              <span className="w-20">
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                  {payment.method}
                </span>
              </span>
              <span className="w-20">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${origin.color}`}>
                  {origin.label}
                </span>
              </span>
              <span className="w-28 text-sm">
                {payment.transferredAt ? (
                  <span className="text-success">
                    {formatDate(payment.transferredAt)}
                  </span>
                ) : isApp ? (
                  <span className="text-[#FFD60A]">Pendente</span>
                ) : (
                  <span className="text-text-muted">N/A</span>
                )}
              </span>
              <span className="w-24">
                <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-success">
                  Sucesso
                </span>
              </span>
              <span className="w-28 text-right">
                {isPendingTransfer && (
                  <button
                    onClick={() => handleSingleTransfer(payment.id)}
                    disabled={isPending}
                    className="rounded-lg bg-success px-3 py-1 text-xs font-medium text-white hover:bg-success/80 disabled:opacity-50"
                  >
                    Repassar
                  </button>
                )}
              </span>
            </div>
          );
        })}

        {/* Pagination */}
        <div className="flex h-[52px] items-center justify-between border-t border-border px-4">
          <span className="text-xs text-text-muted">
            Mostrando {Math.min(offset + 1, total)}-{Math.min(offset + limit, total)} de {total} pagamentos
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <a
                href={`?limit=${limit}&offset=${offset - limit}`}
                className="rounded-lg border border-border px-3 py-1 text-xs text-text-secondary hover:bg-white/5"
              >
                Anterior
              </a>
            )}
            {currentPage < totalPages && (
              <a
                href={`?limit=${limit}&offset=${offset + limit}`}
                className="rounded-lg border border-border px-3 py-1 text-xs text-text-secondary hover:bg-white/5"
              >
                Próximo
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
