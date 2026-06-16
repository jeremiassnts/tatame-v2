import { ClerkProviderWrapper } from "@/components/clerk-provider-wrapper";

export default function SSOCallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClerkProviderWrapper>{children}</ClerkProviderWrapper>;
}
