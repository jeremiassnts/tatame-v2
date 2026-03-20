import { createDb, type Database } from "@tatame/db";
import { loadEnv } from "@tatame/config";

let _db: Database | null = null;
let _override: Database | undefined;

export function setDbForTest(db: Database): void {
  _override = db;
}

export function clearDbForTest(): void {
  _override = undefined;
}

export function getDb(): Database {
  if (_override) {
    return _override;
  }
  if (!_db) {
    const env = loadEnv();
    _db = createDb(env.DATABASE_URL);
  }
  return _db;
}
