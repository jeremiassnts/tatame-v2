import { describe, expect, it } from "vitest";
import { InMemoryAnnouncementRepository } from "./announcement.repository.in-memory.js";
import { AnnouncementService } from "./announcement.service.js";
import { HttpError } from "../../lib/http-error.js";

function setup() {
  const repo = new InMemoryAnnouncementRepository();
  const service = new AnnouncementService(repo);
  return { repo, service };
}

describe("AnnouncementService", () => {
  describe("create", () => {
    it("creates an announcement and returns it", async () => {
      const { service } = setup();
      const row = await service.create({
        academyId: "academy-1",
        authorId: "user-1",
        title: "Test",
        body: "Test body",
      });
      expect(row.id).toBeDefined();
      expect(row.title).toBe("Test");
      expect(row.body).toBe("Test body");
    });
  });

  describe("getById", () => {
    it("returns an announcement by id with author name", async () => {
      const { service } = setup();
      const created = await service.create({
        academyId: "academy-1",
        authorId: "user-1",
        title: "Hello",
        body: "World",
      });
      const found = await service.getById(created.id);
      expect(found.id).toBe(created.id);
      expect(found.authorName).toBeDefined();
    });

    it("throws 404 if not found", async () => {
      const { service } = setup();
      await expect(service.getById("nonexistent")).rejects.toThrow(HttpError);
      await expect(service.getById("nonexistent")).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("listByAcademy", () => {
    it("returns announcements for the academy", async () => {
      const { service } = setup();
      await service.create({ academyId: "academy-1", authorId: "user-1", title: "A", body: "B" });
      await service.create({ academyId: "academy-1", authorId: "user-1", title: "C", body: "D" });
      await service.create({ academyId: "academy-2", authorId: "user-1", title: "E", body: "F" });
      const result = await service.listByAcademy("academy-1");
      expect(result.items).toHaveLength(2);
      expect(result.items.every((i) => i.academyId === "academy-1")).toBe(true);
    });

    it("returns nextCursor when paginating", async () => {
      const { service } = setup();
      for (let i = 0; i < 5; i++) {
        await service.create({
          academyId: "academy-1",
          authorId: "user-1",
          title: `Title ${i}`,
          body: "body",
        });
      }
      const result = await service.listByAcademy("academy-1", undefined, 3);
      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).not.toBeNull();
    });
  });

  describe("countByAcademy", () => {
    it("returns the count of announcements", async () => {
      const { service } = setup();
      await service.create({ academyId: "academy-1", authorId: "u1", title: "A", body: "B" });
      await service.create({ academyId: "academy-1", authorId: "u1", title: "C", body: "D" });
      const count = await service.countByAcademy("academy-1");
      expect(count).toBe(2);
    });
  });

  describe("update", () => {
    it("updates an announcement in the same academy", async () => {
      const { service } = setup();
      const created = await service.create({
        academyId: "academy-1",
        authorId: "user-1",
        title: "Old",
        body: "Old body",
      });
      const updated = await service.update(created.id, "academy-1", { title: "New" });
      expect(updated.title).toBe("New");
      expect(updated.body).toBe("Old body");
    });

    it("throws 404 if announcement not found", async () => {
      const { service } = setup();
      await expect(
        service.update("nonexistent", "academy-1", { title: "X" }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws 403 if academy does not match", async () => {
      const { service } = setup();
      const created = await service.create({
        academyId: "academy-1",
        authorId: "user-1",
        title: "Old",
        body: "Old body",
      });
      await expect(
        service.update(created.id, "academy-2", { title: "X" }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe("delete", () => {
    it("deletes an announcement in the same academy", async () => {
      const { repo, service } = setup();
      const created = await service.create({
        academyId: "academy-1",
        authorId: "user-1",
        title: "Del",
        body: "Del body",
      });
      await service.delete(created.id, "academy-1");
      expect(repo.rows.find((r) => r.id === created.id)).toBeUndefined();
    });

    it("throws 404 if announcement not found", async () => {
      const { service } = setup();
      await expect(
        service.delete("nonexistent", "academy-1"),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws 403 if academy does not match", async () => {
      const { service } = setup();
      const created = await service.create({
        academyId: "academy-1",
        authorId: "user-1",
        title: "Del",
        body: "Del body",
      });
      await expect(
        service.delete(created.id, "academy-2"),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
