import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

type LayoutProps = {
  preview: string;
  children: ReactNode;
  baseUrl?: string;
};

export function Layout({ preview, children, baseUrl }: LayoutProps) {
  const base = baseUrl ?? process.env.API_PUBLIC_URL;
  const logoUrl = base ? `${base}/public/icon.png` : "https://apptatame.com.br/icon.png";
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src={logoUrl}
              width="120"
              height="40"
              alt="Tatame"
            />
          </Section>
          <Section style={content}>{children}</Section>
          <Section style={footer}>
            <Text style={footerText}>
              Tatame — Gestão de academias de artes marciais
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0",
  marginBottom: "64px",
  maxWidth: "600px",
};

const header = {
  padding: "20px 40px",
};

const content = {
  padding: "0 40px",
};

const footer = {
  padding: "20px 40px",
  borderTop: "1px solid #e6ebf1",
};

const footerText = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};
