import type { ITutorialRepository, TutorialRow } from "./tutorial.repository.js";

export class TutorialService {
  constructor(private readonly repo: ITutorialRepository) {}

  async listAll(): Promise<TutorialRow[]> {
    return this.repo.findAll();
  }
}
