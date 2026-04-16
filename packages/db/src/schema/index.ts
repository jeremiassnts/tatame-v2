import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
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
]);

export const managerPlanEnum = pgEnum("manager_plan", ["free", "pro"]);

export const managerSubscriptionStatusEnum = pgEnum(
  "manager_subscription_status",
  ["active", "past_due", "canceled", "incomplete"],
);

export const managerSubscriptionStoreEnum = pgEnum(
  "manager_subscription_store",
  ["app_store", "play_store"],
);

export const pixKeyTypeEnum = pgEnum("pix_key_type", [
  "cpf",
  "email",
  "phone",
  "random",
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
  },
  (t) => ({
    userWeekIdx: index("checkins_user_id_week_reference_idx").on(
      t.userId,
      t.weekReference,
    ),
    classDateIdx: index("checkins_class_id_date_idx").on(t.classId, t.date),
    onePerUserClassDate: uniqueIndex("checkins_user_class_date_unique").on(
      t.userId,
      t.classId,
      t.date,
    ),
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
  revenuecatAppUserId: text("revenuecat_app_user_id").unique(),
  productId: text("product_id"),
  originalTransactionId: text("original_transaction_id"),
  store: managerSubscriptionStoreEnum("store"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
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
      .where(sql`${t.isCurrent} = true`),
  }),
);
