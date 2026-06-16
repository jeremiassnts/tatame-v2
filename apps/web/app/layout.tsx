import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
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
    default: "Gestão para Academias de Jiu-Jitsu — Tatame",
    template: "%s — Tatame",
  },
  description:
    "Controle turmas, presenças, graduações e pagamentos da sua academia de Jiu-Jitsu em um único app. Teste grátis por 30 dias.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteUrl,
    siteName: "Tatame",
    title: "Gestão para Academias de Jiu-Jitsu — Tatame",
    description:
      "O app que simplifica a gestão da sua academia de Jiu-Jitsu. Turmas, presenças, graduações e pagamentos em um só lugar. Teste grátis!",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Gestão para Academias de Jiu-Jitsu — Tatame",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gestão para Academias de Jiu-Jitsu — Tatame",
    description:
      "O app que simplifica a gestão da sua academia de Jiu-Jitsu. Turmas, presenças, graduações e pagamentos em um só lugar. Teste grátis!",
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
    <html lang="pt-BR" className={`${sora.variable} ${inter.variable}`}>
      <body className="font-[family-name:var(--font-inter)] antialiased">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
