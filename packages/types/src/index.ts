export const Role = {
  Manager: "manager",
  Instructor: "instructor",
  Student: "student",
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
} as const;
export type PaymentMethod =
  (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const Belt = {
  White: "white",
  Blue: "blue",
  Purple: "purple",
  Brown: "brown",
  Black: "black",
} as const;
export type Belt = (typeof Belt)[keyof typeof Belt];

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
