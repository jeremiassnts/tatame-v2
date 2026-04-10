export type AcademySummaryRow = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  managerPlan: "free" | "pro" | null;
  managerPlanStatus: "active" | "past_due" | "canceled" | "incomplete" | null;
  studentCount: number;
  pendingTransferCents: number;
};

export type AcademyDetailRow = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  managerPlan: "free" | "pro" | null;
  managerPlanStatus: "active" | "past_due" | "canceled" | "incomplete" | null;
};

export type AdminPaymentRow = {
  id: string;
  userName: string;
  amountCents: number;
  method: "manual" | "stripe" | "pix";
  referenceMonth: string;
  paidAt: Date;
  transferredAt: Date | null;
};

export type DailyCheckinCount = {
  date: string;
  count: number;
};

export type ManagerSubscriptionCounts = {
  total: number;
  pro: number;
  free: number;
};

export interface IAdminRepository {
  countManagerSubscriptions(): Promise<ManagerSubscriptionCounts>;
  countTotalUsers(): Promise<number>;
  sumAppRevenueCents(): Promise<number>;
  sumTransferredCents(): Promise<number>;
  sumPendingTransferCents(): Promise<number>;
  getDailyCheckins(days: number): Promise<DailyCheckinCount[]>;
  listAcademies(): Promise<AcademySummaryRow[]>;
  getAcademyDetail(academyId: string): Promise<AcademyDetailRow | undefined>;
  countStudentsByAcademy(academyId: string): Promise<number>;
  sumAcademyRevenueCentsForMonth(academyId: string, referenceMonth: string): Promise<number>;
  sumAcademyTransferredCents(academyId: string): Promise<number>;
  sumAcademyPendingTransferCents(academyId: string): Promise<number>;
  listAcademyPayments(academyId: string, opts: { limit: number; offset: number }): Promise<{ items: AdminPaymentRow[]; total: number }>;
  markTransferred(paymentIds: string[]): Promise<number>;
}
