import { Heading as EmailHeading } from "@react-email/components";
import type { ReactNode } from "react";

type HeadingProps = {
  children: ReactNode;
};

export function Heading({ children }: HeadingProps) {
  return <EmailHeading style={headingStyle}>{children}</EmailHeading>;
}

const headingStyle = {
  color: "#1f2937",
  fontSize: "24px",
  fontWeight: "bold" as const,
  margin: "0 0 16px",
  padding: "0",
};
