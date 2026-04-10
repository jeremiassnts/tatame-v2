import { faker } from "@faker-js/faker";
import type { InferSelectModel } from "drizzle-orm";
import {
  academyMemberships,
  academies,
  beltPromotions,
  checkins,
  classes,
  managerSubscriptions,
  payments,
  studentSubscriptions,
  subscriptionPlans,
  userRoles,
  users,
} from "@tatame/db";

export type UserRow = InferSelectModel<typeof users>;
export type UserRoleRow = InferSelectModel<typeof userRoles>;
export type AcademyRow = InferSelectModel<typeof academies>;
export type MembershipRow = InferSelectModel<typeof academyMemberships>;
export type ClassRow = InferSelectModel<typeof classes>;
export type CheckinRow = InferSelectModel<typeof checkins>;
export type SubscriptionPlanRow = InferSelectModel<typeof subscriptionPlans>;
export type StudentSubscriptionRow = InferSelectModel<
  typeof studentSubscriptions
>;
export type PaymentRow = InferSelectModel<typeof payments>;
export type BeltPromotionRow = InferSelectModel<typeof beltPromotions>;
export type ManagerSubscriptionRow = InferSelectModel<
  typeof managerSubscriptions
>;

function rid(): string {
  return faker.string.uuid();
}

function utcIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday (UTC) of the calendar week containing `d` (ISO week: Monday–Sunday). */
function utcMondayOfSameWeek(d: Date): string {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const day = new Date(t).getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  return new Date(t + delta * 86_400_000).toISOString().slice(0, 10);
}

export function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  const t = faker.date.recent({ days: 14 });
  return {
    id: rid(),
    clerkUserId: `clerk_${faker.string.alphanumeric({ length: 16 })}`,
    email: faker.internet.email(),
    name: faker.person.fullName(),
    profileImageUrl: null,
    phone:
      faker.helpers.maybe(() => faker.phone.number(), { probability: 0.3 }) ??
      null,
    instagram:
      faker.helpers.maybe(() => faker.internet.username(), {
        probability: 0.2,
      }) ?? null,
    birthDate:
      faker.helpers.maybe(() => utcIsoDate(faker.date.birthdate()), {
        probability: 0.4,
      }) ?? null,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    ...overrides,
  };
}

export function makeUserRole(overrides: Partial<UserRoleRow> = {}): UserRoleRow {
  const t = faker.date.recent({ days: 14 });
  return {
    id: rid(),
    userId: rid(),
    role: "student",
    isActive: true,
    startedAt: t,
    endedAt: null,
    ...overrides,
  };
}

export function makeAcademy(overrides: Partial<AcademyRow> = {}): AcademyRow {
  const t = faker.date.recent({ days: 14 });
  return {
    id: rid(),
    ownerId: rid(),
    name: `${faker.company.name()} Academy`,
    logoUrl: null,
    address:
      faker.helpers.maybe(() => faker.location.streetAddress(), {
        probability: 0.6,
      }) ?? null,
    contactEmail:
      faker.helpers.maybe(() => faker.internet.email(), {
        probability: 0.5,
      }) ?? null,
    contactPhone:
      faker.helpers.maybe(() => faker.phone.number(), {
        probability: 0.4,
      }) ?? null,
    foundedAt:
      faker.helpers.maybe(() => utcIsoDate(faker.date.past({ years: 20 })), {
        probability: 0.3,
      }) ?? null,
    pixKey: null,
    pixKeyType: null,
    createdAt: t,
    updatedAt: t,
    ...overrides,
  };
}

export function makeMembership(
  overrides: Partial<MembershipRow> = {},
): MembershipRow {
  const t = faker.date.recent({ days: 14 });
  return {
    id: rid(),
    academyId: rid(),
    userId: rid(),
    role: "student",
    status: "active",
    isActive: true,
    joinedAt: t,
    leftAt: null,
    createdAt: t,
    updatedAt: t,
    ...overrides,
  };
}

