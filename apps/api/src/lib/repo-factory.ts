import type { Database } from "@tatame/db";

export type RepoFactory<T> = (db: Database) => T;
