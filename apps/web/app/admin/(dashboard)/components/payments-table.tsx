"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";

type Payment = {
  id: string;
  userName: string;
  amountCents: number;
  method: "manual" | "stripe" | "pix";
  referenceMonth: string;
  paidAt: string;
};

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function originLabel(method: string): { label: string; color: string } {
  return method === "manual"
    ? { label: "Manager", color: "bg-[#FFD60A]/20 text-[#FFD60A]" }
    : { label: "App", color: "bg-primary/20 text-primary" };
}

function getOrigin(method: string): "app" | "manager" {
  return method === "manual" ? "manager" : "app";
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
  total,
  limit,
  offset,
}: {
  payments: Payment[];
  total: number;
  limit: number;
  offset: number;
}) {
  // Filters
  const [filterMethod, setFilterMethod] = useState("");
  const [filterOrigin, setFilterOrigin] = useState("");

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
  }, [payments, filterMethod, filterOrigin, sortField, sortDir]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const hasActiveFilters = filterMethod || filterOrigin;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Pagamentos</h2>
        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilterMethod("");
              setFilterOrigin("");
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
            { value: "stripe", label: "Cartão" },
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
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
        {/* Header */}
        <div className="flex h-12 items-center bg-[#242424] px-4">
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
          <span className="w-24 text-right text-xs font-medium text-text-secondary">Status</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 && (
          <div className="flex h-[52px] items-center justify-center border-t border-border text-sm text-text-muted">
            Nenhum pagamento encontrado
          </div>
        )}
        {filtered.map((payment) => {
          const origin = originLabel(payment.method);

          return (
            <div
              key={payment.id}
              className="flex h-[52px] items-center border-t border-border px-4"
            >
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
              <span className="w-24 text-right">
                <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-success">
                  Sucesso
                </span>
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
