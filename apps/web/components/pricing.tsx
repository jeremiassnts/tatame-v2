import { Check } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";
import { TrackedLink } from "./tracked-link";

const proPlan = {
  name: "Pro",
  description: "Tudo que você precisa para gerenciar sua academia sem dor de cabeça.",
  price: "R$ 49",
  features: [
    "Cadastre quantos alunos quiser",
    "Monte quantas turmas precisar",
    "Saiba quanto entra e quanto sai",
    "Receba pagamentos via Pix e cartão direto no app",
    "Adicione todos os seus instrutores",
    "Gerencie dependentes e responsáveis",
  ],
};

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
              Um plano. Tudo incluso.
            </h2>
            <p className="text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              Teste grátis por 30 dias. Cancele quando quiser, sem perguntas.
            </p>
          </div>

          {/* Card */}
          <div className="w-full max-w-[480px]">
            <div className="flex flex-col gap-8 rounded-[20px] bg-background p-8 border-2 border-primary md:p-10">
              {/* Trial badge */}
              <span className="w-fit rounded-full bg-gradient-to-b from-primary to-primary-dark px-3 py-1 text-[16px] font-bold uppercase tracking-[1.5px] text-white">
                30 DIAS GRÁTIS
              </span>

              <div className="flex flex-col gap-2">
                <h3 className="font-[family-name:var(--font-sora)] text-[22px] font-bold text-white">
                  {proPlan.name}
                </h3>
                <p className="text-sm leading-normal text-text-secondary">
                  {proPlan.description}
                </p>
              </div>

              <div className="flex items-end gap-1">
                <span className="font-[family-name:var(--font-sora)] text-5xl font-extrabold tracking-[-2px] text-white">
                  {proPlan.price}
                </span>
                <span className="text-base text-text-muted">/mês</span>
              </div>

              <div className="h-px w-full bg-border" />

              <div className="flex flex-col gap-4">
                {proPlan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <Check className="h-[18px] w-[18px] text-primary" />
                    <span className="text-sm text-white">{feature}</span>
                  </div>
                ))}
              </div>

              <TrackedLink
                href="/cadastro"
                eventName="cta_pricing_click"
                className="flex items-center justify-center rounded-xl py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 bg-gradient-to-b from-primary to-primary-dark"
              >
                Começar meu teste grátis
              </TrackedLink>

              <p className="text-center text-sm text-text-secondary">
                Cancele quando quiser, sem burocracia
              </p>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