export function makeClass(overrides: Partial<ClassRow> = {}): ClassRow {
  const t = faker.date.recent({ days: 14 });
  return {
    id: rid(),
    academyId: rid(),
    instructorId: rid(),
    name: faker.commerce.productName(),
    description:
      faker.helpers.maybe(() => faker.lorem.sentence(), {
        probability: 0.5,
      }) ?? null,
    dayOfWeek: faker.number.int({ min: 0, max: 6 }),
    startTime: "18:00:00",
    endTime: "19:30:00",
    capacity: faker.number.int({ min: 8, max: 40 }),
    isActive: true,
    createdAt: t,
    updatedAt: t,
    ...overrides,
  };
}

export function makeCheckin(overrides: Partial<CheckinRow> = {}): CheckinRow {
  const sessionDay = faker.date.recent({ days: 28 });
  const t = faker.date.recent({ days: 3 });
  return {
    id: rid(),
    classId: rid(),
    userId: rid(),
    checkedInAt: t,
    date: utcIsoDate(sessionDay),
    weekReference: utcMondayOfSameWeek(sessionDay),
    ...overrides,
  };
}

export function makeSubscriptionPlan(
  overrides: Partial<SubscriptionPlanRow> = {},
): SubscriptionPlanRow {
  const t = faker.date.recent({ days: 14 });
  return {
    id: rid(),
    academyId: rid(),
    name: `${faker.commerce.productAdjective()} ${faker.commerce.product()}`,
    recurrenceMonths: faker.helpers.arrayElement([1, 3, 6, 12]),
    priceCents: faker.number.int({ min: 5_000, max: 50_000 }),
    weeklyCheckinLimit:
      faker.helpers.maybe(() => faker.number.int({ min: 1, max: 7 }), {
        probability: 0.5,
      }) ?? null,
    isActive: true,
    createdAt: t,
    updatedAt: t,
    ...overrides,
  };
}

export function makeStudentSubscription(
  overrides: Partial<StudentSubscriptionRow> = {},
): StudentSubscriptionRow {
  const t = faker.date.recent({ days: 14 });
  const starts = faker.date.soon({ days: 60 });
  const expires = faker.date.soon({ days: 120, refDate: starts });
  return {
    id: rid(),
    userId: rid(),
    planId: rid(),
    status: "active",
    startsAt: utcIsoDate(starts),
    expiresAt: utcIsoDate(expires),
    createdAt: t,
    updatedAt: t,
    ...overrides,
  };
}

export function makeManagerSubscription(
  overrides: Partial<ManagerSubscriptionRow> = {},
): ManagerSubscriptionRow {
  const t = faker.date.recent({ days: 14 });
  return {
    id: rid(),
    academyId: rid(),
    plan: "free",
    status: "active",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    subscribedAt: t,
    canceledAt: null,
    createdAt: t,
    updatedAt: t,
    ...overrides,
  };
}

export function makePayment(overrides: Partial<PaymentRow> = {}): PaymentRow {
  const t = faker.date.recent({ days: 14 });
  const ref = faker.date.recent({ days: 90 });
  return {
    id: rid(),
    subscriptionId: rid(),
    userId: rid(),
    academyId: rid(),
    amountCents: faker.number.int({ min: 5_000, max: 50_000 }),
    method: "manual",
    confirmedBy: rid(),
    stripePaymentId: null,
    referenceMonth: utcIsoDate(
      new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1)),
    ),
    notes:
      faker.helpers.maybe(() => faker.lorem.sentence(), {
        probability: 0.25,
      }) ?? null,
    paidAt: t,
    createdAt: t,
    ...overrides,
  };
}

export function makeBeltPromotion(
  overrides: Partial<BeltPromotionRow> = {},
): BeltPromotionRow {
  const t = faker.date.recent({ days: 14 });
  return {
    id: rid(),
    userId: rid(),
    academyId: rid(),
    promotedBy: rid(),
    belt: "white",
    stripes: 0,
    isCurrent: true,
    promotedAt: t,
    notes:
      faker.helpers.maybe(() => faker.lorem.sentence(), {
        probability: 0.2,
      }) ?? null,
    ...overrides,
  };
}
