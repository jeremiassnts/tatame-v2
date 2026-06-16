import { Sparkles } from "lucide-react";
import { ButtonColorful } from "../ui/button-colorful";
import { HeroMockupsV2 } from "./hero-mockups-v2";

export function HeroV2() {
  return (
    <section className="relative overflow-hidden px-6 pb-[60px] pt-12 md:px-20 md:pb-[80px] md:pt-20">
      {/* Subtle radial gradient behind mockups */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_70%_50%,_#A078E815_0%,_transparent_60%)]" />

      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-10 md:flex-row md:items-center md:justify-between md:gap-8">
        {/* Left — text content */}
        <div className="flex max-w-[640px] flex-col items-center gap-5 md:items-start">
          {/* Badge */}
          <div className="flex items-center gap-2 rounded-full bg-primary/[0.125] px-4 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[2px] text-primary">
              Gestão de academias de Jiu-Jitsu
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-center font-sora text-[36px] font-extrabold leading-[1.1] tracking-[-2px] text-white md:text-left md:text-[52px]">
            Sua academia inteira na palma da sua mão
          </h1>

          {/* Subheadline */}
          <p className="text-center text-base leading-relaxed text-text-secondary md:text-left md:text-[17px] md:leading-relaxed">
            Agenda, check-in, graduações e financeiro em um único app feito para quem vive o Jiu-Jitsu. Simples para você, seus instrutores e seus alunos.
          </p>

          {/* CTA */}
          <ButtonColorful
            href="#precos"
            eventName="cta_hero_click"
            label="Começar meu teste grátis"
          />
        </div>

        {/* Right — app mockups */}
        <div className="flex w-full items-center justify-center md:w-auto">
          <HeroMockupsV2 />
        </div>
      </div>
    </section>
  );
}
