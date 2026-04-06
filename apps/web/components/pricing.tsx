import { Check } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";

const freePlan = {
  name: "Gratuito",
  description: "Para academias começando no digital",
  price: "R$ 0",
  features: [
    "Até 30 alunos",
    "Agenda de aulas",
    "Check-in de alunos",
    "Controle de graduações",
  ],
  ctaLabel: "Começar grátis",
  highlighted: false,
};

const proPlan = {
  name: "Pro",
  description: "Para academias que querem crescer",
  price: "R$ 49",
  features: [
    "Alunos ilimitados",
    "Tudo do plano Gratuito",
    "Dashboard web completo",
    "Relatórios avançados",
    "Suporte prioritário",
  ],
  ctaLabel: "Assinar agora",
  highlighted: true,
};

function PricingCard({ plan }: { plan: typeof freePlan }) {
  return (
    <div
      className={`flex flex-col gap-8 rounded-[20px] bg-background p-8 md:p-10 ${
        plan.highlighted ? "border-2 border-primary" : "border border-border"
      }`}
    >
      {plan.highlighted && (
        <span className="w-fit rounded-full bg-gradient-to-b from-primary to-primary-dark px-3 py-1 text-[10px] font-bold uppercase tracking-[1.5px] text-white">
          MAIS POPULAR
        </span>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="font-[family-name:var(--font-sora)] text-[22px] font-bold text-white">
          {plan.name}
        </h3>
        <p className="text-sm leading-normal text-text-secondary">
          {plan.description}
        </p>
      </div>

      <div className="flex items-end gap-1">
        <span className="font-[family-name:var(--font-sora)] text-5xl font-extrabold tracking-[-2px] text-white">
          {plan.price}
        </span>
        <span className="text-base text-text-muted">/mês</span>
      </div>

      <div className="h-px w-full bg-border" />

      <div className="flex flex-col gap-4">
        {plan.features.map((feature) => (
          <div key={feature} className="flex items-center gap-3">
            <Check
              className={`h-[18px] w-[18px] ${
                plan.highlighted ? "text-primary" : "text-success"
              }`}
            />
            <span className="text-sm text-white">{feature}</span>
          </div>
        ))}
      </div>

      <a
        href="#download"
        className={`flex items-center justify-center rounded-xl py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 ${
          plan.highlighted
            ? "bg-gradient-to-b from-primary to-primary-dark"
            : "border border-border-light bg-[#242424]"
        }`}
      >
        {plan.ctaLabel}
      </a>
    </div>
  );
}

export function Pricing() {
  return (
    <section
      id="precos"
      className="bg-surface px-6 py-16 md:px-20 md:py-[100px]"
    >
      <div className="mx-auto max-w-[1440px]">
        <AnimateOnScroll className="flex flex-col items-center gap-16">
          {/* Header */}
          <div className="flex max-w-[700px] flex-col items-center gap-4">
            <span className="rounded-full bg-primary/[0.125] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-primary">
              PREÇOS
            </span>
            <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[44px]">
              Simples e transparente
            </h2>
            <p className="text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              Comece gratuitamente. Evolua quando sua academia crescer.
            </p>
          </div>

          {/* Cards */}
          <div className="grid w-full max-w-[900px] grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            <PricingCard plan={freePlan} />
            <PricingCard plan={proPlan} />
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
