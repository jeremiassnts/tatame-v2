# Engagement Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scheduled engagement notifications (weekly summary, inactivity nudge) via BullMQ cron jobs, and event-driven milestone celebrations after check-ins, with quiet hours and rate limiting.

**Architecture:** Two BullMQ repeatable jobs (weekly-summary on Mondays 09:00 BRT, inactivity-nudge on Sundays 09:00 BRT) query eligible users and dispatch notifications via the existing NotificationService. Milestones are checked synchronously after each check-in in CheckinService. A new `engagement_milestones` table tracks which milestones have been sent per user (deduplication). Quiet hours (22:00-08:00 BRT) are enforced by delaying BullMQ jobs. Rate limiting (max 2 engagement notifications/user/day) is checked before sending.

**Tech Stack:** BullMQ repeatable jobs, Drizzle ORM, existing NotificationService/NotificationDispatcher, Redis.

---

## File Structure

### New files
- **Create:** `apps/api/src/modules/engagement/engagement.queue.ts` — BullMQ queue + repeatable job setup
- **Create:** `apps/api/src/modules/engagement/engagement.worker.ts` — Worker processing weekly-summary and inactivity-nudge jobs
- **Create:** `apps/api/src/modules/engagement/engagement.service.ts` — Business logic for each engagement type
- **Create:** `apps/api/src/modules/engagement/engagement.service.test.ts` — Unit tests

### Modified files
- **Modify:** `packages/db/src/schema/index.ts` — Add `engagementMilestones` table
- **Modify:** `apps/api/src/modules/notification/notification-templates.ts` — Add engagement templates
- **Modify:** `apps/api/src/modules/checkin/checkin.repository.ts` — Add `countTotalByUser()`, `getWeeklyCheckinSummaries()`, `findInactiveUserIds()`
- **Modify:** `apps/api/src/modules/checkin/checkin.repository.postgres.ts` — Implement new methods
- **Modify:** `apps/api/src/modules/checkin/checkin.service.ts` — Add milestone check after check-in
- **Modify:** `apps/api/src/modules/notification/notification.repository.ts` — Add `countTodayByRecipientAndCategories()`
- **Modify:** `apps/api/src/modules/notification/notification.repository.postgres.ts` — Implement rate limit query
- **Modify:** `apps/api/src/modules/notification/notification.repository.in-memory.ts` — Implement rate limit query
- **Modify:** `apps/api/src/server.ts` — Start engagement worker + add queue to Bull Board
- **Modify:** `apps/api/src/testing/factories/index.ts` — Add `makeEngagementMilestone` factory

---

## Task 1: DB schema — engagement milestones table + new templates

**Files:**
- Modify: `packages/db/src/schema/index.ts`
- Modify: `apps/api/src/modules/notification/notification-templates.ts`

- [ ] **Step 1: Add engagementMilestones table to schema**

Add to `packages/db/src/schema/index.ts` after the existing tables:

```typescript
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
```

- [ ] **Step 2: Generate migration**

```bash
cd packages/db && pnpm generate && pnpm build
```

- [ ] **Step 3: Add engagement templates**

Add to `notificationTemplates` in `apps/api/src/modules/notification/notification-templates.ts`:

```typescript
  weekly_summary: {
    title: "Resumo semanal",
    body: (count: string) =>
      `Você treinou ${count} ${Number(count) === 1 ? "vez" : "vezes"} esta semana — ótimo trabalho!`,
  },
  inactivity_nudge: {
    title: "Sentimos sua falta!",
    body: () =>
      "Não te vemos há 2 semanas — volte a treinar!",
  },
  milestone: {
    title: "Marco alcançado! 🥋",
    body: (count: string) =>
      `Você completou ${count} aulas! Parabéns pela dedicação!`,
  },
```

Add to `categoryForTemplateKey` map:

```typescript
    weekly_summary: "weekly_summary",
    inactivity_nudge: "inactivity",
    milestone: "milestone",
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/index.ts packages/db/drizzle/ apps/api/src/modules/notification/notification-templates.ts
git commit -m "feat(db): add engagement_milestones table and engagement templates (TAT-98)"
```

---

## Task 2: Checkin repository — new query methods

**Files:**
- Modify: `apps/api/src/modules/checkin/checkin.repository.ts`
- Modify: `apps/api/src/modules/checkin/checkin.repository.postgres.ts`

