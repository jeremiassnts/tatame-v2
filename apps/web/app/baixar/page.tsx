import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { StoreButtons } from "@/components/store-buttons";
import { detectPlatform } from "@/lib/store-links";

export const metadata: Metadata = {
  title: "Baixe o app",
  description:
    "Baixe o Tatame e acompanhe suas aulas, presenças e graduações na sua academia.",
};

/**
 * Where "share the app" lands. Deliberately not `/`, which sells academy
 * management: a student who opens the manager's link should read about the app
 * they are being asked to install, not about a subscription they are not
 * buying.
 */
export default async function BaixarPage() {
  const requestHeaders = await headers();
  const highlight = detectPlatform(requestHeaders.get("user-agent"));

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <Image src="/icon.png" alt="Tatame" width={56} height={56} />
          <span className="font-[family-name:var(--font-sora)] text-[22px] font-extrabold tracking-[2px] text-white">
            TATAME
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-white">
            Baixe o app da sua academia
          </h1>
          <p className="text-sm text-text-secondary">
            Veja seus horários, confirme presença e acompanhe suas graduações e
            pagamentos direto do celular.
          </p>
        </div>

        <StoreButtons highlight={highlight} />

        <p className="text-xs text-text-muted">
          Disponível para iPhone e Android.
        </p>
      </div>
    </main>
  );
}
