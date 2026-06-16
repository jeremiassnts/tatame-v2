import { ClerkProviderWrapper } from "@/components/clerk-provider-wrapper";

export default function ContaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClerkProviderWrapper>{children}</ClerkProviderWrapper>;
}
