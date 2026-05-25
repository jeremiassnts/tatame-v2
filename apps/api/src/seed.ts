/**
 * Seed script for development/test environment.
 *
 * Truncates all tables and inserts fresh realistic data.
 * Run with: pnpm --filter api seed
 */
import { faker } from "@faker-js/faker/locale/pt_BR";
import { loadEnv } from "@tatame/config";
import { sql } from "drizzle-orm";
import {
  academies,
  academyMemberships, beltPromotions, checkins, classes, createDb, dependents, managerSubscriptions, notifications, payments, studentSubscriptions, subscriptionPlans, userRoles, users
} from "@tatame/db";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);

const provider = "fightersbjj.com.br";
const studentCount = 80;
const managerEmail = env.MANAGER_EMAIL ?? faker.internet.email();
const managerClerkId = env.MANAGER_CLERK_ID ?? faker.string.uuid();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rid(): string {
  return faker.string.uuid();
}

function utcIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcMondayOfWeek(d: Date): string {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const day = new Date(t).getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  return new Date(t + delta * 86_400_000).toISOString().slice(0, 10);
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

function referenceMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

async function seed() {
  console.log("Seeding database...\n");

  // ── Truncate all tables ────────────────────────────────────────────────
  await db.execute(
    sql`TRUNCATE TABLE
      notifications, custom_notification_sends, announcements,
      notification_preferences, engagement_milestones, push_tokens,
      pending_pix_payments, payments, checkins, student_subscriptions,
      manager_subscriptions, classes, dependents, belt_promotions,
      academy_memberships, user_roles, academies, users
    CASCADE`,
  );
  console.log("  Truncated all tables");

  // ── Manager (academy owner) ──────────────────────────────────────────
  const managerId = rid();
  await db.insert(users).values({
    id: managerId,
    clerkUserId: managerClerkId,
    email: managerEmail,
    name: "Rafael Silva",
    profileImageUrl: faker.image.personPortrait(),
    phone: faker.phone.number({ style: "national" }),
    instagram: "rafasilva_bjj",
    birthDate: "1985-03-12",
  });
  await db.insert(userRoles).values({
    id: rid(),
    userId: managerId,
    role: "manager",
    isActive: true,
  });
  console.log(`  Manager: Rafael Silva (${managerClerkId})`);

  // ── Academy ──────────────────────────────────────────────────────────
  const academyId = rid();
  await db.insert(academies).values({
    id: academyId,
    ownerId: managerId,
    name: "Fighter's BJJ",
    address: faker.location.streetAddress(),
    contactEmail: "contato@fightersbjj.com.br",
    contactPhone: faker.phone.number({ style: "national" }),
    foundedAt: "2018-06-15",
  });

  // Manager membership
  await db.insert(academyMemberships).values({
    id: rid(),
    academyId,
    userId: managerId,
    role: "manager",
    status: "active",
    isActive: true, // manager has user_roles, membership tracks association
    joinedAt: new Date("2018-06-15"),
  });

  // Manager subscription (pro)
  const now = new Date();
  await db.insert(managerSubscriptions).values({
    academyId,
    plan: "pro",
    status: "active",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    currentPeriodEnd: addMonths(now, 1),
    subscribedAt: new Date("2024-07-01"),
  });

  console.log(`  Academy: Alliance Jiu-Jitsu Copacabana`);

  // ── Instructors ──────────────────────────────────────────────────────
  const instructorNames = [
    { name: "Carlos Eduardo Souza", instagram: "carlosedu_bjj" },
    { name: "Fernanda Lima", instagram: "fernanda.jiujitsu" },
  ];

  const instructorIds: string[] = [];
  for (const inst of instructorNames) {
    const id = rid();
    const clerkId = `clerk_seed_inst_${faker.string.alphanumeric(10)}`;
    instructorIds.push(id);

    await db.insert(users).values({
      id,
      clerkUserId: clerkId,
      email: faker.internet.email({
        firstName: inst.name.split(" ")[0],
        lastName: inst.name.split(" ").slice(-1)[0],
        provider,
      }),
      name: inst.name,
      phone: faker.phone.number({ style: "national" }),
      instagram: inst.instagram,
      birthDate: utcIsoDate(faker.date.birthdate({ min: 25, max: 45, mode: "age" })),
      profileImageUrl: faker.image.personPortrait(),
    });

    await db.insert(userRoles).values({
      id: rid(),
      userId: id,
      role: "instructor",
      isActive: true,
    });

    await db.insert(academyMemberships).values({
      id: rid(),
      academyId,
      userId: id,
      role: "instructor",
      status: "active",
      isActive: true,
      joinedAt: faker.date.past({ years: 3 }),
    });

    // Instructors are black belts
    await db.insert(beltPromotions).values({
      id: rid(),
      userId: id,
      academyId,
      promotedBy: managerId,
      belt: "black",
      stripes: faker.number.int({ min: 0, max: 3 }),
      isCurrent: true,
      promotedAt: faker.date.past({ years: 2 }),
      notes: "Faixa preta registrada na federação",
    });

    console.log(`  Instructor: ${inst.name} (${clerkId})`);
  }

  // ── Subscription Plans ───────────────────────────────────────────────
  const planBasicId = rid();
  const planFullId = rid();
  const planKidsId = rid();

  await db.insert(subscriptionPlans).values([
    {
      id: planBasicId,
      academyId,
      name: "Básico",
      recurrenceMonths: 1,
      priceCents: 15000,
      weeklyCheckinLimit: 3,
      isActive: true,
    },
    {
      id: planFullId,
      academyId,
      name: "Completo",
      recurrenceMonths: 1,
      priceCents: 25000,
      weeklyCheckinLimit: null, // unlimited
      isActive: true,
    },
    {
      id: planKidsId,
      academyId,
      name: "Kids",
      recurrenceMonths: 1,
      priceCents: 12000,
      weeklyCheckinLimit: 2,
      isActive: true,
    },
  ]);

  console.log(`  Plans: Básico (R$150), Completo (R$250), Kids (R$120)`);

  // ── Classes (weekly schedule) ────────────────────────────────────────
  const classSchedule = [
    { name: "Fundamentos", day: 1, start: "07:00:00", end: "08:30:00", inst: 0, cap: 25 },
    { name: "Fundamentos", day: 3, start: "07:00:00", end: "08:30:00", inst: 0, cap: 25 },
    { name: "Fundamentos", day: 5, start: "07:00:00", end: "08:30:00", inst: 0, cap: 25 },
    { name: "All Levels", day: 1, start: "19:00:00", end: "20:30:00", inst: 0, cap: 30 },
    { name: "All Levels", day: 3, start: "19:00:00", end: "20:30:00", inst: 0, cap: 30 },
    { name: "Avançado", day: 2, start: "19:00:00", end: "20:30:00", inst: 0, cap: 20 },
    { name: "Avançado", day: 4, start: "19:00:00", end: "20:30:00", inst: 0, cap: 20 },
    { name: "No-Gi", day: 5, start: "19:00:00", end: "20:30:00", inst: 1, cap: 25 },
    { name: "Kids Jiu-Jitsu", day: 2, start: "16:00:00", end: "17:00:00", inst: 1, cap: 20 },
    { name: "Kids Jiu-Jitsu", day: 4, start: "16:00:00", end: "17:00:00", inst: 1, cap: 20 },
    { name: "Open Mat", day: 6, start: "10:00:00", end: "12:00:00", inst: 0, cap: 40 },
  ];

  const classIds: string[] = [];
  for (const c of classSchedule) {
    const id = rid();
    classIds.push(id);
    await db.insert(classes).values({
      id,
      academyId,
      instructorId: instructorIds[c.inst]!,
      name: c.name,
      description: null,
      dayOfWeek: c.day,
      startTime: c.start,
      endTime: c.end,
      capacity: c.cap,
      isActive: true,
    });
  }
  console.log(`  Classes: ${classSchedule.length} aulas semanais`);

  // ── Students ─────────────────────────────────────────────────────────
  const belts: Array<{ belt: "white" | "blue" | "purple" | "brown"; stripes: number }> = [
    { belt: "white", stripes: 0 }, { belt: "white", stripes: 1 },
    { belt: "white", stripes: 2 }, { belt: "white", stripes: 3 },
    { belt: "white", stripes: 4 }, { belt: "blue", stripes: 0 },
    { belt: "blue", stripes: 1 }, { belt: "blue", stripes: 2 },
    { belt: "blue", stripes: 3 }, { belt: "blue", stripes: 4 },
    { belt: "purple", stripes: 0 }, { belt: "purple", stripes: 1 },
    { belt: "purple", stripes: 2 }, { belt: "brown", stripes: 0 },
    { belt: "brown", stripes: 1 },
  ];

  const studentIds: string[] = [];
  const studentPlanIds: string[] = [];

  for (let i = 0; i < studentCount; i++) {
    const id = rid();
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const fullName = `${firstName} ${lastName}`;
    const clerkId = `clerk_seed_stu_${faker.string.alphanumeric(10)}`;
    studentIds.push(id);

    const isKid = i >= studentCount - 3; // last 3 are kids
    const plan = isKid ? planKidsId : i % 3 === 0 ? planBasicId : planFullId;
    studentPlanIds.push(plan);

    await db.insert(users).values({
      id,
      clerkUserId: clerkId,
      email: `${firstName.toLowerCase()}${i}.${lastName.toLowerCase()}@${provider}`,
      name: fullName,
      phone: faker.phone.number({ style: "national" }),
      instagram: faker.helpers.maybe(
        () => `${firstName.toLowerCase()}_${faker.string.alphanumeric(4)}`,
        { probability: 0.5 },
      ) ?? null,
      birthDate: utcIsoDate(
        isKid
          ? faker.date.birthdate({ min: 6, max: 14, mode: "age" })
          : faker.date.birthdate({ min: 18, max: 55, mode: "age" }),
      ),
      profileImageUrl: faker.image.personPortrait(),
    });

    await db.insert(userRoles).values({
      id: rid(),
      userId: id,
      role: "student",
      isActive: true,
    });

    // Some students are inactive (left the academy)
    const isActive = i < studentCount - 3;
    const joinedAt = faker.date.past({ years: 2 });

    await db.insert(academyMemberships).values({
      id: rid(),
      academyId,
      userId: id,
      role: "student",
      status: isActive ? "active" : "blocked",
      isActive,
      joinedAt,
      leftAt: isActive ? null : faker.date.recent({ days: 60 }),
    });

    // Belt promotions
    const beltData = belts[i % belts.length]!;
    await db.insert(beltPromotions).values({
      id: rid(),
      userId: id,
      academyId,
      promotedBy: instructorIds[0]!,
      belt: beltData.belt,
      stripes: beltData.stripes,
      isCurrent: true,
      promotedAt: faker.date.past({ years: 1 }),
      notes: faker.helpers.maybe(
        () => faker.helpers.arrayElement([
          "Boa evolução nos treinos",
          "Destaque em competição",
          "Promoção por tempo de treino",
          "Excelente técnica de guarda",
        ]),
        { probability: 0.3 },
      ) ?? null,
    });

    // Student subscriptions (active students only)
    if (isActive) {
      const startsAt = faker.date.past({ years: 1 });
      const subId = rid();
      const recurrence = plan === planBasicId ? 1 : plan === planFullId ? 1 : 1;

      await db.insert(studentSubscriptions).values({
        id: subId,
        userId: id,
        planId: plan,
        status: "active",
        startsAt: utcIsoDate(startsAt),
        expiresAt: utcIsoDate(addMonths(now, recurrence)),
      });

      // Payments for the last 3 months
      for (let m = 2; m >= 0; m--) {
        // skip last payment for last 5 students to create pending payments
        if (i >= studentCount - 5 && m === 0) continue;

        const payDate = new Date(now);
        payDate.setMonth(payDate.getMonth() - m);
        payDate.setDate(faker.number.int({ min: 1, max: 10 }));

        const planPrice = plan === planBasicId ? 15000 : plan === planFullId ? 25000 : 12000;

        await db.insert(payments).values({
          id: rid(),
          subscriptionId: subId,
          userId: id,
          academyId,
          amountCents: planPrice,
          method: "manual",
          confirmedBy: managerId,
          referenceMonth: referenceMonth(payDate),
          paidAt: payDate,
        });
      }
    }
  }
  console.log(`  Students: ${studentCount} (${studentIds.filter((_, i) => i < studentCount - 3).length} active, 3 inactive)`);

  // ── Guardians with Dependents ──────────────────────────────────────────
  const kidBelts: Array<{ belt: "grey_white" | "grey" | "yellow_white" | "yellow" | "orange_white" | "orange"; stripes: number }> = [
    { belt: "grey_white", stripes: 0 },
    { belt: "grey_white", stripes: 2 },
    { belt: "grey", stripes: 1 },
    { belt: "yellow_white", stripes: 0 },
    { belt: "yellow", stripes: 3 },
    { belt: "orange_white", stripes: 0 },
  ];

  const guardianData = [
    { name: "Ana Carolina Mendes", dependents: ["Lucas Mendes", "Sofia Mendes"] },
    { name: "Pedro Augusto Lima", dependents: ["Mateus Lima"] },
    { name: "Juliana Ferreira Costa", dependents: ["Davi Costa", "Laura Costa", "Miguel Costa"] },
  ];

  const allDependentIds: string[] = [];
  const dependentOwnerMap: Record<string, string> = {}; // dependentId → guardianUserId
  const dependentSubIds: string[] = [];

  for (const g of guardianData) {
    const guardianId = rid();
    const clerkId = `clerk_seed_guard_${faker.string.alphanumeric(10)}`;

    await db.insert(users).values({
      id: guardianId,
      clerkUserId: clerkId,
      email: faker.internet.email({
        firstName: g.name.split(" ")[0],
        lastName: g.name.split(" ").slice(-1)[0],
        provider,
      }),
      name: g.name,
      phone: faker.phone.number({ style: "national" }),
      birthDate: utcIsoDate(faker.date.birthdate({ min: 30, max: 50, mode: "age" })),
      profileImageUrl: faker.image.personPortrait(),
    });

    await db.insert(userRoles).values({
      id: rid(),
      userId: guardianId,
      role: "guardian",
      isActive: true,
    });

    await db.insert(academyMemberships).values({
      id: rid(),
      academyId,
      userId: guardianId,
      role: "guardian",
      status: "active",
      isActive: true,
      joinedAt: faker.date.past({ years: 1 }),
    });

    console.log(`  Guardian: ${g.name} (${clerkId})`);

    for (let di = 0; di < g.dependents.length; di++) {
      const depName = g.dependents[di]!;
      const depId = rid();
      allDependentIds.push(depId);

      dependentOwnerMap[depId] = guardianId;

      await db.insert(dependents).values({
        id: depId,
        guardianId,
        academyId,
        name: depName,
        birthDate: utcIsoDate(faker.date.birthdate({ min: 5, max: 14, mode: "age" })),
      });

      // Belt for dependent
      const beltData = kidBelts[di % kidBelts.length]!;
      await db.insert(beltPromotions).values({
        id: rid(),
        userId: guardianId,
        academyId,
        promotedBy: instructorIds[0]!,
        dependentId: depId,
        belt: beltData.belt,
        stripes: beltData.stripes,
        isCurrent: true,
        promotedAt: faker.date.past({ years: 1 }),
        notes: null,
      });

      // Subscription for dependent (Kids plan)
      const depSubId = rid();
      dependentSubIds.push(depSubId);
      const depStartsAt = faker.date.past({ years: 1 });

      await db.insert(studentSubscriptions).values({
        id: depSubId,
        userId: guardianId,
        planId: planKidsId,
        dependentId: depId,
        status: "active",
        startsAt: utcIsoDate(depStartsAt),
        expiresAt: utcIsoDate(addMonths(now, 1)),
      });

      // Payments for dependent (last 3 months)
      for (let m = 2; m >= 0; m--) {
        const payDate = new Date(now);
        payDate.setMonth(payDate.getMonth() - m);
        payDate.setDate(faker.number.int({ min: 1, max: 10 }));

        await db.insert(payments).values({
          id: rid(),
          subscriptionId: depSubId,
          userId: guardianId,
          academyId,
          dependentId: depId,
          amountCents: 12000,
          method: "manual",
          confirmedBy: managerId,
          referenceMonth: referenceMonth(payDate),
          paidAt: payDate,
        });
      }

      console.log(`    Dependent: ${depName} (${beltData.belt}, ${beltData.stripes} graus)`);
    }
  }

  // ── Students with Dependents (students who also have kids) ─────────────
  // Pick 2 existing active students and give them dependents
  const studentsWithDeps = [
    { idx: 5, depName: "Isabela " + faker.person.lastName() },
    { idx: 12, depName: "Guilherme " + faker.person.lastName() },
  ];

  for (const sd of studentsWithDeps) {
    const studentId = studentIds[sd.idx]!;
    const depId = rid();
    allDependentIds.push(depId);

    dependentOwnerMap[depId] = studentId;

    await db.insert(dependents).values({
      id: depId,
      guardianId: studentId,
      academyId,
      name: sd.depName,
      birthDate: utcIsoDate(faker.date.birthdate({ min: 6, max: 12, mode: "age" })),
    });

    const beltData = kidBelts[Math.floor(Math.random() * kidBelts.length)]!;
    await db.insert(beltPromotions).values({
      id: rid(),
      userId: studentId,
      academyId,
      promotedBy: instructorIds[0]!,
      dependentId: depId,
      belt: beltData.belt,
      stripes: beltData.stripes,
      isCurrent: true,
      promotedAt: faker.date.past({ years: 1 }),
      notes: null,
    });

    const depSubId = rid();
    dependentSubIds.push(depSubId);
    const depStartsAt = faker.date.past({ years: 1 });

    await db.insert(studentSubscriptions).values({
      id: depSubId,
      userId: studentId,
      planId: planKidsId,
      dependentId: depId,
      status: "active",
      startsAt: utcIsoDate(depStartsAt),
      expiresAt: utcIsoDate(addMonths(now, 1)),
    });

    for (let m = 2; m >= 0; m--) {
      const payDate = new Date(now);
      payDate.setMonth(payDate.getMonth() - m);
      payDate.setDate(faker.number.int({ min: 1, max: 10 }));

      await db.insert(payments).values({
        id: rid(),
        subscriptionId: depSubId,
        userId: studentId,
        academyId,
        dependentId: depId,
        amountCents: 12000,
        method: "manual",
        confirmedBy: managerId,
        referenceMonth: referenceMonth(payDate),
        paidAt: payDate,
      });
    }

    console.log(`  Student+Dependent: student[${sd.idx}] → ${sd.depName} (${beltData.belt})`);
  }

  console.log(`  Total dependents: ${allDependentIds.length} (${guardianData.reduce((s, g) => s + g.dependents.length, 0)} from guardians, ${studentsWithDeps.length} from students)`);

  // ── Checkins (last 4 weeks) ──────────────────────────────────────────
  let checkinCount = 0;
  const activeStudentIds = studentIds.slice(0, studentCount - 3);

  for (let weeksAgo = 3; weeksAgo >= 0; weeksAgo--) {
    for (const studentId of activeStudentIds) {
      const studentIdx = studentIds.indexOf(studentId);
      const plan = studentPlanIds[studentIdx];
      const maxPerWeek = plan === planBasicId ? 3 : plan === planKidsId ? 2 : 5;
      const sessionsThisWeek = faker.number.int({ min: 1, max: maxPerWeek });

      // Pick random classes for this student this week
      const isKid = studentIdx >= studentCount - 3;
      const eligibleClasses = isKid
        ? classIds.filter((_, ci) => classSchedule[ci]!.name === "Kids Jiu-Jitsu")
        : classIds.filter((_, ci) => classSchedule[ci]!.name !== "Kids Jiu-Jitsu");

      const selectedClasses = faker.helpers.arrayElements(
        eligibleClasses,
        Math.min(sessionsThisWeek, eligibleClasses.length),
      );

      for (const classId of selectedClasses) {
        const classIdx = classIds.indexOf(classId);
        const classDay = classSchedule[classIdx]!.day;

        const d = new Date(now);
        d.setDate(d.getDate() - weeksAgo * 7);
        // Adjust to the correct day of week
        const currentDay = d.getUTCDay();
        const diff = classDay - currentDay;
        d.setDate(d.getDate() + diff);

        // Skip future dates
        if (d > now) continue;

        const dateStr = utcIsoDate(d);
        const weekRef = utcMondayOfWeek(d);

        await db.insert(checkins).values({
          id: rid(),
          classId,
          userId: studentId,
          checkedInAt: d,
          date: dateStr,
          weekReference: weekRef,
        });
        checkinCount++;
      }
    }
  }
  // Dependent checkins (Kids classes only)
  const kidsClassIds = classIds.filter((_, ci) => classSchedule[ci]!.name === "Kids Jiu-Jitsu");

  for (let weeksAgo = 3; weeksAgo >= 0; weeksAgo--) {
    for (const depId of allDependentIds) {
      const sessionsThisWeek = faker.number.int({ min: 1, max: 2 });
      const selectedClasses = faker.helpers.arrayElements(
        kidsClassIds,
        Math.min(sessionsThisWeek, kidsClassIds.length),
      );

      for (const classId of selectedClasses) {
        const classIdx = classIds.indexOf(classId);
        const classDay = classSchedule[classIdx]!.day;

        const d = new Date(now);
        d.setDate(d.getDate() - weeksAgo * 7);
        const currentDay = d.getUTCDay();
        const diff = classDay - currentDay;
        d.setDate(d.getDate() + diff);

        if (d > now) continue;

        const dateStr = utcIsoDate(d);
        const weekRef = utcMondayOfWeek(d);

        const inserted = await db.insert(checkins).values({
          id: rid(),
          classId,
          userId: dependentOwnerMap[depId]!,
          dependentId: depId,
          checkedInAt: d,
          date: dateStr,
          weekReference: weekRef,
        }).onConflictDoNothing().returning();
        if (inserted.length > 0) checkinCount++;
      }
    }
  }

  console.log(`  Checkins: ${checkinCount} nos últimos 28 dias (inclui dependentes)`);

  // ── Pending membership request ───────────────────────────────────────
  const pendingId = rid();
  const pendingClerkId = `clerk_seed_pending_${faker.string.alphanumeric(10)}`;
  await db.insert(users).values({
    id: pendingId,
    clerkUserId: pendingClerkId,
    email: faker.internet.email({
      firstName: "Marcos",
      lastName: "Oliveira",
      provider,
    }),
    name: "Marcos Oliveira",
    phone: faker.phone.number({ style: "national" }),
    birthDate: "1992-08-20",
    profileImageUrl: faker.image.personPortrait(),
  });
  await db.insert(userRoles).values({
    id: rid(),
    userId: pendingId,
    role: "student",
    isActive: true,
  });
  await db.insert(academyMemberships).values({
    id: rid(),
    academyId,
    userId: pendingId,
    role: "student",
    status: "pending",
    isActive: false,
  });
  console.log(`  Pending membership: Marcos Oliveira`);

  // ── Notifications ─────────────────────────────────────────────────────
  const notificationSamples: {
    recipientClerkId: string;
    title: string;
    body: string;
    category: "class_change" | "payment" | "belt_promotion" | "announcement" | "new_member" | "subscription_alert" | "checkin_anomaly" | "streak" | "inactivity" | "milestone" | "weekly_summary";
    readAt?: Date | null;
    daysAgo: number;
  }[] = [
    // Manager notifications
    {
      recipientClerkId: managerClerkId,
      title: "Novo membro pendente",
      body: "Marcos Oliveira solicitou entrada na academia. Aprove ou rejeite o pedido.",
      category: "new_member",
      daysAgo: 0,
    },
    {
      recipientClerkId: managerClerkId,
      title: "Pagamento em atraso",
      body: "3 alunos estão com pagamento pendente para o mês atual.",
      category: "payment",
      daysAgo: 1,
    },
    {
      recipientClerkId: managerClerkId,
      title: "Assinatura Pro ativa",
      body: "Sua assinatura Pro foi ativada com sucesso! Aproveite todos os recursos.",
      category: "subscription_alert",
      readAt: new Date(Date.now() - 5 * 86_400_000),
      daysAgo: 5,
    },
    {
      recipientClerkId: managerClerkId,
      title: "Resumo semanal",
      body: "Sua academia teve 156 check-ins e 3 novos alunos esta semana. Confira os detalhes.",
      category: "weekly_summary",
      readAt: new Date(Date.now() - 7 * 86_400_000),
      daysAgo: 7,
    },
    {
      recipientClerkId: managerClerkId,
      title: "Anomalia de check-in",
      body: "João Pedro tentou fazer check-in fora do horário permitido na aula de Fundamentos.",
      category: "checkin_anomaly",
      daysAgo: 2,
    },
    {
      recipientClerkId: managerClerkId,
      title: "Aula alterada",
      body: "A aula de No-Gi de sexta-feira foi movida para 20:00.",
      category: "class_change",
      readAt: new Date(Date.now() - 3 * 86_400_000),
      daysAgo: 3,
    },
    {
      recipientClerkId: managerClerkId,
      title: "Marco atingido! 🎉",
      body: "Sua academia atingiu 80 membros ativos. Parabéns pelo crescimento!",
      category: "milestone",
      daysAgo: 4,
    },
    {
      recipientClerkId: managerClerkId,
      title: "Aluno inativo",
      body: "Lucas Ferreira não treina há 14 dias. Considere entrar em contato.",
      category: "inactivity",
      daysAgo: 1,
    },
    {
      recipientClerkId: managerClerkId,
      title: "Faixa azul! 🥋",
      body: "Maria Silva foi promovida para faixa azul por Carlos Eduardo.",
      category: "belt_promotion",
      daysAgo: 6,
    },
    {
      recipientClerkId: managerClerkId,
      title: "Anúncio da federação",
      body: "Campeonato Estadual de Jiu-Jitsu: inscrições abertas até 15 de maio.",
      category: "announcement",
      readAt: new Date(Date.now() - 10 * 86_400_000),
      daysAgo: 10,
    },
  ];

  for (const n of notificationSamples) {
    const createdAt = new Date(Date.now() - n.daysAgo * 86_400_000);
    await db.insert(notifications).values({
      id: rid(),
      recipientId: n.recipientClerkId,
      title: n.title,
      body: n.body,
      category: n.category,
      academyId,
      status: "sent",
      sentAt: createdAt,
      readAt: n.readAt ?? null,
      createdAt,
    });
  }
  console.log(`  Notifications: ${notificationSamples.length} for manager`);

  console.log("\nSeed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
