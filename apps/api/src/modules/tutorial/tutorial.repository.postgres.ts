import { asc } from "drizzle-orm";
import { tutorials, type Database } from "@tatame/db";
import type { ITutorialRepository, TutorialRow } from "./tutorial.repository.js";

export class PostgresTutorialRepository implements ITutorialRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<TutorialRow[]> {
    return this.db
      .select()
      .from(tutorials)
      .orderBy(asc(tutorials.sortOrder));
  }
}
