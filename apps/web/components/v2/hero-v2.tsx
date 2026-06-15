import { ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";
import { TrackedLink } from "../tracked-link";

export function HeroV2() {
  return (
    <section className="relative overflow-hidden px-6 pb-[60px] pt-12 md:px-20 md:pb-[80px] md:pt-20">
      {/* Subtle radial gradient behind phone */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_70%_50%,_#A078E815_0%,_transparent_60%)]" />

      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-12 md:flex-row md:items-center md:justify-between md:gap-8">
        {/* Left — text content */}
        <div className="flex max-w-[560px] flex-col items-center gap-8 md:items-start">
          {/* Badge */}
          <div className="flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.125] px-5 py-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[13px] font-medium text-primary">
              Gestão de academias de Jiu-Jitsu
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-center font-[family-name:var(--font-sora)] text-[36px] font-extrabold leading-[1.1] tracking-[-2px] text-white md:text-left md:text-[52px]">
            Sua academia inteira na palma da sua mão
          </h1>

          {/* Subheadline */}
          <p className="text-center text-base leading-relaxed text-text-secondary md:text-left md:text-[17px] md:leading-relaxed">
            Agenda, check-in, graduações e financeiro em um único app feito para quem vive o Jiu-Jitsu. Simples para você, seus instrutores e seus alunos.
          </p>

          {/* CTA */}
          <TrackedLink
            href="#precos"
            eventName="cta_hero_click"
            className="flex items-center gap-2.5 rounded-xl bg-gradient-to-b from-primary to-primary-dark px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
          >
            Começar meu teste grátis
            <ArrowRight className="h-5 w-5" />
          </TrackedLink>
        </div>

        {/* Right — phone mockup */}
        <div className="relative flex w-full max-w-[480px] items-center justify-center md:w-auto">
          <Image
            src="/hero-mockup-v2.png"
            alt="App Tatame - Gestão de academia de Jiu-Jitsu"
            width={480}
            height={580}
            className="h-auto w-full max-w-[400px] object-contain md:max-w-[480px]"
            priority
          />
        </div>
      </div>
    </section>
  );
}
