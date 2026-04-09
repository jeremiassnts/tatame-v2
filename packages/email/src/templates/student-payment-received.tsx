import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type StudentPaymentReceivedProps = {
  managerName: string;
  academyName: string;
  studentName: string;
  amountCents: number;
  referenceMonth: string;
  hasPixKey: boolean;
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function StudentPaymentReceived({
  managerName,
  academyName,
  studentName,
  amountCents,
  referenceMonth,
  hasPixKey,
}: StudentPaymentReceivedProps) {
  return (
    <Layout preview={`Pagamento recebido — ${formatBRL(amountCents)}`}>
      <Heading>Pagamento recebido</Heading>
      <Text style={text}>Olá, {managerName}!</Text>
      <Text style={text}>
        O aluno <strong>{studentName}</strong> realizou o pagamento de{" "}
        <strong>{formatBRL(amountCents)}</strong> referente ao mês{" "}
        <strong>{referenceMonth}</strong> na academia{" "}
        <strong>{academyName}</strong>. Em breve o valor estará disponível na
        sua conta.
      </Text>
      {!hasPixKey && (
        <Text style={warningText}>
          Você ainda não tem chave de Pix cadastrada na plataforma. Entre no
          aplicativo e acesse a aba Financeiro para adicionar.
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

const warningText = {
  color: "#D97706",
  fontSize: "14px",
  lineHeight: "22px",
  backgroundColor: "#FEF3C7",
  padding: "12px 16px",
  borderRadius: "8px",
  marginTop: "8px",
};