- [ ] **Step 1: Add methods to ICheckinRepository interface**

Add to `apps/api/src/modules/checkin/checkin.repository.ts`:

```typescript
  countTotalByUser(userId: string): Promise<number>;

  /** Returns [{userId, count}] for all users who had ≥1 checkin in the given week */
  getWeeklyCheckinSummaries(weekReference: string): Promise<{ userId: string; count: number }[]>;

  /** Returns userIds whose last checkin was before the given date */
  findInactiveUserIds(beforeDate: string): Promise<string[]>;
```

- [ ] **Step 2: Implement in Postgres**

Add to `apps/api/src/modules/checkin/checkin.repository.postgres.ts`:

```typescript
  async countTotalByUser(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ c: count() })
      .from(checkins)
      .where(eq(checkins.userId, userId));
    return Number(row?.c ?? 0);
  }

  async getWeeklyCheckinSummaries(weekReference: string): Promise<{ userId: string; count: number }[]> {
    const rows = await this.db
      .select({
        userId: checkins.userId,
        count: count(),
      })
      .from(checkins)
      .where(eq(checkins.weekReference, weekReference))
      .groupBy(checkins.userId);
    return rows.map((r) => ({ userId: r.userId, count: Number(r.count) }));
  }

  async findInactiveUserIds(beforeDate: string): Promise<string[]> {
    const rows = await this.db
      .select({
        userId: checkins.userId,
      })
      .from(checkins)
      .groupBy(checkins.userId)
      .having(sql`max(${checkins.date}) < ${beforeDate}`);
    return rows.map((r) => r.userId);
  }
```

Add `sql` to the drizzle-orm import if not already there.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/checkin/checkin.repository.ts apps/api/src/modules/checkin/checkin.repository.postgres.ts
git commit -m "feat(api): add checkin query methods for engagement notifications (TAT-98)"
```

---

## Task 3: Notification repository — rate limiting query

**Files:**
- Modify: `apps/api/src/modules/notification/notification.repository.ts`
- Modify: `apps/api/src/modules/notification/notification.repository.postgres.ts`
- Modify: `apps/api/src/modules/notification/notification.repository.in-memory.ts`

- [ ] **Step 1: Add method to INotificationRepository**

Add to `apps/api/src/modules/notification/notification.repository.ts`:

```typescript
  countTodayByRecipientAndCategories(
    recipientId: string,
    categories: NotificationRow["category"][],
  ): Promise<number>;
```

- [ ] **Step 2: Implement in Postgres**

Add to `apps/api/src/modules/notification/notification.repository.postgres.ts`:

```typescript
  async countTodayByRecipientAndCategories(
    recipientId: string,
    categories: NotificationRow["category"][],
  ): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [row] = await this.db
      .select({ c: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          inArray(notifications.category, categories),
          gte(notifications.createdAt, todayStart),
        ),
      );
    return Number(row?.c ?? 0);
  }
```

Add `count`, `gte`, `inArray` to the drizzle-orm import if not already there.

- [ ] **Step 3: Implement in in-memory**

Add to `apps/api/src/modules/notification/notification.repository.in-memory.ts`:

```typescript
  async countTodayByRecipientAndCategories(
    recipientId: string,
    categories: NotificationRow["category"][],
  ): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.rows.filter(
      (r) =>
        r.recipientId === recipientId &&
        categories.includes(r.category) &&
        r.createdAt >= todayStart,
    ).length;
  }
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/notification/notification.repository.ts apps/api/src/modules/notification/notification.repository.postgres.ts apps/api/src/modules/notification/notification.repository.in-memory.ts
git commit -m "feat(api): add engagement rate limiting query to notification repository (TAT-98)"
```

---

## Task 4: Engagement service + tests

**Files:**
- Create: `apps/api/src/modules/engagement/engagement.service.ts`
- Create: `apps/api/src/modules/engagement/engagement.service.test.ts`
- Modify: `apps/api/src/testing/factories/index.ts`

- [ ] **Step 1: Add factory to test helpers**

Add import and type to `apps/api/src/testing/factories/index.ts`:

```typescript
import { engagementMilestones } from "@tatame/db";
export type EngagementMilestoneRow = InferSelectModel<typeof engagementMilestones>;
```

Add factory:

```typescript
export function makeEngagementMilestone(
  overrides: Partial<EngagementMilestoneRow> = {},
): EngagementMilestoneRow {
  return {
    id: rid(),
    userId: rid(),
    milestone: 100,
    notifiedAt: faker.date.recent({ days: 14 }),
    ...overrides,
  };
}
```

- [ ] **Step 2: Create engagement service**

Create `apps/api/src/modules/engagement/engagement.service.ts`:

```typescript
import { logger } from "../../lib/logger.js";
import type { NotificationService } from "../notification/notification.service.js";
import type { INotificationRepository } from "../notification/notification.repository.js";
import type { ICheckinRepository } from "../checkin/checkin.repository.js";
import type { IUserRepository } from "../user/user.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { IStudentSubscriptionRepository } from "../subscription/subscription.repository.js";
import { getTemplate, categoryForTemplateKey } from "../notification/notification-templates.js";

