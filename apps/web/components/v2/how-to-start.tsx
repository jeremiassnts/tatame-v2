import { UserPlus, Settings, Rocket } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const steps: { icon: LucideIcon; number: string; title: string; description: string }[] = [
  {
    icon: UserPlus,
    number: "1",
    title: "Crie sua conta grátis",
    description:
      "Cadastre-se em segundos — sem cartão de crédito, sem compromisso.",
  },
  {
    icon: Settings,
    number: "2",
    title: "Configure sua academia",
    description:
      "Adicione suas turmas, horários e planos. Em poucos minutos está tudo pronto.",
  },
  {
    icon: Rocket,
    number: "3",
    title: "Comece a gerenciar",
    description:
      "Convide instrutores e alunos. Sua academia já está funcionando no Tatame.",
  },
];

export function HowToStart() {
  return (
    <section id="como-funciona" className="bg-surface px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        {/* Section header */}
        <div className="mb-16 flex flex-col items-center gap-4">
          <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[44px]">
            Comece em 3 passos
          </h2>
          <p className="max-w-[500px] text-center text-base leading-relaxed text-text-secondary md:text-lg">
            Do cadastro à primeira aula gerenciada em minutos.
          </p>
        </div>

        {/* Steps */}
        <div className="relative flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-center md:gap-0">
          {steps.map((step, index) => (
            <div key={step.number} className="flex flex-col items-center md:flex-1">
              {/* Connector line (desktop only, between steps) */}
              {index < steps.length - 1 && (
                <div className="absolute top-[36px] hidden h-px bg-border-light md:block" style={{
                  left: `${(100 / steps.length) * (index + 0.5) + 5}%`,
                  width: `${(100 / steps.length) - 10}%`,
                }} />
              )}

              {/* Icon circle */}
              <div className="relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-primary bg-background">
                <step.icon className="h-7 w-7 text-primary" />
              </div>

              {/* Text */}
              <div className="mt-6 flex max-w-[280px] flex-col items-center gap-2 text-center">
                <span className="text-sm font-bold text-primary">Passo {step.number}</span>
                <h3 className="font-[family-name:var(--font-sora)] text-lg font-bold text-white">
                  {step.title}
                </h3>
                <p className="text-[15px] leading-relaxed text-text-secondary">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
