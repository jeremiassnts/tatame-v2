export const Role = {
  Manager: "manager",
  Instructor: "instructor",
  Student: "student",
  Guardian: "guardian",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/**
 * The three roles a person can be invited into an academy as. `manager` is
 * excluded on purpose: a manager owns an academy rather than joining one, so
 * there is no invite link that could produce one.
 */
export type InviteRole = Exclude<Role, typeof Role.Manager>;

/**
 * The invite-link vocabulary, fixed by TAT-175: `?papel=aluno|instrutor|responsavel`.
 *
 * It is Portuguese because the manager pastes the link and the invited person
 * reads it, and it is closed because the web invite page and the mobile app
 * both parse it — once links are circulating in group chats, neither the names
 * nor the spelling can change.
 *
 * This table lives here, in exactly one module, rather than once per consumer.
 * The part that must not drift is not the three pairs, it is the matching rule
 * below: `ALUNO` is not `aluno`, ` aluno` is not `aluno`, and there are no
 * aliases. Two copies of the table are two places to decide that again.
 */
export const PAPEL_TO_ROLE: Record<string, InviteRole> = {
  aluno: "student",
  instrutor: "instructor",
  responsavel: "guardian",
};

/**
 * The same table read the other way, for the one app that *produces* links.
 *
 * Written out rather than inverted at runtime: the inverse of a
 * `Record<string, InviteRole>` is not typed `Record<InviteRole, string>`, so a
 * role missing from it would reach a shared URL as `undefined` instead of
 * failing to compile. The two tables are held together by a round-trip
 * assertion (`resolvePapelToRole(ROLE_TO_PAPEL[r]) === r`) rather than by one
 * being derived from the other.
 */
export const ROLE_TO_PAPEL: Record<InviteRole, string> = {
  student: "aluno",
  instructor: "instrutor",
  guardian: "responsavel",
};

/**
 * A suggestion, never a lock: an unrecognised token degrades to "no suggested
 * role" and the invite still works. Matching is exact — the token is always
 * produced by the app, never typed by hand, so accepting `ALUNO` would only
 * widen what every consumer has to agree on.
 *
 * `string[]` is accepted because a repeated query parameter (`?papel=a&papel=b`)
 * arrives as an array in Next's `searchParams`; it resolves to `null` rather
 * than to whichever half won.
 */
export function resolvePapelToRole(
  papel: string | string[] | null | undefined,
): InviteRole | null {
  if (typeof papel !== "string") return null;
  return PAPEL_TO_ROLE[papel] ?? null;
}

export const MembershipStatus = {
  Pending: "pending",
  Active: "active",
  Rejected: "rejected",
  Blocked: "blocked",
} as const;
export type MembershipStatus =
  (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const PaymentMethod = {
  Manual: "manual",
  Stripe: "stripe",
  Pix: "pix",
} as const;
export type PaymentMethod =
  (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const Belt = {
  White: "white",
  Blue: "blue",
  Purple: "purple",
  Brown: "brown",
  Black: "black",
  GreyWhite: "grey_white",
  Grey: "grey",
  GreyBlack: "grey_black",
  YellowWhite: "yellow_white",
  Yellow: "yellow",
  YellowBlack: "yellow_black",
  OrangeWhite: "orange_white",
  Orange: "orange",
  OrangeBlack: "orange_black",
  GreenWhite: "green_white",
  Green: "green",
  GreenBlack: "green_black",
} as const;
export type Belt = (typeof Belt)[keyof typeof Belt];

/** Adult belts only (for students) */
export const AdultBelts: Belt[] = ["white", "blue", "purple", "brown", "black"];

/** Kids belts only (for dependents) */
export const KidsBelts: Belt[] = [
  "white",
  "grey_white",
  "grey",
  "grey_black",
  "yellow_white",
  "yellow",
  "yellow_black",
  "orange_white",
  "orange",
  "orange_black",
  "green_white",
  "green",
  "green_black",
];

export const SubscriptionStatus = {
  Active: "active",
  Expired: "expired",
  Cancelled: "cancelled",
} as const;
export type SubscriptionStatus =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const ManagerPlan = {
  Free: "free",
  Pro: "pro",
} as const;
export type ManagerPlan = (typeof ManagerPlan)[keyof typeof ManagerPlan];

export const ManagerSubscriptionStatus = {
  Active: "active",
  Trialing: "trialing",
  PastDue: "past_due",
  Canceled: "canceled",
  Incomplete: "incomplete",
} as const;
export type ManagerSubscriptionStatus =
  (typeof ManagerSubscriptionStatus)[keyof typeof ManagerSubscriptionStatus];

/** 0 = Sunday … 6 = Saturday (spec) */
export const DayOfWeek = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
} as const;
export type DayOfWeek = (typeof DayOfWeek)[keyof typeof DayOfWeek];

export const NotificationCategory = {
  ClassChange: "class_change",
  Payment: "payment",
  BeltPromotion: "belt_promotion",
  Announcement: "announcement",
  Marketplace: "marketplace",
  Tournament: "tournament",
  NewMember: "new_member",
  SubscriptionAlert: "subscription_alert",
  CheckinAnomaly: "checkin_anomaly",
  Streak: "streak",
  Inactivity: "inactivity",
  Milestone: "milestone",
  WeeklySummary: "weekly_summary",
  Wrapped: "wrapped",
} as const;
export type NotificationCategory =
  (typeof NotificationCategory)[keyof typeof NotificationCategory];

export const NotificationStatus = {
  Pending: "pending",
  Queued: "queued",
  Sent: "sent",
  Failed: "failed",
} as const;
export type NotificationStatus =
  (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const PushTokenPlatform = {
  Ios: "ios",
  Android: "android",
} as const;
export type PushTokenPlatform =
  (typeof PushTokenPlatform)[keyof typeof PushTokenPlatform];
