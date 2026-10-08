import Image from "next/image";
import { StoreButtons } from "@/components/store-buttons";

/**
 * A `400` or a `404` from the public academy endpoint lands here. It carries no
 * academy name on purpose — there is no academy to name — and it still offers
 * the app, because a mistyped invite is no reason to send the visitor away
 * empty-handed.
 */
export default function ConviteNaoEncontrado() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <Image src="/icon.png" alt="Tatame" width={56} height={56} />

        <div className="flex flex-col gap-3">
          <h1 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-white">
            Convite inválido
          </h1>
          <p className="text-sm text-text-secondary">
            Este link não aponta para nenhuma academia. Peça um link novo para
            quem te convidou — ou baixe o app e procure sua academia por nome.
          </p>
        </div>

        <StoreButtons />
      </div>
    </main>
  );
}
