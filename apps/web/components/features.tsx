import {
  Calendar,
  UserCheck,
  Award,
  CreditCard,
  Users,
  BarChart3,
  Baby,
  Megaphone,
  Smartphone,
  Rocket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimateOnScroll } from "./animate-on-scroll";

const features: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Calendar,
    title: "Agenda de aulas",
    description:
      "Crie sua grade uma vez e ela se repete toda semana. Defina instrutores, horários e capacidade por turma.",
  },
  {
    icon: UserCheck,
    title: "Check-in inteligente",
    description:
      "Saiba exatamente quem treinou, quando e em qual turma. O app controla capacidade e limite semanal automaticamente.",
  },
  {
    icon: Award,
    title: "Graduações",
    description:
      "Acompanhe a evolução de cada aluno com histórico completo de faixas, graus e observações de promoção.",
  },
  {
    icon: CreditCard,
    title: "Pagamentos",
    description:
      "Receba mensalidades diretamente no app via Pix ou cartão. Veja quem pagou, quem está atrasado e seu histórico financeiro completo.",
  },
  {
    icon: Users,
    title: "Gestão de membros",
    description:
      "Aprove novos alunos, veja perfis detalhados e mantenha o controle de quem treina na sua academia.",
  },
  {
    icon: Baby,
    title: "Dependentes e responsáveis",
    description:
      "Pais acompanham presenças e graduações dos filhos pelo próprio celular, com assinatura e check-in vinculados.",
  },
  {
    icon: Megaphone,
    title: "Painel de avisos",
    description:
      "Comunique-se com alunos e instrutores direto pelo app — sem depender de WhatsApp ou grupos externos.",
  },
  {
    icon: Smartphone,
    title: "App para todos",
    description:
      "Cada perfil vê o que precisa: gestores administram, instrutores ensinam, alunos acompanham. iPhone e Android.",
  },
  {
    icon: BarChart3,
    title: "Relatórios",
    description:
      "Veja a saúde da sua academia em números: frequência, receita e crescimento em dashboards visuais.",
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
              Gerencie em minutos o que antes levava horas
            </h2>
            <p className="text-center text-base leading-relaxed text-text-secondary md:text-lg md:leading-relaxed">
              Cada recurso foi pensado para a rotina real de quem vive o
              Jiu-Jitsu.
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
              Novos recursos toda semana — e quem é Pro pede o que quiser.
            </span>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
