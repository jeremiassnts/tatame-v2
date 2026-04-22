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
  };
  return map[key] ?? "announcement";
}
