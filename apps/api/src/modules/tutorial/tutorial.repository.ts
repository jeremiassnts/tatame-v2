import type { InferSelectModel } from "drizzle-orm";
import type { tutorials } from "@tatame/db";

export type TutorialRow = InferSelectModel<typeof tutorials>;

export interface ITutorialRepository {
  findAll(): Promise<TutorialRow[]>;
}
