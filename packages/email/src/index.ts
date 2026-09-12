export { renderEmail } from "./render.js";

// Components
export { Layout } from "./templates/components/layout.js";
export { Button } from "./templates/components/button.js";
export { Heading } from "./templates/components/heading.js";

// Templates
export { InvoicePaid, type InvoicePaidProps } from "./templates/invoice-paid.js";
export { PaymentFailed, type PaymentFailedProps } from "./templates/payment-failed.js";
export { ProActivated, type ProActivatedProps } from "./templates/pro-activated.js";
export { SubscriptionCanceled, type SubscriptionCanceledProps } from "./templates/subscription-canceled.js";
export { PlanEnrolled, type PlanEnrolledProps } from "./templates/plan-enrolled.js";
export { PaymentConfirmed, type PaymentConfirmedProps } from "./templates/payment-confirmed.js";
export { MemberApproved, type MemberApprovedProps } from "./templates/member-approved.js";
export { ManagerNewMember, type ManagerNewMemberProps } from "./templates/manager-new-member.js";
export { StudentPaymentReceived, type StudentPaymentReceivedProps } from "./templates/student-payment-received.js";
export { TrialEnding, type TrialEndingProps } from "./templates/trial-ending.js";
export { AdminNewManager, type AdminNewManagerProps } from "./templates/admin-new-manager.js";
export {
  DailyPlatformSummary,
  type DailyPlatformSummaryProps,
  type AcademySummary,
  type SummaryDelta,
  type SummaryMethodTotal,
  type SummaryMoney,
} from "./templates/daily-platform-summary.js";
