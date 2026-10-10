import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupIntegrationTest } from "./testing/integration-setup.js";

/**
 * What the applied migration set leaves behind, asserted against the schema the
 * harness builds rather than against `schema/index.ts`. The two can disagree:
 * the Drizzle schema is what the code compiles against, the journal is what runs
 * on a real database, and a table removed from one and not the other typechecks
 * and then fails in production.
 *
 * `pending_pix_payments` is the case this was written for. `0024` drops it, and
 * `beforeEach` here runs the same `TRUNCATE_ALL` every integration file runs —
 * so a table named in that list and missing from the schema fails this file
 * before any assertion is reached.
 */
describe("the applied migration set", () => {
  let ctx: Awaited<ReturnType<typeof setupIntegrationTest>>;

  beforeAll(async () => {
    ctx = await setupIntegrationTest();
  });

  beforeEach(async () => {
    await ctx.truncateAll();
  });

  afterAll(async () => {
    await ctx.dropSchema();
  });

  async function tableNames(): Promise<string[]> {
    const rows = await ctx.db.execute<{ table_name: string }>(sql`
      select table_name
        from information_schema.tables
       where table_schema = ${ctx.schemaName}
       order by table_name
    `);
    return [...rows].map((r) => r.table_name);
  }

  it("drops pending_pix_payments and keeps the Asaas table", async () => {
    const tables = await tableNames();

    expect(tables).not.toContain("pending_pix_payments");
    // The positive half is what stops this from passing on an empty schema — a
    // migration chain that failed silently would satisfy the line above.
    expect(tables).toContain("pending_asaas_payments");
    expect(tables).toContain("payments");
  });
});
