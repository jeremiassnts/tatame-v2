"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { confirmTransfer } from "../actions";

type Payment = {
  id: string;
  userName: string;
  amountCents: number;
  method: "manual" | "card" | "pix";
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

function getOrigin(method: string): "app" | "manager" {
  return method === "manual" ? "manager" : "app";
}

function getTransferStatus(p: Payment): "pendente" | "repassado" | "n/a" {
  if (p.method === "manual") return "n/a";
  return p.transferredAt ? "repassado" : "pendente";
}

type SortField = "userName" | "amountCents";
type SortDir = "asc" | "desc";

const filterBtnBase =
  "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors";
const filterBtnActive = "border-primary bg-primary/20 text-primary";
const filterBtnInactive = "border-border text-text-muted hover:border-border-light hover:text-text-secondary";

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium text-text-muted">{label}</span>
      <button
        onClick={() => onChange("")}
        className={`${filterBtnBase} ${value === "" ? filterBtnActive : filterBtnInactive}`}
      >
        Todos
      </button>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(value === opt.value ? "" : opt.value)}
          className={`${filterBtnBase} ${value === opt.value ? filterBtnActive : filterBtnInactive}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="ml-1 inline h-3 w-3 text-text-muted" />;
  return sortDir === "asc"
    ? <ChevronUp className="ml-1 inline h-3 w-3 text-primary" />
    : <ChevronDown className="ml-1 inline h-3 w-3 text-primary" />;
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
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Filters
  const [filterMethod, setFilterMethod] = useState("");
  const [filterOrigin, setFilterOrigin] = useState("");
  const [filterTransfer, setFilterTransfer] = useState("");

  // Sort
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    let result = payments;

    if (filterMethod) {
      result = result.filter((p) => p.method === filterMethod);
    }
    if (filterOrigin) {
      result = result.filter((p) => getOrigin(p.method) === filterOrigin);
    }
    if (filterTransfer) {
      result = result.filter((p) => getTransferStatus(p) === filterTransfer);
    }

    if (sortField) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        if (sortField === "userName") {
          cmp = a.userName.localeCompare(b.userName, "pt-BR");
        } else if (sortField === "amountCents") {
          cmp = a.amountCents - b.amountCents;
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [payments, filterMethod, filterOrigin, filterTransfer, sortField, sortDir]);

  const appPending = filtered.filter(
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
      await confirmTransfer(ids);
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleSingleTransfer(id: string) {
    startTransition(async () => {
      await confirmTransfer([id]);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    });
  }

  const selectedTotal = payments
    .filter((p) => selected.has(p.id))
    .reduce((sum, p) => sum + p.amountCents, 0);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const hasActiveFilters = filterMethod || filterOrigin || filterTransfer;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Pagamentos</h2>
        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilterMethod("");
              setFilterOrigin("");
              setFilterTransfer("");
            }}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <FilterGroup
          label="Método"
          options={[
            { value: "pix", label: "Pix" },
            // The stored value is still `stripe`, but it has always meant
            // "card, in the app" rather than which provider — and since
            // TAT-104 the card rail is Asaas.
            { value: "card", label: "Cartão" },
            { value: "manual", label: "Manual" },
          ]}
          value={filterMethod}
          onChange={setFilterMethod}
        />
        <FilterGroup
          label="Origem"
          options={[
            { value: "app", label: "App" },
            { value: "manager", label: "Manager" },
          ]}
          value={filterOrigin}
          onChange={setFilterOrigin}
        />
        <FilterGroup
          label="Repasse"
          options={[
            { value: "pendente", label: "Pendente" },
            { value: "repassado", label: "Repassado" },
            { value: "n/a", label: "N/A" },
          ]}
          value={filterTransfer}
          onChange={setFilterTransfer}
        />
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
          <button
            onClick={() => toggleSort("userName")}
            className="flex flex-1 items-center text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            Aluno
            <SortIcon field="userName" sortField={sortField} sortDir={sortDir} />
          </button>
          <button
            onClick={() => toggleSort("amountCents")}
            className="flex w-24 items-center text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            Valor
            <SortIcon field="amountCents" sortField={sortField} sortDir={sortDir} />
          </button>
          <span className="w-20 text-xs font-medium text-text-secondary">Método</span>
          <span className="w-20 text-xs font-medium text-text-secondary">Origem</span>
          <span className="w-28 text-xs font-medium text-text-secondary">Repasse</span>
          <span className="w-24 text-xs font-medium text-text-secondary">Status</span>
          <span className="w-28 text-right text-xs font-medium text-text-secondary">Ação</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 && (
          <div className="flex h-[52px] items-center justify-center border-t border-border text-sm text-text-muted">
            Nenhum pagamento encontrado
          </div>
        )}
        {filtered.map((payment) => {
          const isApp = payment.method !== "manual";
          const isPendingTransfer = isApp && !payment.transferredAt;
          const origin = originLabel(payment.method);

          return (
            <div
              key={payment.id}
              className={`flex h-[52px] items-center border-t border-border px-4 ${selected.has(payment.id) ? "bg-primary/[0.06]" : ""
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
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary capitalize">
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
            {hasActiveFilters
              ? `${filtered.length} de ${payments.length} pagamentos (filtrado)`
              : `Mostrando ${Math.min(offset + 1, total)}-${Math.min(offset + limit, total)} de ${total} pagamentos`}
          </span>
          {!hasActiveFilters && (
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
          )}
        </div>
      </div>
    </div>
  );
}
