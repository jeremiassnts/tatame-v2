import { ArrowRight } from "lucide-react";
import { TrackedLink } from "../tracked-link";

export function BannerCta() {
  return (
    <section className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col items-center gap-8 rounded-3xl bg-gradient-to-b from-[#1A1030] to-[#0C0C0C] px-6 py-16 md:px-20 md:py-24">
          <h2 className="max-w-[800px] text-center font-[family-name:var(--font-sora)] text-[32px] font-extrabold leading-[1.15] tracking-[-1.5px] text-white md:text-[48px]">
            Onde a organização vira resultado
          </h2>
          <p className="max-w-[560px] text-center text-base leading-relaxed text-text-secondary md:text-lg">
            Pare de perder tempo com planilhas e comece a focar no que importa: seus alunos no tatame.
          </p>
          <TrackedLink
            href="#precos"
            eventName="cta_banner_click"
            className="flex items-center gap-2.5 rounded-xl bg-gradient-to-b from-primary to-primary-dark px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
          >
            Começar meu teste grátis
            <ArrowRight className="h-5 w-5" />
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}
