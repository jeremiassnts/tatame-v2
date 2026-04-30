import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";
import { Button } from "./components/button.js";

export type TrialEndingProps = {
  managerName: string;
  academyName: string;
  trialEndsAt: string;
  portalUrl: string;
};

export function TrialEnding({
  managerName,
  academyName,
  trialEndsAt,
  portalUrl,
}: TrialEndingProps) {
  return (
    <Layout preview="Seu período de teste está acabando">
      <Heading>Seu teste grátis termina em breve</Heading>
      <Text style={text}>Olá, {managerName}!</Text>
      <Text style={text}>
        O período de teste grátis da academia <strong>{academyName}</strong>{" "}
        termina em <strong>7 dias</strong> (<strong>{trialEndsAt}</strong>).
        Após essa data, sua assinatura Pro será cobrada automaticamente.
      </Text>
      <Text style={text}>
        Se quiser continuar usando todos os recursos do Tatame Pro, não precisa
        fazer nada — a cobrança será feita no cartão cadastrado.
      </Text>
      <Text style={text}>
        Caso deseje cancelar antes da cobrança, acesse o portal de gerenciamento:
      </Text>
      <Button href={portalUrl}>Gerenciar assinatura</Button>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
