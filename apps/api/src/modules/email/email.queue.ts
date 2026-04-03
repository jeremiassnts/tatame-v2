import { Queue } from "bullmq";
import type { InvoicePaidProps } from "@tatame/email";
import type { PaymentFailedProps } from "@tatame/email";
import type { ProActivatedProps } from "@tatame/email";
import type { SubscriptionCanceledProps } from "@tatame/email";
import type { PlanEnrolledProps } from "@tatame/email";
import type { PaymentConfirmedProps } from "@tatame/email";
import type { MemberApprovedProps } from "@tatame/email";
import type { ManagerNewMemberProps } from "@tatame/email";

export type EmailJobMap = {
  "invoice-paid": InvoicePaidProps & { email: string };
  "payment-failed": PaymentFailedProps & { email: string };
  "pro-activated": ProActivatedProps & { email: string };
  "subscription-canceled": SubscriptionCanceledProps & { email: string };
  "plan-enrolled": PlanEnrolledProps & { email: string };
  "payment-confirmed": PaymentConfirmedProps & { email: string };
  "member-approved": MemberApprovedProps & { email: string };
  "manager-new-member": ManagerNewMemberProps & { email: string };
};

export type EmailJobName = keyof EmailJobMap;

let emailQueue: Queue | null = null;

export function getEmailQueue(redisUrl: string): Queue {
  if (!emailQueue) {
    emailQueue = new Queue("email", {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return emailQueue;
}

export async function closeEmailQueue(): Promise<void> {
  if (emailQueue) {
    await emailQueue.close();
    emailQueue = null;
  }
}
