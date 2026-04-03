import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type SubscriptionCanceledProps = {
  managerName: string;
  academyName: string;
  endsAt: string;
};

export function SubscriptionCanceled({
  managerName,
  academyName,
  endsAt,
}: SubscriptionCanceledProps) {
  return (
    <Layout preview="Assinatura cancelada">
      <Heading>Assinatura cancelada</Heading>
      <Text style={text}>Olá, {managerName}!</Text>
      <Text style={text}>
        A assinatura Pro da academia <strong>{academyName}</strong> foi
        cancelada. Seu acesso ao plano Pro permanece ativo até{" "}
        <strong>{endsAt}</strong>.
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
