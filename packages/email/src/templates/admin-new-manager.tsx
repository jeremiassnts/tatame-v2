import { Text, Hr } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type AdminNewManagerProps = {
  managerName: string;
  managerEmail: string;
  academyName: string;
};

export function AdminNewManager({
  managerName,
  managerEmail,
  academyName,
}: AdminNewManagerProps) {
  return (
    <Layout preview="Novo manager cadastrado">
      <Heading>Novo manager cadastrado</Heading>
      <Text style={text}>
        Um novo manager acabou de se cadastrar e assinar o plano Pro.
      </Text>

      <Hr style={divider} />

      <Text style={text}>
        <strong>Nome:</strong> {managerName}
      </Text>
      <Text style={text}>
        <strong>E-mail:</strong> {managerEmail}
      </Text>
      <Text style={text}>
        <strong>Academia:</strong> {academyName}
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};

const divider = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};
