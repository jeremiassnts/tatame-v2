import type { Metadata } from "next";
import { ClerkProviderWrapper } from "@/components/clerk-provider-wrapper";

export const metadata: Metadata = {
  title: "Cadastro — Tatame",
  robots: { index: false, follow: false },
};

export default function CadastroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClerkProviderWrapper>{children}</ClerkProviderWrapper>;
}
