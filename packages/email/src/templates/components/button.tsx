import { Button as EmailButton } from "@react-email/components";

type ButtonProps = {
  href: string;
  children: string;
};

export function Button({ href, children }: ButtonProps) {
  return (
    <EmailButton style={buttonStyle} href={href}>
      {children}
    </EmailButton>
  );
}

const buttonStyle = {
  backgroundColor: "#000000",
  borderRadius: "5px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 20px",
};
