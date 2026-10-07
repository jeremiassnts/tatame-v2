import { HttpError } from "../../lib/http-error.js";
import type {
  AcademyDetailRow,
  AcademySummaryRow,
  AdminPaymentRow,
  DailyCheckinCount,
  IAdminRepository,
  ManagerSubscriptionCounts,
} from "./admin.repository.js";

export type DashboardData = {
  subscribers: ManagerSubscriptionCounts;
  totalUsers: number;
  appRevenueCents: number;
};

export type AcademyDetailData = {
  academy: AcademyDetailRow;
  studentCount: number;
  revenueCentsCurrentMonth: number;
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export class AdminService {
  constructor(private readonly repo: IAdminRepository) {}

  async getDashboard(): Promise<DashboardData> {
    const [subscribers, totalUsers, appRevenueCents] = await Promise.all([
      this.repo.countManagerSubscriptions(),
      this.repo.countTotalUsers(),
      this.repo.sumAppRevenueCents(),
    ]);

    return { subscribers, totalUsers, appRevenueCents };
  }

  async getCheckins(): Promise<DailyCheckinCount[]> {
    return this.repo.getDailyCheckins(7);
  }

  async listAcademies(): Promise<AcademySummaryRow[]> {
    return this.repo.listAcademies();
  }

  async getAcademyDetail(academyId: string): Promise<AcademyDetailData> {
    const academy = await this.repo.getAcademyDetail(academyId);
    if (!academy) {
      throw new HttpError(404, "Academy not found");
    }

    const month = currentMonth();
    const [studentCount, revenueCentsCurrentMonth] = await Promise.all([
      this.repo.countStudentsByAcademy(academyId),
      this.repo.sumAcademyRevenueCentsForMonth(academyId, month),
    ]);

    return { academy, studentCount, revenueCentsCurrentMonth };
  }

  async listAcademyPayments(
    academyId: string,
    opts: { limit: number; offset: number },
  ): Promise<{ items: AdminPaymentRow[]; total: number }> {
    return this.repo.listAcademyPayments(academyId, opts);
  }
}
