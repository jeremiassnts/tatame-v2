import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type ProActivatedProps = {
  managerName: string;
  academyName: string;
};

export function ProActivated({
  managerName,
  academyName,
}: ProActivatedProps) {
  return (
    <Layout preview="Plano Pro ativado!">
      <Heading>Bem-vindo ao plano Pro!</Heading>
      <Text style={text}>Olá, {managerName}!</Text>
      <Text style={text}>
        O plano Pro da academia <strong>{academyName}</strong> foi ativado com
        sucesso. Agora você tem acesso a todos os recursos sem limitações.
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
