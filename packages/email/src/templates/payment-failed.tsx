import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type PaymentFailedProps = {
  managerName: string;
  academyName: string;
  amountCents: number;
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function PaymentFailed({
  managerName,
  academyName,
  amountCents,
}: PaymentFailedProps) {
  return (
    <Layout preview="Falha no pagamento da sua assinatura">
      <Heading>Falha no pagamento</Heading>
      <Text style={text}>Olá, {managerName}!</Text>
      <Text style={text}>
        Não foi possível processar o pagamento de{" "}
        <strong>{formatBRL(amountCents)}</strong> da academia{" "}
        <strong>{academyName}</strong>.
      </Text>
      <Text style={text}>
        Por favor, verifique seus dados de pagamento para evitar a suspensão do
        plano Pro.
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
