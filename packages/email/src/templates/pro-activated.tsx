import { Text, Link, Hr } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";
import { Button } from "./components/button.js";

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
        Seu plano Tatame Pro está ativo com <strong>30 dias grátis</strong>.
        Agora você tem acesso a todos os recursos sem limitações.
      </Text>

      <Hr style={divider} />

      <Text style={subtitle}>Próximos passos</Text>

      <Text style={text}>
        <strong>1.</strong> Baixe o app na{" "}
        <Link href="https://ios.apptatame.com.br" style={link}>App Store</Link>{" "}
        ou{" "}
        <Link href="https://android.apptatame.com.br" style={link}>Google Play</Link>
      </Text>
      <Text style={text}>
        <strong>2.</strong> Faça login com a mesma conta que você acabou de criar
      </Text>
      <Text style={text}>
        <strong>3.</strong> Cadastre sua academia e comece a usar
      </Text>
      <Text style={text}>
        <strong>4.</strong> Acesse os <strong>Tutoriais</strong> no menu Mais do
        app para aprender a usar todas as funcionalidades
      </Text>

      <Hr style={divider} />

      <Text style={{ ...text, textAlign: "center" as const }}>
        <Link href="https://ios.apptatame.com.br" style={storeLink}>
          App Store
        </Link>
        {"  •  "}
        <Link href="https://android.apptatame.com.br" style={storeLink}>
          Google Play
        </Link>
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};

const subtitle = {
  color: "#111827",
  fontSize: "18px",
  fontWeight: "bold" as const,
  lineHeight: "28px",
};

const divider = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const link = {
  color: "#7c3aed",
  textDecoration: "underline",
};

const storeLink = {
  color: "#7c3aed",
  textDecoration: "none",
  fontWeight: "bold" as const,
  fontSize: "16px",
};
