import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { InMemoryUserRepository } from "./user.repository.in-memory.js";
import { UserService } from "./user.service.js";

describe("UserService", () => {
  it("upserts and returns user by clerk id", async () => {
    const repo = new InMemoryUserRepository();
    const svc = new UserService(repo);
    await svc.upsertFromClerk({
      clerkUserId: "clerk_1",
      email: "a@example.com",
      name: "Alice",
      profileImageUrl: null,
    });
    const u = await svc.getByClerkId("clerk_1");
    expect(u?.email).toBe("a@example.com");
    expect(u?.name).toBe("Alice");
  });

  it("assignInitialRole inserts once then returns false", async () => {
    const repo = new InMemoryUserRepository();
    const svc = new UserService(repo);
    await svc.upsertFromClerk({
      clerkUserId: "c",
      email: "b@example.com",
      name: "Bob",
      profileImageUrl: null,
    });
    const u = (await svc.getByClerkId("c"))!;
    expect(await svc.assignInitialRole(u.id, "student")).toBe(true);
    expect(await svc.assignInitialRole(u.id, "student")).toBe(false);
    expect(await svc.getActiveRole(u.id)).toBe("student");
  });

  it("deleteByClerkId removes user", async () => {
    const repo = new InMemoryUserRepository();
    const svc = new UserService(repo);
    await svc.upsertFromClerk({
      clerkUserId: "x",
      email: "x@example.com",
      name: "X",
      profileImageUrl: null,
    });
    await svc.deleteByClerkId("x");
    expect(await svc.getByClerkId("x")).toBeNull();
  });

  it("getActiveRole returns null when none", async () => {
    const repo = new InMemoryUserRepository();
    const svc = new UserService(repo);
    expect(await svc.getActiveRole(randomUUID())).toBeNull();
  });
});
