import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type MemberApprovedProps = {
  memberName: string;
  academyName: string;
  role: "student" | "instructor";
};

const roleLabel: Record<string, string> = {
  student: "aluno",
  instructor: "instrutor",
};

export function MemberApproved({
  memberName,
  academyName,
  role,
}: MemberApprovedProps) {
  return (
    <Layout preview={`Aprovado na ${academyName}!`}>
      <Heading>Você foi aprovado!</Heading>
      <Text style={text}>Olá, {memberName}!</Text>
      <Text style={text}>
        Sua solicitação para entrar na academia{" "}
        <strong>{academyName}</strong> como{" "}
        <strong>{roleLabel[role] ?? role}</strong> foi aprovada.
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