const ENGAGEMENT_CATEGORIES = [
  "weekly_summary",
  "inactivity",
  "milestone",
  "streak",
] as const;

const MAX_ENGAGEMENT_PER_DAY = 2;

const MILESTONES = [50, 100, 200, 500, 1000];

export class EngagementService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationRepo: INotificationRepository,
    private readonly checkinRepo: ICheckinRepository,
    private readonly userRepo: IUserRepository,
    private readonly membershipRepo: IMembershipRepository,
    private readonly milestoneRepo: IMilestoneRepository,
  ) {}

  /**
   * Weekly summary: for each user who had ≥1 checkin last week, send a summary.
   * Called by cron on Mondays 09:00 BRT.
   */
  async processWeeklySummary(): Promise<number> {
    const lastMonday = this.getLastMonday();
    const summaries = await this.checkinRepo.getWeeklyCheckinSummaries(lastMonday);
    let sent = 0;

    for (const { userId, count } of summaries) {
      try {
        const clerkId = await this.userRepo.findClerkIdByInternalId(userId);
        if (!clerkId) continue;

        if (await this.isRateLimited(clerkId)) continue;

        const template = getTemplate("weekly_summary")!;
        await this.notificationService.send({
          recipientIds: [clerkId],
          title: template.title,
          body: template.body(String(count)),
          category: categoryForTemplateKey("weekly_summary"),
        });
        sent++;
      } catch (err) {
        logger.error({ err, userId }, "[engagement] Failed to send weekly summary");
      }
    }

    logger.info({ sent, total: summaries.length }, "[engagement] Weekly summary processed");
    return sent;
  }

  /**
   * Inactivity nudge: for users whose last checkin was >14 days ago and who have an active sub.
   * Called by cron on Sundays 09:00 BRT.
   */
  async processInactivityNudge(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 14);
    const cutoff = cutoffDate.toISOString().slice(0, 10);

    const inactiveUserIds = await this.checkinRepo.findInactiveUserIds(cutoff);
    let sent = 0;

    for (const userId of inactiveUserIds) {
      try {
        // Check if user has an active membership (skip users who left)
        const membership = await this.membershipRepo.findActiveByUser(userId);
        if (!membership || membership.status !== "active") continue;

        const clerkId = await this.userRepo.findClerkIdByInternalId(userId);
        if (!clerkId) continue;

        if (await this.isRateLimited(clerkId)) continue;

        const template = getTemplate("inactivity_nudge")!;
        await this.notificationService.send({
          recipientIds: [clerkId],
          title: template.title,
          body: template.body(),
          category: categoryForTemplateKey("inactivity_nudge"),
        });
        sent++;
      } catch (err) {
        logger.error({ err, userId }, "[engagement] Failed to send inactivity nudge");
      }
    }

    logger.info({ sent, total: inactiveUserIds.length }, "[engagement] Inactivity nudge processed");
    return sent;
  }

  /**
   * Milestone check: after a checkin, check if user hit a milestone.
   * Called synchronously from CheckinService.
   */
  async checkMilestone(userId: string): Promise<void> {
    try {
      const totalCheckins = await this.checkinRepo.countTotalByUser(userId);

      if (!MILESTONES.includes(totalCheckins)) return;

      const alreadySent = await this.milestoneRepo.exists(userId, totalCheckins);
      if (alreadySent) return;

      const clerkId = await this.userRepo.findClerkIdByInternalId(userId);
      if (!clerkId) return;

      if (await this.isRateLimited(clerkId)) return;

      const template = getTemplate("milestone")!;
      await this.notificationService.send({
        recipientIds: [clerkId],
        title: template.title,
        body: template.body(String(totalCheckins)),
        category: categoryForTemplateKey("milestone"),
      });

      await this.milestoneRepo.record(userId, totalCheckins);
    } catch (err) {
      logger.error({ err, userId }, "[engagement] Failed to check milestone");
    }
  }

  private async isRateLimited(clerkId: string): Promise<boolean> {
    const todayCount = await this.notificationRepo.countTodayByRecipientAndCategories(
      clerkId,
      [...ENGAGEMENT_CATEGORIES] as any,
    );
    return todayCount >= MAX_ENGAGEMENT_PER_DAY;
  }

  private getLastMonday(): string {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(now.getUTCDate() - diff - 7);
    return lastMonday.toISOString().slice(0, 10);
  }
}

