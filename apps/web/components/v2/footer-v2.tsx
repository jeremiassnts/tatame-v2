import Image from "next/image";
import Link from "next/link";

export function FooterV2() {
  return (
    <footer className="bg-surface px-6 py-10 md:px-20 md:py-[60px]">
      <div className="mx-auto max-w-[1440px]">
        {/* Top */}
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          {/* Brand */}
          <div className="flex max-w-[320px] flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <Image src="/icon.png" alt="Tatame" width={20} height={20} />
              <span className="font-sora text-lg font-bold text-white">
                TATAME
              </span>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary">
              Gestão simples para academias de Jiu-Jitsu.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-20">
            <nav aria-label="Produto" className="flex flex-col gap-4">
              <h3 className="text-[13px] font-bold text-white">Produto</h3>
              <Link href="/" className="text-[13px] text-text-secondary hover:text-white">
                Início
              </Link>
              <a href="#recursos" className="text-[13px] text-text-secondary hover:text-white">
                Recursos
              </a>
              <a href="#como-funciona" className="text-[13px] text-text-secondary hover:text-white">
                Como funciona
              </a>
              <a href="#precos" className="text-[13px] text-text-secondary hover:text-white">
                Preços
              </a>
              <a href="#duvidas" className="text-[13px] text-text-secondary hover:text-white">
                Dúvidas
              </a>
            </nav>
            <nav aria-label="Legal" className="flex flex-col gap-4">
              <h3 className="text-[13px] font-bold text-white">Legal</h3>
              <a href="/privacidade" className="text-[13px] text-text-secondary hover:text-white">
                Privacidade
              </a>
              <a href="/termos" className="text-[13px] text-text-secondary hover:text-white">
                Termos de uso
              </a>
            </nav>
          </div>
        </div>

        {/* Divider */}
        <div className="my-12 h-px w-full bg-border" />

        {/* Bottom */}
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-xs text-text-muted">
            &copy; 2026 Tatame. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
