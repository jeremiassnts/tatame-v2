import Image from "next/image";
import Link from "next/link";

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
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="https://ios.apptatame.com.br"
              className="flex h-[52px] items-center gap-3 rounded-xl border border-border bg-background px-5 transition-colors hover:border-border-light hover:bg-surface"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M14.05 2.9199C14.6696 2.1677 15.0942 1.1246 14.9738.0815c-.8938.0365-1.9889.5975-2.632 1.3497-.5762.668-1.0849 1.7392-.9482 2.7608.9956.076 2.0103-.5044 2.6564-1.2721zM16.267 11.5537c-.0215-2.2489 1.8375-3.3291 1.9215-3.3809-1.0468-1.5299-2.6742-1.7392-3.2553-1.7625-1.3858-.1411-2.7091.8177-3.4113.8177-.7022 0-1.7816-.7989-2.9319-.7773-1.5048.0215-2.8956.8713-3.673 2.2117C3.3824 11.302 4.4775 15.5082 6.0402 17.9008c.7666 1.1718 1.6808 2.4907 2.8819 2.4452 1.1579-.0455 1.5947-.7451 2.9968-.7451 1.4021 0 1.7944.7451 3.0183.7219 1.2454-.0216 2.031-1.1936 2.7892-2.3718.8882-1.3546 1.2501-2.678 1.267-2.7452-.0271-.0108-2.4198-.9275-2.6458-3.6521z"
                  fill="white"
                />
              </svg>
              <div className="flex flex-col">
                <span className="text-[10px] text-text-secondary">
                  Baixar na
                </span>
                <span className="text-sm font-semibold text-white">
                  App Store
                </span>
              </div>
            </Link>
            <Link
              href="https://android.apptatame.com.br"
              className="flex h-[52px] items-center gap-3 rounded-xl border border-border bg-background px-5 transition-colors hover:border-border-light hover:bg-surface"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M2.114 1.114a1 1 0 011.372-.006l10.5 9.5a1 1 0 010 1.484l-10.5 9.5A1 1 0 012 20.5V1.5a1 1 0 01.114-.386z"
                  fill="#EA4335"
                />
                <path
                  d="M13.986 10.608L3.486 20.108 16.5 13.5l-2.514-2.892z"
                  fill="#FBBC05"
                />
                <path
                  d="M16.5 6.5L3.486.892l10.5 9.5L16.5 7.5v-1z"
                  fill="#4285F4"
                />
                <path
                  d="M16.5 6.5v7l-2.514-2.892-1.5-1.3 1.5-1.308L16.5 6.5z"
                  fill="#34A853"
                />
              </svg>
              <div className="flex flex-col">
                <span className="text-[10px] text-text-secondary">
                  Disponível no
                </span>
                <span className="text-sm font-semibold text-white">
                  Google Play
                </span>
              </div>
            </Link>
          </div>
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
