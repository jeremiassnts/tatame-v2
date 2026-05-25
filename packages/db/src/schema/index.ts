import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const appRoleEnum = pgEnum("app_role", [
  "manager",
  "instructor",
  "student",
  "guardian",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "pending",
  "active",
  "rejected",
  "blocked",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "expired",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "manual",
  "stripe",
  "pix",
]);

export const beltEnum = pgEnum("belt", [
  "white",
  "blue",
  "purple",
  "brown",
  "black",
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
]);

export const managerPlanEnum = pgEnum("manager_plan", ["free", "pro"]);

export const managerSubscriptionStatusEnum = pgEnum(
  "manager_subscription_status",
  ["active", "past_due", "canceled", "incomplete", "trialing"],
);

export const pixKeyTypeEnum = pgEnum("pix_key_type", [
  "cpf",
  "email",
  "phone",
  "random",
]);

export const pushTokenPlatformEnum = pgEnum("push_token_platform", [
  "ios",
  "android",
]);

export const notificationCategoryEnum = pgEnum("notification_category", [
  "class_change",
  "payment",
  "belt_promotion",
  "announcement",
  "marketplace",
  "tournament",
  "new_member",
  "subscription_alert",
  "checkin_anomaly",
  "streak",
  "inactivity",
  "milestone",
  "weekly_summary",
  "wrapped",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "queued",
  "sent",
  "failed",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  profileImageUrl: text("profile_image_url"),
  phone: text("phone"),
  instagram: text("instagram"),
  birthDate: date("birth_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  pendingStripeCustomerId: text("pending_stripe_customer_id"),
  pendingStripeSubscriptionId: text("pending_stripe_subscription_id"),
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: appRoleEnum("role").notNull(),
    isActive: boolean("is_active").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => ({
    oneActivePerUser: uniqueIndex("user_roles_one_active_per_user")
      .on(t.userId)
      .where(sql`${t.isActive} = true`),
  }),
);

export const academies = pgTable("academies", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  address: text("address"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  foundedAt: date("founded_at"),
  pixKey: text("pix_key"),
  pixKeyType: pixKeyTypeEnum("pix_key_type"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const academyMemberships = pgTable(
  "academy_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    academyId: uuid("academy_id")
      .notNull()
      .references(() => academies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: appRoleEnum("role").notNull(),
    status: membershipStatusEnum("status").notNull(),
    isActive: boolean("is_active").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    oneActiveMembershipPerUser: uniqueIndex(
      "academy_memberships_one_active_per_user",
    )
      .on(t.userId)
      .where(sql`${t.isActive} = true`),
  }),
);

export const dependents = pgTable("dependents", {
  id: uuid("id").primaryKey().defaultRandom(),
  guardianId: uuid("guardian_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  academyId: uuid("academy_id")
    .notNull()
    .references(() => academies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  birthDate: date("birth_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    academyId: uuid("academy_id")
      .notNull()
      .references(() => academies.id, { onDelete: "cascade" }),
    instructorId: uuid("instructor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    dayOfWeek: smallint("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    capacity: smallint("capacity"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    academyDayIdx: index("classes_academy_id_day_of_week_idx").on(
      t.academyId,
      t.dayOfWeek,
    ),
  }),
);

export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    date: date("date").notNull(),
    weekReference: date("week_reference").notNull(),
    dependentId: uuid("dependent_id").references(() => dependents.id, {
      onDelete: "set null",
    }),
  },
  (t) => ({
    userWeekIdx: index("checkins_user_id_week_reference_idx").on(
      t.userId,
      t.weekReference,
    ),
    classDateIdx: index("checkins_class_id_date_idx").on(t.classId, t.date),
    onePerUserClassDate: uniqueIndex("checkins_user_class_date_unique")
      .on(t.userId, t.classId, t.date)
      .where(sql`${t.dependentId} IS NULL`),
    onePerDependentClassDate: uniqueIndex("checkins_dependent_class_date_unique")
      .on(t.dependentId, t.classId, t.date)
      .where(sql`${t.dependentId} IS NOT NULL`),
  }),
);

export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id")
    .notNull()
    .references(() => academies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  recurrenceMonths: smallint("recurrence_months").notNull(),
  priceCents: integer("price_cents").notNull(),
  weeklyCheckinLimit: smallint("weekly_checkin_limit"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const studentSubscriptions = pgTable("student_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => subscriptionPlans.id, { onDelete: "restrict" }),
  dependentId: uuid("dependent_id").references(() => dependents.id, {
    onDelete: "set null",
  }),
  status: subscriptionStatusEnum("status").notNull(),
  startsAt: date("starts_at").notNull(),
  expiresAt: date("expires_at").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const managerSubscriptions = pgTable("manager_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  academyId: uuid("academy_id")
    .notNull()
    .references(() => academies.id, { onDelete: "cascade" })
    .unique(),
  plan: managerPlanEnum("plan").notNull(),
  status: managerSubscriptionStatusEnum("status").notNull(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripePriceId: text("stripe_price_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  subscribedAt: timestamp("subscribed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => studentSubscriptions.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  academyId: uuid("academy_id")
    .notNull()
    .references(() => academies.id, { onDelete: "cascade" }),
  dependentId: uuid("dependent_id").references(() => dependents.id, {
    onDelete: "set null",
  }),
  amountCents: integer("amount_cents").notNull(),
  method: paymentMethodEnum("method").notNull(),
  confirmedBy: uuid("confirmed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  stripePaymentId: text("stripe_payment_id"),
  referenceMonth: date("reference_month").notNull(),
  notes: text("notes"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  transferredAt: timestamp("transferred_at", { withTimezone: true }),
});

export const pendingPixPayments = pgTable("pending_pix_payments", {
  pixQrCodeId: text("pix_qr_code_id").primaryKey(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => studentSubscriptions.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  academyId: uuid("academy_id")
    .notNull()
    .references(() => academies.id, { onDelete: "cascade" }),
  referenceMonth: date("reference_month").notNull(),
  amountCents: integer("amount_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const beltPromotions = pgTable(
  "belt_promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    academyId: uuid("academy_id")
      .notNull()
      .references(() => academies.id, { onDelete: "cascade" }),
    promotedBy: uuid("promoted_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    dependentId: uuid("dependent_id").references(() => dependents.id, {
      onDelete: "set null",
    }),
    belt: beltEnum("belt").notNull(),
    stripes: smallint("stripes").notNull(),
    isCurrent: boolean("is_current").notNull(),
    promotedAt: timestamp("promoted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    notes: text("notes"),
  },
  (t) => ({
    oneCurrentPerUser: uniqueIndex("belt_promotions_one_current_per_user")
      .on(t.userId)
      .where(sql`${t.isCurrent} = true AND ${t.dependentId} IS NULL`),
    oneCurrentPerDependent: uniqueIndex("belt_promotions_one_current_per_dependent")
      .on(t.dependentId)
      .where(sql`${t.isCurrent} = true AND ${t.dependentId} IS NOT NULL`),
  }),
);

export const pushTokens = pgTable(
  "push_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.clerkUserId, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: pushTokenPlatformEnum("platform").notNull(),
    deviceId: text("device_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userDeviceUnique: uniqueIndex("push_tokens_user_device_unique").on(
      t.userId,
      t.deviceId,
    ),
    userIdx: index("push_tokens_user_id_idx").on(t.userId),
  }),
);

export const engagementMilestones = pgTable(
  "engagement_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    milestone: integer("milestone").notNull(),
    notifiedAt: timestamp("notified_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userMilestoneUnique: uniqueIndex("engagement_milestones_user_milestone_unique").on(
      t.userId,
      t.milestone,
    ),
  }),
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.clerkUserId, { onDelete: "cascade" }),
    pushEnabled: boolean("push_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userIdUnique: uniqueIndex("notification_preferences_user_id_unique").on(
      t.userId,
    ),
  }),
);

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    academyId: uuid("academy_id")
      .notNull()
      .references(() => academies.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    academyCreatedIdx: index("announcements_academy_id_created_at_idx").on(
      t.academyId,
      t.createdAt,
    ),
  }),
);

export const customNotificationSends = pgTable(
  "custom_notification_sends",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    academyId: uuid("academy_id")
      .notNull()
      .references(() => academies.id),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    academyCreatedIdx: index("custom_notification_sends_academy_created_idx").on(
      t.academyId,
      t.createdAt,
    ),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => users.clerkUserId, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    category: notificationCategoryEnum("category").notNull(),
    data: jsonb("data"),
    readAt: timestamp("read_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    status: notificationStatusEnum("status").notNull().default("pending"),
    academyId: uuid("academy_id").references(() => academies.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    recipientReadIdx: index("notifications_recipient_read_idx").on(
      t.recipientId,
      t.readAt,
    ),
    recipientCreatedIdx: index("notifications_recipient_created_idx").on(
      t.recipientId,
      t.createdAt,
    ),
  }),
);
