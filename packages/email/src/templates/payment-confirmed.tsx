import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type PaymentConfirmedProps = {
  studentName: string;
  academyName: string;
  amountCents: number;
  referenceMonth: string;
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function PaymentConfirmed({
  studentName,
  academyName,
  amountCents,
  referenceMonth,
}: PaymentConfirmedProps) {
  return (
    <Layout preview={`Pagamento confirmado — ${formatBRL(amountCents)}`}>
      <Heading>Pagamento confirmado</Heading>
      <Text style={text}>Olá, {studentName}!</Text>
      <Text style={text}>
        Seu pagamento de <strong>{formatBRL(amountCents)}</strong> referente ao
        mês <strong>{referenceMonth}</strong> na academia{" "}
        <strong>{academyName}</strong> foi confirmado.
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
