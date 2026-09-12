import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "@tatame/db";
import * as schema from "@tatame/db/schema";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { clearDbForTest } from "../lib/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../../../..");
const DRIZZLE_DIR = join(REPO_ROOT, "packages/db/drizzle");
const JOURNAL_PATH = join(DRIZZLE_DIR, "meta/_journal.json");

type Journal = {
  entries: Array<{ idx: number; tag: string }>;
};

function loadOrderedMigrationSql(): string[] {
  const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf-8")) as Journal;
  const ordered = [...journal.entries].sort((a, b) => a.idx - b.idx);
  return ordered.map((e) =>
    readFileSync(join(DRIZZLE_DIR, `${e.tag}.sql`), "utf-8"),
  );
}

function rewritePublicToSchema(markedSql: string, schemaName: string): string {
  const qualified = `"${schemaName}"`;
  return markedSql.replaceAll('"public"', qualified);
}

function splitStatements(markedSql: string): string[] {
  return markedSql
    .split(/--> statement-breakpoint/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const TRUNCATE_ALL = `
TRUNCATE TABLE
  academies,
  academy_memberships,
  academy_payout_accounts,
  announcements,
  belt_promotions,
  checkins,
  classes,
  custom_notification_sends,
  dependents,
  engagement_milestones,
  manager_subscriptions,
  notification_preferences,
  notifications,
  payments,
  pending_pix_payments,
  push_tokens,
  student_subscriptions,
  subscription_plans,
  user_roles,
  users
RESTART IDENTITY CASCADE
`;

export type IntegrationTestContext = {
  db: Database;
  schemaName: string;
  truncateAll: () => Promise<void>;
  dropSchema: () => Promise<void>;
};

export async function setupIntegrationTest(): Promise<IntegrationTestContext> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set (integration globalSetup)");
  }

  const schemaName = `test_${randomBytes(12).toString("hex")}`;

  const bootstrap = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await bootstrap.unsafe(`CREATE SCHEMA "${schemaName}"`);
    await bootstrap.unsafe(`SET search_path TO "${schemaName}"`);

    for (const body of loadOrderedMigrationSql()) {
      const rewritten = rewritePublicToSchema(body, schemaName);
      for (const stmt of splitStatements(rewritten)) {
        await bootstrap.unsafe(stmt);
      }
    }
  } finally {
    await bootstrap.end({ timeout: 5 });
  }

  const client = postgres(url, {
    max: 10,
    onnotice: () => {},
    connection: {
      search_path: schemaName,
    },
  });

  const db = drizzle(client, { schema });

  return {
    db,
    schemaName,
    truncateAll: async () => {
      await db.execute(sql.raw(TRUNCATE_ALL));
    },
    dropSchema: async () => {
      await client.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await client.end({ timeout: 5 });
      clearDbForTest();
    },
  };
}
