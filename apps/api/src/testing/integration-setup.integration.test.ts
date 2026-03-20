import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupIntegrationTest } from "./integration-setup.js";

describe("integration-setup", () => {
  let ctx: Awaited<ReturnType<typeof setupIntegrationTest>>;

  beforeAll(async () => {
    ctx = await setupIntegrationTest();
  });

  afterEach(async () => {
    await ctx.truncateAll();
  });

  afterAll(async () => {
    await ctx.dropSchema();
  });

  it("applies migrations and runs queries on the isolated schema", async () => {
    const rows = await ctx.db.execute<{ n: number }>(sql`select 1::int as n`);
    expect(rows[0]?.n).toBe(1);
  });
});
