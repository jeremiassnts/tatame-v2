import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type InvoicePaidProps = {
  managerName: string;
  academyName: string;
  amountCents: number;
  invoiceUrl?: string;
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function InvoicePaid({
  managerName,
  academyName,
  amountCents,
  invoiceUrl,
}: InvoicePaidProps) {
  return (
    <Layout preview={`Fatura paga — ${formatBRL(amountCents)}`}>
      <Heading>Fatura paga</Heading>
      <Text style={text}>Olá, {managerName}!</Text>
      <Text style={text}>
        A fatura da academia <strong>{academyName}</strong> no valor de{" "}
        <strong>{formatBRL(amountCents)}</strong> foi paga com sucesso.
      </Text>
      {invoiceUrl && (
        <Text style={text}>
          <a href={invoiceUrl} style={link}>
            Ver detalhes da fatura
          </a>
        </Text>
      )}
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};

const link = {
  color: "#2563eb",
  textDecoration: "underline",
};
