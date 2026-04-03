import "./env-bootstrap.js";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations completed successfully");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
} finally {
  await sql.end();
}
