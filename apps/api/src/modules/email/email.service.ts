import type { Queue } from "bullmq";
import type { EmailJobMap, EmailJobName } from "./email.queue.js";

export class EmailService {
  constructor(private readonly queue: Queue) {}

  private async enqueue<N extends EmailJobName>(
    name: N,
    data: EmailJobMap[N],
    jobId: string,
  ): Promise<void> {
    await this.queue.add(name, data, { jobId });
  }

  async sendInvoicePaid(
    data: EmailJobMap["invoice-paid"],
    stripeInvoiceId: string,
  ) {
    await this.enqueue("invoice-paid", data, `invoice-paid-${stripeInvoiceId}`);
  }

  async sendPaymentFailed(
    data: EmailJobMap["payment-failed"],
    stripeInvoiceId: string,
  ) {
    await this.enqueue(
      "payment-failed",
      data,
      `payment-failed-${stripeInvoiceId}`,
    );
  }

  async sendProActivated(
    data: EmailJobMap["pro-activated"],
    stripeSubscriptionId: string,
  ) {
    await this.enqueue(
      "pro-activated",
      data,
      `pro-activated-${stripeSubscriptionId}`,
    );
  }

  async sendSubscriptionCanceled(
    data: EmailJobMap["subscription-canceled"],
    stripeSubscriptionId: string,
  ) {
    await this.enqueue(
      "subscription-canceled",
      data,
      `subscription-canceled-${stripeSubscriptionId}`,
    );
  }

  async sendPlanEnrolled(
    data: EmailJobMap["plan-enrolled"],
    studentSubscriptionId: string,
  ) {
    await this.enqueue(
      "plan-enrolled",
      data,
      `plan-enrolled-${studentSubscriptionId}`,
    );
  }

  async sendPaymentConfirmed(
    data: EmailJobMap["payment-confirmed"],
    paymentId: string,
  ) {
    await this.enqueue(
      "payment-confirmed",
      data,
      `payment-confirmed-${paymentId}`,
    );
  }

  async sendMemberApproved(
    data: EmailJobMap["member-approved"],
    membershipId: string,
  ) {
    await this.enqueue(
      "member-approved",
      data,
      `member-approved-${membershipId}`,
    );
  }

  async sendManagerNewMember(
    data: EmailJobMap["manager-new-member"],
    membershipId: string,
  ) {
    await this.enqueue(
      "manager-new-member",
      data,
      `manager-new-member-${membershipId}`,
    );
  }
}
