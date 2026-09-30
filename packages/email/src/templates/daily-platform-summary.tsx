import { Column, Hr, Row, Section, Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type SummaryMoney = {
  grossCents: number;
  feeCents: number;
  netCents: number;
};

/** A day-scoped number next to the same number for the day before it. */
export type SummaryDelta = { value: number; previous: number };

export type SummaryMethodTotal = {
  method: "manual" | "card" | "pix";
  count: number;
  amountCents: number;
};

export type AcademySummary = {
  name: string;
  ownerName: string;
  managerPlan: "free" | "pro" | null;
  newStudents: SummaryDelta;
  activeStudents: number;
  overdueStudents: number;
  paymentsCount: number;
  received: SummaryMoney;
  receivedPreviousGrossCents: number;
  byMethod: SummaryMethodTotal[];
  unpaidPixCount: number;
  unpaidPixCents: number;
  subscriptionsCreated: number;
  subscriptionsExpiringIn7Days: number;
  subscriptionsCanceled: number;
  subscriptionsActive: number;
  checkins: SummaryDelta;
  topClasses: { name: string; count: number }[];
};

export type DailyPlatformSummaryProps = {
  /** Already formatted as `DD/MM/YYYY` — the template does no date math. */
  referenceDate: string;
  revenue: SummaryMoney;
  revenuePreviousGrossCents: number;
  newUsers: SummaryDelta;
  newAcademies: string[];
  managerSubscriptions: { pro: number; free: number; newProToday: number };
  totals: { users: number; academies: number; grossCents: number };
  academies: AcademySummary[];
};

const METHOD_LABEL: Record<SummaryMethodTotal["method"], string> = {
  pix: "Pix",
  card: "Cartão",
  manual: "Manual",
};

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/** `+3` / `−2` / `—`. Minus sign is U+2212, not a hyphen. */
function formatDelta(value: number, previous: number): string {
  const diff = value - previous;
  if (diff === 0) return "—";
  return diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`;
}

function formatMoneyDelta(cents: number, previousCents: number): string {
  const diff = cents - previousCents;
  if (diff === 0) return "—";
  const sign = diff > 0 ? "+" : "−";
  return `${sign}${formatBRL(Math.abs(diff))}`;
}

function deltaColor(value: number, previous: number): string {
  const diff = value - previous;
  if (diff === 0) return "#9ca3af";
  return diff > 0 ? "#059669" : "#dc2626";
}

function Stat({
  label,
  value,
  delta,
  deltaTone,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: string;
}) {
  return (
    <Row style={statRow}>
      <Column style={statLabel}>{label}</Column>
      <Column style={statValue}>
        {value}
        {delta ? (
          <span style={{ ...statDelta, color: deltaTone ?? "#9ca3af" }}>
            {" "}
            {delta}
          </span>
        ) : null}
      </Column>
    </Row>
  );
}

function AcademyBlock({ academy }: { academy: AcademySummary }) {
  const plan =
    academy.managerPlan === "pro"
      ? "Pro"
      : academy.managerPlan === "free"
        ? "Free"
        : "sem assinatura";

  return (
    <Section style={academyCard}>
      <Text style={academyName}>{academy.name}</Text>
      <Text style={academyMeta}>
        {academy.ownerName} · {plan}
      </Text>

      <Text style={groupTitle}>Alunos</Text>
      <Stat
        label="Novos alunos"
        value={String(academy.newStudents.value)}
        delta={formatDelta(
          academy.newStudents.value,
          academy.newStudents.previous,
        )}
        deltaTone={deltaColor(
          academy.newStudents.value,
          academy.newStudents.previous,
        )}
      />
      <Stat label="Alunos ativos" value={String(academy.activeStudents)} />
      <Stat
        label="Com mensalidade em atraso"
        value={String(academy.overdueStudents)}
      />

      <Text style={groupTitle}>Pagamentos do dia</Text>
      <Stat
        label={`Recebido (${academy.paymentsCount})`}
        value={formatBRL(academy.received.grossCents)}
        delta={formatMoneyDelta(
          academy.received.grossCents,
          academy.receivedPreviousGrossCents,
        )}
        deltaTone={deltaColor(
          academy.received.grossCents,
          academy.receivedPreviousGrossCents,
        )}
      />
      {academy.byMethod.map((m) => (
        <Stat
          key={m.method}
          label={`  ${METHOD_LABEL[m.method]} (${m.count})`}
          value={formatBRL(m.amountCents)}
        />
      ))}
      <Stat
        label="Pix gerados e não pagos"
        value={
          academy.unpaidPixCount === 0
            ? "0"
            : `${academy.unpaidPixCount} · ${formatBRL(academy.unpaidPixCents)}`
        }
      />

      <Text style={groupTitle}>Planos</Text>
      <Stat label="Novas matrículas" value={String(academy.subscriptionsCreated)} />
      <Stat
        label="Vencendo em 7 dias"
        value={String(academy.subscriptionsExpiringIn7Days)}
      />
      <Stat label="Canceladas" value={String(academy.subscriptionsCanceled)} />
      <Stat label="Ativas" value={String(academy.subscriptionsActive)} />

      <Text style={groupTitle}>Presença</Text>
      <Stat
        label="Check-ins"
        value={String(academy.checkins.value)}
        delta={formatDelta(academy.checkins.value, academy.checkins.previous)}
        deltaTone={deltaColor(
          academy.checkins.value,
          academy.checkins.previous,
        )}
      />
      {academy.topClasses.length > 0 ? (
        academy.topClasses.map((c) => (
          <Stat key={c.name} label={`  ${c.name}`} value={String(c.count)} />
        ))
      ) : (
        <Text style={emptyText}>Nenhum check-in no dia.</Text>
      )}
    </Section>
  );
}

export function DailyPlatformSummary({
  referenceDate,
  revenue,
  revenuePreviousGrossCents,
  newUsers,
  newAcademies,
  managerSubscriptions,
  totals,
  academies,
}: DailyPlatformSummaryProps) {
  return (
    <Layout preview={`Resumo do dia ${referenceDate}`}>
      <Heading>Resumo diário — {referenceDate}</Heading>

      <Section style={platformCard}>
        <Text style={groupTitle}>Movimentação do dia</Text>
        <Stat
          label="Bruto recebido"
          value={formatBRL(revenue.grossCents)}
          delta={formatMoneyDelta(revenue.grossCents, revenuePreviousGrossCents)}
          deltaTone={deltaColor(revenue.grossCents, revenuePreviousGrossCents)}
        />
        <Stat
          label="Taxa do processador"
          value={`− ${formatBRL(revenue.feeCents)}`}
        />
        <Stat label="Líquido dos managers" value={formatBRL(revenue.netCents)} />

        <Text style={groupTitle}>Receita Tatame</Text>
        <Stat
          label="Assinaturas Pro ativas"
          value={String(managerSubscriptions.pro)}
          delta={
            managerSubscriptions.newProToday > 0
              ? `+${managerSubscriptions.newProToday} hoje`
              : undefined
          }
          deltaTone="#059669"
        />
        <Stat label="Contas Free" value={String(managerSubscriptions.free)} />

        <Text style={groupTitle}>Plataforma</Text>
        <Stat
          label="Novos usuários"
          value={String(newUsers.value)}
          delta={formatDelta(newUsers.value, newUsers.previous)}
          deltaTone={deltaColor(newUsers.value, newUsers.previous)}
        />
        <Stat
          label="Novas academias"
          value={
            newAcademies.length === 0 ? "0" : newAcademies.join(", ")
          }
        />
        <Stat label="Total de usuários" value={String(totals.users)} />
        <Stat label="Total de academias" value={String(totals.academies)} />
        <Stat
          label="Volume total processado"
          value={formatBRL(totals.grossCents)}
        />
      </Section>

      <Hr style={divider} />

      {academies.length === 0 ? (
        <Text style={emptyText}>Nenhuma academia cadastrada.</Text>
      ) : (
        academies.map((academy) => (
          <AcademyBlock key={academy.name} academy={academy} />
        ))
      )}
    </Layout>
  );
}

const platformCard = {
  backgroundColor: "#f9fafb",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "8px",
};

const academyCard = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: "16px",
  marginBottom: "8px",
};

const academyName = {
  color: "#111827",
  fontSize: "17px",
  fontWeight: 600,
  margin: "0",
};

const academyMeta = {
  color: "#6b7280",
  fontSize: "13px",
  margin: "2px 0 0",
};

const groupTitle = {
  color: "#6b7280",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  margin: "16px 0 6px",
};

const statRow = {
  marginBottom: "2px",
};

const statLabel = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "22px",
  whiteSpace: "pre-wrap" as const,
};

const statValue = {
  color: "#111827",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: "22px",
  textAlign: "right" as const,
};

const statDelta = {
  fontSize: "12px",
  fontWeight: 500,
};

const emptyText = {
  color: "#9ca3af",
  fontSize: "13px",
  fontStyle: "italic" as const,
  margin: "6px 0",
};

const divider = {
  borderColor: "#e5e7eb",
  margin: "20px 0 4px",
};
