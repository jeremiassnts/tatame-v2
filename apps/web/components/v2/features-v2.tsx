import {
  Calendar,
  UserCheck,
  Award,
  CreditCard,
  Users,
  Baby,
  Smartphone,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const featuresBlock1: Feature[] = [
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
      "Saiba exatamente quem treinou, quando e em qual turma. Controle automático de capacidade e limite semanal.",
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
      "Receba mensalidades via Pix ou cartão direto no app. Veja quem pagou, quem está atrasado e seu histórico financeiro.",
  },
];

const featuresBlock2: Feature[] = [
  {
    icon: Users,
    title: "Gestão de membros",
    description:
      "Aprove novos alunos, veja perfis detalhados e mantenha o controle de quem treina na sua academia.",
  },
  {
    icon: Baby,
    title: "Dependentes",
    description:
      "Pais acompanham presenças e graduações dos filhos pelo próprio celular, com assinatura e check-in vinculados.",
  },
  {
    icon: Smartphone,
    title: "App multi-plataforma",
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

function FeatureItem({ icon: Icon, title, description }: Feature) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-[48px] w-[48px] items-center justify-center rounded-[14px] bg-primary/[0.125]">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-[family-name:var(--font-sora)] text-lg font-bold text-white">
        {title}
      </h3>
      <p className="text-[15px] leading-relaxed text-text-secondary">
        {description}
      </p>
    </div>
  );
}

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[20px] border-2 border-dashed border-border-light bg-surface">
      <span className="text-sm text-text-muted">{label}</span>
    </div>
  );
}

export function FeaturesV2() {
  return (
    <section id="recursos" className="px-6 py-16 md:px-20 md:py-[100px]">
      <div className="mx-auto max-w-[1440px]">
        {/* Section header */}
        <div className="mb-16 flex flex-col items-center gap-4">
          <span className="rounded-full bg-primary/[0.125] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-primary">
            RECURSOS
          </span>
          <h2 className="text-center font-[family-name:var(--font-sora)] text-[30px] font-extrabold tracking-[-1.5px] text-white md:text-[44px]">
            O que o app oferece
          </h2>
          <p className="max-w-[600px] text-center text-base leading-relaxed text-text-secondary md:text-lg">
            Cada recurso foi pensado para a rotina real de quem vive o Jiu-Jitsu.
          </p>
        </div>

        {/* Block 1: Image LEFT + 4 features RIGHT */}
        <div className="mb-20 flex flex-col items-center gap-12 md:flex-row md:gap-16">
          <div className="w-full md:w-1/2">
            <ImagePlaceholder label="Screenshot do app — Bloco 1" />
          </div>
          <div className="grid w-full grid-cols-1 gap-10 sm:grid-cols-2 md:w-1/2">
            {featuresBlock1.map((feature) => (
              <FeatureItem key={feature.title} {...feature} />
            ))}
          </div>
        </div>

        {/* Block 2: 4 features LEFT + Image RIGHT */}
        <div className="flex flex-col-reverse items-center gap-12 md:flex-row md:gap-16">
          <div className="grid w-full grid-cols-1 gap-10 sm:grid-cols-2 md:w-1/2">
            {featuresBlock2.map((feature) => (
              <FeatureItem key={feature.title} {...feature} />
            ))}
          </div>
          <div className="w-full md:w-1/2">
            <ImagePlaceholder label="Screenshot do app — Bloco 2" />
          </div>
        </div>
      </div>
    </section>
  );
}
