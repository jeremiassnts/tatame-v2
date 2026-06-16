import { Check } from "lucide-react";
import { ButtonColorful } from "../ui/button-colorful";

const proPlan = {
  name: "Pro",
  description:
    "Tudo que você precisa para gerenciar sua academia sem dor de cabeça.",
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

export function PricingV2() {
  return (
    <section id="precos" className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col items-center gap-16">
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
            <div className="flex flex-col gap-8 rounded-[20px] border-2 border-primary bg-background p-8 md:p-10">
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

              <div className="flex items-baseline gap-1">
                <span className="font-[family-name:var(--font-sora)] text-5xl font-extrabold tracking-[-2px] text-white">
                  R$ 49
                </span>
                <span className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tracking-[-1px] text-white">
                  ,90
                </span>
                <span className="text-base text-text-muted">/mês</span>
              </div>

              <div className="h-px w-full bg-border" />

              <div className="flex flex-col gap-4">
                {proPlan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <Check className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
                    <span className="text-sm text-white">{feature}</span>
                  </div>
                ))}
              </div>

              <ButtonColorful
                href="/cadastro"
                eventName="cta_pricing_click"
                label="Começar meu teste grátis"
                className="w-full"
              />

              <p className="text-center text-sm text-text-secondary">
                Cancele quando quiser, sem burocracia
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
