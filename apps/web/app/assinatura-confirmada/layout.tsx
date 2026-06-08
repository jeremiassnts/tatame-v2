import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Assinatura Confirmada — Tatame",
  robots: { index: false, follow: false },
};

export default function AssinaturaConfirmadaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
