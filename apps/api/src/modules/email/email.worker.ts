import {
  InvoicePaid,
  ManagerNewMember,
  MemberApproved,
  PaymentConfirmed,
  PaymentFailed,
  PlanEnrolled,
  ProActivated,
  renderEmail,
  StudentPaymentReceived,
  SubscriptionCanceled,
  TrialEnding,
} from "@tatame/email";
import { Worker, type Job } from "bullmq";
import { createElement } from "react";
import { getResend } from "../../lib/resend.js";
import { logger } from "../../lib/logger.js";
import type { EmailJobName } from "./email.queue.js";

const FROM = "Tatame <noreply@apptatame.com.br>";

const subjectMap: Record<EmailJobName, (data: Record<string, unknown>) => string> = {
  "invoice-paid": () => "Fatura paga com sucesso",
  "payment-failed": () => "Falha no pagamento da sua assinatura",
  "pro-activated": () => "Bem-vindo ao plano Pro!",
  "subscription-canceled": () => "Assinatura cancelada",
  "plan-enrolled": (d) => `Inscrição realizada — ${d.planName}`,
  "payment-confirmed": () => "Pagamento confirmado",
  "member-approved": (d) => `Aprovado na ${d.academyName}!`,
  "manager-new-member": () => "Novo membro aprovado",
  "student-payment-received": () => "Pagamento de aluno recebido",
  "trial-ending": () => "Seu período de teste termina em breve",
};

type TemplateComponent = (props: Record<string, unknown>) => React.ReactElement;

const templateMap: Record<EmailJobName, TemplateComponent> = {
  "invoice-paid": InvoicePaid as unknown as TemplateComponent,
  "payment-failed": PaymentFailed as unknown as TemplateComponent,
  "pro-activated": ProActivated as unknown as TemplateComponent,
  "subscription-canceled": SubscriptionCanceled as unknown as TemplateComponent,
  "plan-enrolled": PlanEnrolled as unknown as TemplateComponent,
  "payment-confirmed": PaymentConfirmed as unknown as TemplateComponent,
  "member-approved": MemberApproved as unknown as TemplateComponent,
  "manager-new-member": ManagerNewMember as unknown as TemplateComponent,
  "student-payment-received": StudentPaymentReceived as unknown as TemplateComponent,
  "trial-ending": TrialEnding as unknown as TemplateComponent,
};

async function processEmailJob(job: Job): Promise<void> {
  const resend = getResend();
  if (!resend) {
    logger.info({ jobName: job.name, jobId: job.id }, "[email] RESEND_API_KEY not set, skipping job");
    return;
  }

  const jobName = job.name as EmailJobName;
  const { email, ...templateProps } = job.data as { email: string } & Record<
    string,
    unknown
  >;

  const Template = templateMap[jobName];
  if (!Template) {
    logger.error({ jobName }, "[email] Unknown job name");
    return;
  }

  const html = await renderEmail(createElement(Template, templateProps));
  const subject = subjectMap[jobName](job.data);

  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject,
    html,
    headers: {
      "X-Entity-Ref-ID": job.id ?? `${jobName}-${Date.now()}`,
    },
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

let emailWorker: Worker | null = null;

export function startEmailWorker(redisUrl: string): Worker {
  if (emailWorker) return emailWorker;

  emailWorker = new Worker("email", processEmailJob, {
    connection: { url: redisUrl },
    concurrency: 5,
  });

  emailWorker.on("failed", (job, err) => {
    logger.error({ jobName: job?.name, jobId: job?.id, err: err.message }, "[email] Job failed");
  });

  return emailWorker;
}

export async function closeEmailWorker(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
  }
}
