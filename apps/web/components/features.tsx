import {
  Calendar,
  UserCheck,
  Award,
  CreditCard,
  Users,
  BarChart3,
  Rocket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";

const features: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Calendar,
    title: "Agenda de aulas",
    description:
      "Monte sua grade semanal com turmas recorrentes, instrutores e controle de capacidade por aula.",
  },
  {
    icon: UserCheck,
    title: "Check-in inteligente",
    description:
      "Presenças com controle de capacidade, limite semanal e janela de horário automáticos.",
  },
  {
    icon: Award,
    title: "Graduações",
    description:
      "Registre faixas e graus de cada aluno com histórico completo de promoções e observações.",
  },
  {
    icon: CreditCard,
    title: "Pagamentos",
    description:
      "Controle de mensalidades, confirmação de pagamentos e histórico financeiro completo.",
  },
  {
    icon: Users,
    title: "Gestão de membros",
    description:
      "Aprovação de novos membros, perfis detalhados e controle de instrutores e alunos.",
  },
  {
    icon: BarChart3,
    title: "Relatórios",
    description:
      "Acompanhe frequência, receita e crescimento da academia com dashboards visuais.",
  },
];

function FeatureCard({
  icon: Icon,
  title,
  description,
}: (typeof features)[number]) {
  return (
    <div className="flex flex-col gap-5 rounded-[20px] border border-border bg-surface p-8">
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-primary/[0.125]">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-[family-name:var(--font-sora)] text-xl font-bold text-white md:text-[22px]">
        {title}
      </h3>
      <p className="text-[15px] leading-relaxed text-text-secondary">
        {description}
      </p>
    </div>
  );
}

export function Features() {
  return (
    <section id="recursos" className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        <AnimateOnScroll className="flex flex-col items-center gap-16">
          {/* Header */}
          <div className="flex max-w-[700px] flex-col items-center gap-4">
            <span className="rounded-full bg-primary/[0.125] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-primary">
              RECURSOS
            </span>
            <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[44px]">
              Tudo que sua academia precisa
            </h2>
            <p className="text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              Simplifique a gestão da sua academia com ferramentas pensadas para
              o dia a dia do Jiu-Jitsu.
            </p>
          </div>

          {/* Grid */}
          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>

          {/* Coming soon badge */}
          <div className="flex items-center gap-2.5 rounded-full border border-border-light bg-surface px-6 py-3">
            <Rocket className="h-4 w-4 text-primary" />
            <span className="text-[13px] font-medium text-text-secondary">
              E tem muito mais a caminho — fique ligado!
            </span>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