export interface IMilestoneRepository {
  exists(userId: string, milestone: number): Promise<boolean>;
  record(userId: string, milestone: number): Promise<void>;
}
```

- [ ] **Step 3: Create milestone repository implementations**

Add to the same file (or create separate files — keeping it in engagement.service.ts for simplicity since it's small):

Actually, let's create separate files for clarity.

Create `apps/api/src/modules/engagement/milestone.repository.ts`:

```typescript
export interface IMilestoneRepository {
  exists(userId: string, milestone: number): Promise<boolean>;
  record(userId: string, milestone: number): Promise<void>;
}
```

Create `apps/api/src/modules/engagement/milestone.repository.postgres.ts`:

```typescript
import { and, eq } from "drizzle-orm";
import { engagementMilestones, type Database } from "@tatame/db";
import type { IMilestoneRepository } from "./milestone.repository.js";

export class PostgresMilestoneRepository implements IMilestoneRepository {
  constructor(private readonly db: Database) {}

  async exists(userId: string, milestone: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: engagementMilestones.id })
      .from(engagementMilestones)
      .where(
        and(
          eq(engagementMilestones.userId, userId),
          eq(engagementMilestones.milestone, milestone),
        ),
      )
      .limit(1);
    return !!row;
  }

  async record(userId: string, milestone: number): Promise<void> {
    await this.db
      .insert(engagementMilestones)
      .values({ userId, milestone })
      .onConflictDoNothing();
  }
}
```

Create `apps/api/src/modules/engagement/milestone.repository.in-memory.ts`:

```typescript
import type { IMilestoneRepository } from "./milestone.repository.js";

export class InMemoryMilestoneRepository implements IMilestoneRepository {
  private readonly records: { userId: string; milestone: number }[] = [];

  async exists(userId: string, milestone: number): Promise<boolean> {
    return this.records.some(
      (r) => r.userId === userId && r.milestone === milestone,
    );
  }

  async record(userId: string, milestone: number): Promise<void> {
    if (!await this.exists(userId, milestone)) {
      this.records.push({ userId, milestone });
    }
  }
}
```

Update `engagement.service.ts` — remove the `IMilestoneRepository` interface from the bottom (it's now in its own file) and import it:

```typescript
import type { IMilestoneRepository } from "./milestone.repository.js";
```

- [ ] **Step 4: Write tests**

Create `apps/api/src/modules/engagement/engagement.service.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { EngagementService } from "./engagement.service.js";
import { InMemoryMilestoneRepository } from "./milestone.repository.in-memory.js";

function setup() {
  const notificationService = {
    send: vi.fn().mockResolvedValue([]),
  };
  const notificationRepo = {
    countTodayByRecipientAndCategories: vi.fn().mockResolvedValue(0),
  };
  const checkinRepo = {
    getWeeklyCheckinSummaries: vi.fn().mockResolvedValue([]),
    findInactiveUserIds: vi.fn().mockResolvedValue([]),
    countTotalByUser: vi.fn().mockResolvedValue(0),
  };
  const userRepo = {
    findClerkIdByInternalId: vi.fn().mockResolvedValue("clerk_user_1"),
  };
  const membershipRepo = {
    findActiveByUser: vi.fn().mockResolvedValue({
      id: "m1",
      status: "active",
      role: "student",
      academyId: "a1",
    }),
  };
  const milestoneRepo = new InMemoryMilestoneRepository();

  const service = new EngagementService(
    notificationService as any,
    notificationRepo as any,
    checkinRepo as any,
    userRepo as any,
    membershipRepo as any,
    milestoneRepo,
  );

  return {
    service,
    notificationService,
    notificationRepo,
    checkinRepo,
    userRepo,
    membershipRepo,
    milestoneRepo,
  };
}

