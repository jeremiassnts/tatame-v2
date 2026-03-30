export type ManagerPlanId = "free" | "pro";

export type ManagerPlanInfo = {
  id: ManagerPlanId;
  title: string;
  description: string;
  price: string;
  period: string;
  features: string[];
  ctaLabel: string;
  badgeLabel?: string;
};

export const MANAGER_PLANS: readonly ManagerPlanInfo[] = [
  {
    id: "free",
    title: "Gratuito",
    description: "Para academias começando no digital",
    price: "R$ 0",
    period: "/mês",
    features: [
      "Até 50 alunos",
      "Agenda de aulas",
      "Check-in de alunos",
      "Controle de graduações",
    ],
    ctaLabel: "Começar grátis",
  },
  {
    id: "pro",
    title: "Pro",
    description: "Para academias que querem crescer",
    price: "R$ 49",
    period: "/mês",
    features: [
      "Alunos ilimitados",
      "Agenda ilimitada",
      "Controle financeiro completo",
      "Acesso ilimitado de instrutores"
    ],
    ctaLabel: "Assinar Pro",
    badgeLabel: "MAIS POPULAR",
  },
] as const;

