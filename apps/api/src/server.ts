import "./env-bootstrap.js";
import { loadEnv } from "@tatame/config";
import { createApp } from "./app.js";
import { runMigrations } from "./migrate.js";

const env = loadEnv();

if (env.NODE_ENV === "production") {
  console.log("Running database migrations...");
  await runMigrations(env.DATABASE_URL, "./drizzle");
}

const app = createApp();

app.listen(env.API_PORT, () => {
  console.log(`API listening on http://localhost:${env.API_PORT}/v1`);
});
