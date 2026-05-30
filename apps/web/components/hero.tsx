import { ArrowRight, Sparkles } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";
import { HeroMockups } from "./hero-mockups";

export function Hero() {
  return (
    <section className="px-6 pb-[60px] pt-12 md:px-20 md:pb-[60px] md:pt-20">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-12">
        <AnimateOnScroll className="flex flex-col items-center gap-12">
          {/* Badge */}
          <div className="flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.125] px-5 py-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[13px] font-medium text-primary">
              Plataforma #1 para academias de Jiu-Jitsu
            </span>
          </div>

          {/* Headline */}
          <div className="flex max-w-[900px] flex-col items-center gap-6">
            <h1 className="max-w-[900px] text-center font-[family-name:var(--font-sora)] text-[40px] font-extrabold leading-[1.1] tracking-[-2px] text-white md:text-[64px]">
              Sua academia na palma da mão
            </h1>
            <p className="max-w-[700px] text-center text-base leading-relaxed text-text-secondary md:text-xl md:leading-relaxed">
              Gerencie turmas, controle presenças, acompanhe graduações e
              pagamentos — tudo em um só lugar. Simples para gestores,
              instrutores e alunos.
            </p>
          </div>

          {/* CTA */}
          <a
            href="#precos"
            className="flex items-center gap-2.5 rounded-xl bg-gradient-to-b from-primary to-primary-dark px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
          >
            Começar grátis
            <ArrowRight className="h-5 w-5" />
          </a>
        </AnimateOnScroll>

        <AnimateOnScroll className="flex w-full items-center justify-center">
          <HeroMockups />
        </AnimateOnScroll>
      </div>
    </section>
  );
}