describe("EngagementService", () => {
  describe("processWeeklySummary", () => {
    it("sends summary to users who trained", async () => {
      const { service, checkinRepo, notificationService } = setup();
      checkinRepo.getWeeklyCheckinSummaries.mockResolvedValue([
        { userId: "u1", count: 3 },
        { userId: "u2", count: 1 },
      ]);

      const sent = await service.processWeeklySummary();

      expect(sent).toBe(2);
      expect(notificationService.send).toHaveBeenCalledTimes(2);
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Resumo semanal",
          category: "weekly_summary",
        }),
      );
    });

    it("skips users with no clerkId", async () => {
      const { service, checkinRepo, userRepo, notificationService } = setup();
      checkinRepo.getWeeklyCheckinSummaries.mockResolvedValue([
        { userId: "u1", count: 2 },
      ]);
      userRepo.findClerkIdByInternalId.mockResolvedValue(undefined);

      const sent = await service.processWeeklySummary();

      expect(sent).toBe(0);
      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it("respects rate limit", async () => {
      const { service, checkinRepo, notificationRepo, notificationService } = setup();
      checkinRepo.getWeeklyCheckinSummaries.mockResolvedValue([
        { userId: "u1", count: 2 },
      ]);
      notificationRepo.countTodayByRecipientAndCategories.mockResolvedValue(2);

      const sent = await service.processWeeklySummary();

      expect(sent).toBe(0);
      expect(notificationService.send).not.toHaveBeenCalled();
    });
  });

  describe("processInactivityNudge", () => {
    it("sends nudge to inactive users with active membership", async () => {
      const { service, checkinRepo, notificationService } = setup();
      checkinRepo.findInactiveUserIds.mockResolvedValue(["u1"]);

      const sent = await service.processInactivityNudge();

      expect(sent).toBe(1);
      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Sentimos sua falta!",
          category: "inactivity",
        }),
      );
    });

    it("skips users without active membership", async () => {
      const { service, checkinRepo, membershipRepo, notificationService } = setup();
      checkinRepo.findInactiveUserIds.mockResolvedValue(["u1"]);
      membershipRepo.findActiveByUser.mockResolvedValue(null);

      const sent = await service.processInactivityNudge();

      expect(sent).toBe(0);
      expect(notificationService.send).not.toHaveBeenCalled();
    });
  });

  describe("checkMilestone", () => {
    it("sends milestone notification at 100 checkins", async () => {
      const { service, checkinRepo, notificationService } = setup();
      checkinRepo.countTotalByUser.mockResolvedValue(100);

      await service.checkMilestone("u1");

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Marco alcançado! 🥋",
          body: "Você completou 100 aulas! Parabéns pela dedicação!",
          category: "milestone",
        }),
      );
    });

    it("skips non-milestone counts", async () => {
      const { service, checkinRepo, notificationService } = setup();
      checkinRepo.countTotalByUser.mockResolvedValue(99);

      await service.checkMilestone("u1");

      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it("deduplicates milestone notifications", async () => {
      const { service, checkinRepo, milestoneRepo, notificationService } = setup();
      checkinRepo.countTotalByUser.mockResolvedValue(100);
      await milestoneRepo.record("u1", 100);

      await service.checkMilestone("u1");

      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it("does not throw on error", async () => {
      const { service, checkinRepo, notificationService } = setup();
      checkinRepo.countTotalByUser.mockResolvedValue(100);
      notificationService.send.mockRejectedValue(new Error("boom"));

      await expect(service.checkMilestone("u1")).resolves.not.toThrow();
    });
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd apps/api && npx vitest run src/modules/engagement/engagement.service.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/engagement/ apps/api/src/testing/factories/index.ts
git commit -m "feat(api): add engagement service with weekly summary, inactivity nudge, milestones (TAT-98)"
```

---

## Task 5: Engagement queue + worker

**Files:**
- Create: `apps/api/src/modules/engagement/engagement.queue.ts`
- Create: `apps/api/src/modules/engagement/engagement.worker.ts`

- [ ] **Step 1: Create queue with repeatable jobs**

Create `apps/api/src/modules/engagement/engagement.queue.ts`:

```typescript
import { Queue } from "bullmq";

export type EngagementJobName = "weekly-summary" | "inactivity-nudge";

let engagementQueue: Queue | null = null;

export function getEngagementQueue(redisUrl: string): Queue {
  if (!engagementQueue) {
    engagementQueue = new Queue("engagement", {
      connection: { url: redisUrl },
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return engagementQueue;
}

/**
 * Register repeatable cron jobs.
 * Must be called once at server startup.
 * BRT = UTC-3 → 09:00 BRT = 12:00 UTC
 */
export async function registerEngagementJobs(redisUrl: string): Promise<void> {
  const queue = getEngagementQueue(redisUrl);

  // Weekly summary: Mondays 09:00 BRT (12:00 UTC)
  await queue.add("weekly-summary", {}, {
    repeat: { pattern: "0 12 * * 1" },
    jobId: "weekly-summary-repeatable",
  });

  // Inactivity nudge: Sundays 09:00 BRT (12:00 UTC)
  await queue.add("inactivity-nudge", {}, {
    repeat: { pattern: "0 12 * * 0" },
    jobId: "inactivity-nudge-repeatable",
  });
}

export async function closeEngagementQueue(): Promise<void> {
  if (engagementQueue) {
    await engagementQueue.close();
    engagementQueue = null;
  }
}
```

- [ ] **Step 2: Create worker**

Create `apps/api/src/modules/engagement/engagement.worker.ts`:

```typescript
import { Worker, type Job } from "bullmq";
import { logger } from "../../lib/logger.js";
import { getDb } from "../../lib/db.js";
import { loadEnv } from "@tatame/config";
import { PostgresNotificationRepository } from "../notification/notification.repository.postgres.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import { getNotificationQueue } from "../notification/notification.queue.js";
import { NotificationService } from "../notification/notification.service.js";
import { PostgresCheckinRepository } from "../checkin/checkin.repository.postgres.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { PostgresMembershipRepository } from "../membership/membership.repository.postgres.js";
import { PostgresMilestoneRepository } from "./milestone.repository.postgres.js";
import { EngagementService } from "./engagement.service.js";
import type { EngagementJobName } from "./engagement.queue.js";

function buildEngagementService(): EngagementService {
  const db = getDb();
  const env = loadEnv();
  const queue = env.REDIS_URL ? getNotificationQueue(env.REDIS_URL) : null;
  const notificationService = new NotificationService(
    new PostgresNotificationRepository(db),
    new PostgresPushTokenRepository(db),
    queue,
  );
  return new EngagementService(
    notificationService,
    new PostgresNotificationRepository(db),
    new PostgresCheckinRepository(db),
    new PostgresUserRepository(db),
    new PostgresMembershipRepository(db),
    new PostgresMilestoneRepository(db),
  );
}

async function processEngagementJob(job: Job): Promise<void> {
  const jobName = job.name as EngagementJobName;
  const service = buildEngagementService();

  switch (jobName) {
    case "weekly-summary":
      await service.processWeeklySummary();
      break;
    case "inactivity-nudge":
      await service.processInactivityNudge();
      break;
    default:
      logger.warn({ jobName }, "[engagement] Unknown job name");
  }
}

let engagementWorker: Worker | null = null;

export function startEngagementWorker(redisUrl: string): Worker {
  if (engagementWorker) return engagementWorker;

  engagementWorker = new Worker("engagement", processEngagementJob, {
    connection: { url: redisUrl },
    concurrency: 1,
  });

  engagementWorker.on("failed", (job, err) => {
    logger.error(
      { jobName: job?.name, jobId: job?.id, err: err.message },
      "[engagement] Job failed",
    );
  });

  return engagementWorker;
}

export async function closeEngagementWorker(): Promise<void> {
  if (engagementWorker) {
    await engagementWorker.close();
    engagementWorker = null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/engagement/engagement.queue.ts apps/api/src/modules/engagement/engagement.worker.ts
git commit -m "feat(api): add engagement BullMQ queue and worker (TAT-98)"
```

---

## Task 6: Wire engagement into server + milestone into checkin

**Files:**
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/modules/checkin/checkin.service.ts`
- Modify: `apps/api/src/modules/checkin/checkin.routes.ts`

- [ ] **Step 1: Wire engagement worker + queue into server.ts**

Add imports:

```typescript
import {
  closeEngagementQueue,
  getEngagementQueue,
  registerEngagementJobs,
} from "./modules/engagement/engagement.queue.js";
import {
  startEngagementWorker,
  closeEngagementWorker,
} from "./modules/engagement/engagement.worker.js";
```

Inside the `if (env.REDIS_URL)` block, after the notification worker start:

```typescript
  startEngagementWorker(env.REDIS_URL);
  await registerEngagementJobs(env.REDIS_URL);
  logger.info("[engagement] Worker started, cron jobs registered");
```

Update the Bull Board `createBullBoard` queues array to include the engagement queue:

```typescript
  createBullBoard({
    queues: [
      new BullMQAdapter(getEmailQueue(env.REDIS_URL)),
      new BullMQAdapter(getNotificationQueue(env.REDIS_URL)),
      new BullMQAdapter(getEngagementQueue(env.REDIS_URL)),
    ],
    serverAdapter,
  });
```

Update shutdown:

```typescript
  await closeEngagementWorker();
  await closeEngagementQueue();
```

- [ ] **Step 2: Add EngagementService to CheckinService for milestone**

In `apps/api/src/modules/checkin/checkin.service.ts`:

Add import:
```typescript
import type { EngagementService } from "../engagement/engagement.service.js";
```

Add optional param to constructor (after dispatcher):
```typescript
  constructor(
    private readonly membershipRepo: IMembershipRepository,
    private readonly classRepo: IClassRepository,
    private readonly studentSubRepo: IStudentSubscriptionRepository,
    private readonly paymentRepo: IPaymentRepository,
    private readonly checkinRepo: ICheckinRepository,
    private readonly dispatcher?: NotificationDispatcher,
    private readonly engagementService?: EngagementService,
  ) { }
```

After the checkin insert succeeds (after the anomaly notification block), add:

```typescript
        // Check for milestone achievement
        if (this.engagementService) {
          this.engagementService.checkMilestone(opts.userId);
        }
```

Note: No await — fire-and-forget.

- [ ] **Step 3: Wire EngagementService in checkin routes**

Read `apps/api/src/modules/checkin/checkin.routes.ts` and add the EngagementService as the 7th param to CheckinService.

Add imports:
```typescript
import { PostgresNotificationRepository } from "../notification/notification.repository.postgres.js";
import { PostgresPushTokenRepository } from "../push-token/push-token.repository.postgres.js";
import { getNotificationQueue } from "../notification/notification.queue.js";
import { NotificationService } from "../notification/notification.service.js";
import { PostgresCheckinRepository } from "./checkin.repository.postgres.js";
import { PostgresUserRepository } from "../user/user.repository.postgres.js";
import { PostgresMilestoneRepository } from "../engagement/milestone.repository.postgres.js";
import { EngagementService } from "../engagement/engagement.service.js";
```

Build engagement service and pass it:

```typescript
function buildEngagementService(db: Database) {
  const env = loadEnv();
  const queue = env.REDIS_URL ? getNotificationQueue(env.REDIS_URL) : null;
  const notificationService = new NotificationService(
    new PostgresNotificationRepository(db),
    new PostgresPushTokenRepository(db),
    queue,
  );
  return new EngagementService(
    notificationService,
    new PostgresNotificationRepository(db),
    new PostgresCheckinRepository(db),
    new PostgresUserRepository(db),
    new PostgresMembershipRepository(db),
    new PostgresMilestoneRepository(db),
  );
}
```

Pass as last arg to CheckinService:

```typescript
const checkinService = new CheckinService(
  // ... existing args ...,
  buildDispatcher(db),
  buildEngagementService(db),
);
```

- [ ] **Step 4: Type-check**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 5: Run all unit tests**

```bash
cd apps/api && npx vitest run --project unit
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/server.ts apps/api/src/modules/checkin/checkin.service.ts apps/api/src/modules/checkin/checkin.routes.ts
git commit -m "feat(api): wire engagement worker and milestone check into server (TAT-98)"
```
