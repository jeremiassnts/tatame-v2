import { Text } from "@react-email/components";
import { Layout } from "./components/layout.js";
import { Heading } from "./components/heading.js";

export type PlanEnrolledProps = {
  studentName: string;
  planName: string;
  academyName: string;
  startsAt: string;
  expiresAt: string;
};

export function PlanEnrolled({
  studentName,
  planName,
  academyName,
  startsAt,
  expiresAt,
}: PlanEnrolledProps) {
  return (
    <Layout preview={`Inscrição realizada — ${planName}`}>
      <Heading>Inscrição realizada!</Heading>
      <Text style={text}>Olá, {studentName}!</Text>
      <Text style={text}>
        Você foi inscrito no plano <strong>{planName}</strong> da academia{" "}
        <strong>{academyName}</strong>.
      </Text>
      <Text style={text}>
        Período: <strong>{startsAt}</strong> até <strong>{expiresAt}</strong>
      </Text>
    </Layout>
  );
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
};
