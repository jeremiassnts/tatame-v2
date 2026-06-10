import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { AnimateOnScroll } from "./animate-on-scroll";
import { TrackedLink } from "./tracked-link";

export function FinalCta() {
  return (
    <section id="download" className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        <AnimateOnScroll>
          <div className="flex flex-col items-center gap-8 rounded-3xl border border-primary/20 bg-gradient-to-b from-[#1A1030] to-[#2D1B4E] px-6 py-12 md:p-20">
            <h2 className="max-w-[700px] text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold leading-[1.2] tracking-[-1.5px] text-white md:text-[40px]">
              Sua academia merece sair da planilha
            </h2>
            <p className="max-w-[600px] text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              Teste o Tatame por 30 dias, sem pagar nada e sem cartão de
              crédito. Cancele quando quiser.
            </p>
            {/* Store icons */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10">
                <Image src="/apple.svg" alt="iOS" width={20} height={20} className="brightness-0 invert" />
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10">
                <Image src="/google.svg" alt="Android" width={20} height={20} className="brightness-0 invert" />
              </div>
            </div>

            {/* CTA */}
            <TrackedLink
              href="#precos"
              eventName="cta_final_click"
              className="flex items-center gap-2.5 rounded-xl bg-gradient-to-b from-primary to-primary-dark px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              Criar minha academia grátis
              <ArrowRight className="h-5 w-5" />
            </TrackedLink>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
