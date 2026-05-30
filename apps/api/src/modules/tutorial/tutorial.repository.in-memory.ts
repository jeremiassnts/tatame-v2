import { randomUUID } from "node:crypto";
import type { ITutorialRepository, TutorialRow } from "./tutorial.repository.js";

export class InMemoryTutorialRepository implements ITutorialRepository {
  rows: TutorialRow[] = [];

  async findAll(): Promise<TutorialRow[]> {
    return [...this.rows].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /** Test helper to seed data */
  seed(data: Omit<TutorialRow, "id" | "createdAt">): TutorialRow {
    const row: TutorialRow = {
      id: randomUUID(),
      createdAt: new Date(),
      ...data,
    };
    this.rows.push(row);
    return row;
  }
}
