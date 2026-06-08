import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { GoogleAnalytics } from "@/components/google-analytics";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const siteUrl = "https://apptatame.com.br";

export const metadata: Metadata = {
  title: {
    default: "Tatame — Gestão completa para academias de Jiu-Jitsu",
    template: "%s — Tatame",
  },
  description:
    "Gerencie turmas, controle presenças, acompanhe graduações e pagamentos da sua academia de Jiu-Jitsu. App para gestores, instrutores e alunos.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName: "Tatame",
    title: "Tatame — Gestão completa para academias de Jiu-Jitsu",
    description:
      "Gerencie turmas, controle presenças, acompanhe graduações e pagamentos da sua academia de Jiu-Jitsu. App para gestores, instrutores e alunos.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Tatame — Gestão completa para academias de Jiu-Jitsu",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tatame — Gestão completa para academias de Jiu-Jitsu",
    description:
      "Gerencie turmas, controle presenças, acompanhe graduações e pagamentos da sua academia de Jiu-Jitsu.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="pt-BR" className={`${sora.variable} ${inter.variable}`}>
        <body className="font-[family-name:var(--font-inter)] antialiased">
          <GoogleAnalytics />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
