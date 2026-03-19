import { createDb, type Database } from "@tatame/db";
import { loadEnv } from "@tatame/config";

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    const env = loadEnv();
    _db = createDb(env.DATABASE_URL);
  }
  return _db;
}
