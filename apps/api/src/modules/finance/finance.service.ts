import { HttpError } from "../../lib/http-error.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IPaymentRepository } from "../payment/payment.repository.js";
import type { IStudentSubscriptionRepository } from "../subscription/subscription.repository.js";

export type FinancialSummary = {
  revenueCurrentMonth: number;
  revenuePreviousMonth: number;
  pendingPaymentsCount: number;
  pendingPaymentsTotal: number;
  activeSubscriptionsCount: number;
};

function currentAndPreviousMonth(): {
  currentMonth: string;
  previousMonth: string;
} {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const currentMonth = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const prevDate = new Date(Date.UTC(y, m - 1, 1));
  const previousMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return { currentMonth, previousMonth };
}

export class FinanceService {
  constructor(
    private readonly paymentRepo: IPaymentRepository,
    private readonly studentSubRepo: IStudentSubscriptionRepository,
    private readonly academyRepo: IAcademyRepository,
  ) {}

  async getSummary(
    managerUserId: string,
    academyId: string,
  ): Promise<FinancialSummary> {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);

    const { currentMonth, previousMonth } = currentAndPreviousMonth();

    const [revenueCurrentMonth, revenuePreviousMonth, allSubs] =
      await Promise.all([
        this.paymentRepo.sumByAcademyForMonth(academyId, currentMonth),
        this.paymentRepo.sumByAcademyForMonth(academyId, previousMonth),
        this.studentSubRepo.listByAcademy(academyId, { status: "active" }),
      ]);

    const today = new Date().toISOString().slice(0, 10);
    const activeSubs = allSubs.filter(
      (s) => s.subscription.expiresAt >= today,
    );

    const pendingSubs = activeSubs.filter(
      (s) => s.lastPayment?.referenceMonth !== currentMonth,
    );

    return {
      revenueCurrentMonth,
      revenuePreviousMonth,
      pendingPaymentsCount: pendingSubs.length,
      pendingPaymentsTotal: pendingSubs.reduce(
        (sum, s) => sum + s.plan.priceCents,
        0,
      ),
      activeSubscriptionsCount: activeSubs.length,
    };
  }

  private async assertManagerOwnsAcademy(userId: string, academyId: string) {
    const academy = await this.academyRepo.findById(academyId);
    if (!academy) {
      throw new HttpError(404, "Academy not found");
    }
    if (academy.ownerId !== userId) {
      throw new HttpError(403, "You do not manage this academy");
    }
  }
}
