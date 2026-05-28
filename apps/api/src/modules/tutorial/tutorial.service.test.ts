import { describe, expect, it } from "vitest";
import { InMemoryTutorialRepository } from "./tutorial.repository.in-memory.js";
import { TutorialService } from "./tutorial.service.js";

function setup() {
  const repo = new InMemoryTutorialRepository();
  const service = new TutorialService(repo);
  return { repo, service };
}

describe("TutorialService", () => {
  describe("listAll", () => {
    it("returns an empty array when no tutorials exist", async () => {
      const { service } = setup();
      const result = await service.listAll();
      expect(result).toEqual([]);
    });

    it("returns tutorials sorted by sortOrder", async () => {
      const { repo, service } = setup();
      repo.seed({
        title: "Second",
        description: "desc",
        youtubeUrl: "https://youtube.com/watch?v=2",
        thumbnailUrl: "https://img.youtube.com/vi/2/maxresdefault.jpg",
        durationSeconds: 120,
        sortOrder: 2,
      });
      repo.seed({
        title: "First",
        description: "desc",
        youtubeUrl: "https://youtube.com/watch?v=1",
        thumbnailUrl: "https://img.youtube.com/vi/1/maxresdefault.jpg",
        durationSeconds: 60,
        sortOrder: 1,
      });

      const result = await service.listAll();
      expect(result).toHaveLength(2);
      expect(result[0]!.title).toBe("First");
      expect(result[1]!.title).toBe("Second");
    });

    it("returns all fields for each tutorial", async () => {
      const { repo, service } = setup();
      repo.seed({
        title: "Test Tutorial",
        description: "A test description",
        youtubeUrl: "https://youtube.com/watch?v=abc",
        thumbnailUrl: "https://img.youtube.com/vi/abc/maxresdefault.jpg",
        durationSeconds: 200,
        sortOrder: 1,
      });

      const [tutorial] = await service.listAll();
      expect(tutorial).toMatchObject({
        title: "Test Tutorial",
        description: "A test description",
        youtubeUrl: "https://youtube.com/watch?v=abc",
        thumbnailUrl: "https://img.youtube.com/vi/abc/maxresdefault.jpg",
        durationSeconds: 200,
        sortOrder: 1,
      });
      expect(tutorial!.id).toBeDefined();
      expect(tutorial!.createdAt).toBeInstanceOf(Date);
    });
  });
});
