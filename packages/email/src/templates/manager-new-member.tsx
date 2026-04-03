import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type ManagerNewMemberProps = {
  managerName: string;
  memberName: string;
  academyName: string;
  role: "student" | "instructor";
};

const roleLabel: Record<string, string> = {
  student: "aluno",
  instructor: "instrutor",
};

export function ManagerNewMember({
  managerName,
  memberName,
  academyName,
  role,
}: ManagerNewMemberProps) {
  return (
    <Layout preview={`Novo ${roleLabel[role] ?? role} aprovado`}>
      <Heading>Novo membro aprovado</Heading>
      <Text style={text}>Olá, {managerName}!</Text>
      <Text style={text}>
        <strong>{memberName}</strong> foi aprovado como{" "}
        <strong>{roleLabel[role] ?? role}</strong> na academia{" "}
        <strong>{academyName}</strong>.
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
