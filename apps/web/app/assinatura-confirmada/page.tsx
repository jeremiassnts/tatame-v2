import Image from "next/image";
import { StoreButtons } from "@/components/store-buttons";

export default function AssinaturaConfirmadaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-lg flex-col items-center gap-8 rounded-[20px] border border-border bg-surface p-8 md:p-10">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Image src="/icon.png" alt="Tatame" width={45} height={45} />
          <h1 className="font-[family-name:var(--font-sora)] text-[22px] font-extrabold tracking-[2px] text-white">
            TATAME
          </h1>
        </div>

        {/* Green checkmark */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/15 ring-2 ring-success/30">
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M8 21L16 29L32 12"
              stroke="#32D74B"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Heading + subtitle */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-white">
            Assinatura confirmada!
          </h2>
          <p className="text-sm text-text-secondary">
            Parabéns! Seu plano Tatame Pro está ativo com 30 dias grátis.
          </p>
        </div>

        {/* Email callout */}
        <div className="flex w-full items-start gap-3 rounded-xl border border-border-light bg-background px-4 py-3.5">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mt-0.5 shrink-0 text-text-secondary"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="4"
              width="16"
              height="12"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M2 7l8 5 8-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-white">Confira seu e-mail</span>{" "}
            — enviamos um recibo e as instruções de acesso para você.
          </p>
        </div>

        {/* App download section */}
        <div className="flex w-full flex-col items-center gap-4">
          <p className="text-sm font-medium text-white">
            Baixe o app e cadastre sua academia
          </p>
          <StoreButtons surface="background" />
        </div>

        {/* Next steps */}
        <div className="flex w-full flex-col gap-3">
          <p className="text-sm font-medium text-white">Proximos passos</p>
          <ol className="flex flex-col gap-3">
            {[
              "Baixe o app na App Store ou Google Play",
              "Faça login com a conta que você acabou de criar",
              "Cadastre sua academia e comece a usar",
              "Acesse os Tutoriais no menu Mais para aprender a usar todas as funcionalidades",
            ].map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <span className="text-sm text-text-secondary">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
