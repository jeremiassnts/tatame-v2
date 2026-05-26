export const Role = {
  Manager: "manager",
  Instructor: "instructor",
  Student: "student",
  Guardian: "guardian",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

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
