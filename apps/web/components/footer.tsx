import { Grid3X3, Instagram, Twitter, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-surface px-6 py-10 md:px-20 md:py-[60px]">
      <div className="mx-auto max-w-[1440px]">
        {/* Top */}
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          {/* Brand */}
          <div className="flex max-w-[320px] flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-b from-primary to-primary-dark">
                <Grid3X3 className="h-4 w-4 text-white" />
              </div>
              <span className="font-[family-name:var(--font-sora)] text-lg font-bold text-white">
                TATAME
              </span>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary">
              A plataforma completa para gestão de academias de Jiu-Jitsu
              brasileiro.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-20">
            <div className="flex flex-col gap-4">
              <span className="text-[13px] font-bold text-white">Produto</span>
              <a
                href="/"
                className="text-[13px] text-text-secondary hover:text-white"
              >
                Início
              </a>
              <a
                href="#recursos"
                className="text-[13px] text-text-secondary hover:text-white"
              >
                Recursos
              </a>
              <a
                href="#precos"
                className="text-[13px] text-text-secondary hover:text-white"
              >
                Preços
              </a>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-[13px] font-bold text-white">Legal</span>
              <a
                href="/privacidade"
                className="text-[13px] text-text-secondary hover:text-white"
              >
                Privacidade
              </a>
              <a
                href="/termos"
                className="text-[13px] text-text-secondary hover:text-white"
              >
                Termos de uso
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-12 h-px w-full bg-border" />

        {/* Bottom */}
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-xs text-text-muted">
            © 2026 Tatame. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" aria-label="Instagram">
              <Instagram className="h-[18px] w-[18px] text-text-muted hover:text-white" />
            </a>
            <a href="#" aria-label="Twitter">
              <Twitter className="h-[18px] w-[18px] text-text-muted hover:text-white" />
            </a>
            <a href="#" aria-label="YouTube">
              <Youtube className="h-[18px] w-[18px] text-text-muted hover:text-white" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
