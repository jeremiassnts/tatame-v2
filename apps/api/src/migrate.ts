import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { logger } from "./lib/logger.js";

export async function runMigrations(databaseUrl: string, migrationsFolder: string) {
  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);

  try {
    await migrate(db, { migrationsFolder });
    logger.info("Migrations completed successfully");
  } finally {
    await sql.end();
  }
}
