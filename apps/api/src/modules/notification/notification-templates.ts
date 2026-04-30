import type { NotificationRow } from "./notification.repository.js";

type Category = NotificationRow["category"];

type NotificationTemplate = {
  title: string;
  body: (...args: string[]) => string;
};

export const notificationTemplates: Record<string, NotificationTemplate> = {
  class_updated: {
    title: "Aula alterada",
    body: (className: string) =>
      `A aula "${className}" teve alterações no horário.`,
  },
  class_deactivated: {
    title: "Aula cancelada",
    body: (className: string) =>
      `A aula "${className}" foi cancelada.`,
  },
  payment_confirmed: {
    title: "Pagamento confirmado",
    body: (planName: string) =>
      `Seu pagamento para o plano "${planName}" foi confirmado.`,
  },
  belt_promotion: {
    title: "Nova graduação registrada!",
    body: (belt: string, stripes: string) =>
      `Parabéns! Você foi promovido para faixa ${belt} com ${stripes} grau(s).`,
  },
  new_member: {
    title: "Novo aluno na academia",
    body: (memberName: string) =>
      `${memberName} acabou de entrar na academia.`,
  },
  checkin_anomaly: {
    title: "Check-in sem assinatura ativa",
    body: (studentName: string, className: string) =>
      `${studentName} fez check-in na aula "${className}" com assinatura vencida ou pagamento pendente.`,
  },
  student_payment_received: {
    title: "Pagamento de aluno recebido",
    body: (studentName: string, planName: string) =>
      `${studentName} pagou o plano "${planName}".`,
  },
  class_created: {
    title: "Nova aula disponível",
    body: (className: string, dayName: string, time: string) =>
      `A aula "${className}" foi adicionada ao horário: ${dayName} às ${time}.`,
  },
  membership_request: {
    title: "Novo pedido de entrada",
    body: (memberName: string, role: string) =>
      `${memberName} solicitou entrada como ${role === "instructor" ? "instrutor" : "aluno"}.`,
  },
  membership_approved: {
    title: "Aprovado na academia!",
    body: (academyName: string) =>
      `Seu pedido para entrar na ${academyName} foi aprovado. Bem-vindo!`,
  },
  membership_rejected: {
    title: "Pedido recusado",
    body: (academyName: string) =>
      `Seu pedido para entrar na ${academyName} foi recusado.`,
  },
  weekly_summary: {
    title: "Resumo semanal",
    body: (count: string) =>
      `Você treinou ${Number(count) === 1 ? "1 vez" : `${count} vezes`} esta semana — ótimo trabalho!`,
  },
  inactivity_nudge: {
    title: "Sentimos sua falta!",
    body: () => "Não te vemos há 2 semanas — volte a treinar!",
  },
  milestone: {
    title: "Marco alcançado! 🥋",
    body: (count: string) => `Você completou ${count} aulas! Parabéns pela dedicação!`,
  },
};

export function getTemplate(key: string): NotificationTemplate | undefined {
  return notificationTemplates[key];
}

export function categoryForTemplateKey(key: string): Category {
  const map: Record<string, Category> = {
    class_updated: "class_change",
    class_deactivated: "class_change",
    payment_confirmed: "payment",
    belt_promotion: "belt_promotion",
    new_member: "new_member",
    checkin_anomaly: "checkin_anomaly",
    student_payment_received: "payment",
    class_created: "class_change",
    membership_request: "new_member",
    membership_approved: "new_member",
    membership_rejected: "new_member",
    weekly_summary: "weekly_summary",
    inactivity_nudge: "inactivity",
    milestone: "milestone",
  };
  return map[key] ?? "announcement";
}
