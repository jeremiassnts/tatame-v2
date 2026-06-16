import { ClerkProviderWrapper } from "@/components/clerk-provider-wrapper";

export const metadata = {
  title: "Tatame — Admin",
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClerkProviderWrapper>{children}</ClerkProviderWrapper>;
}
