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

  // ─── Webhook idempotency ────────────────────────────────────

  it("upsert is idempotent — calling twice with same clerkUserId updates instead of duplicating", async () => {
    const repo = new InMemoryUserRepository();
    const svc = new UserService(repo);

    await svc.upsertFromClerk({
      clerkUserId: "clerk_idem",
      email: "first@example.com",
      name: "First",
      profileImageUrl: null,
    });

    // Second call with same clerkUserId but updated data
    await svc.upsertFromClerk({
      clerkUserId: "clerk_idem",
      email: "updated@example.com",
      name: "Updated Name",
      profileImageUrl: "https://img.example.com/photo.jpg",
    });

    const user = await svc.getByClerkId("clerk_idem");
    expect(user).not.toBeNull();
    expect(user!.email).toBe("updated@example.com");
    expect(user!.name).toBe("Updated Name");
    expect(user!.profileImageUrl).toBe("https://img.example.com/photo.jpg");
  });

  it("upsert called twice with identical data is a no-op (idempotent)", async () => {
    const repo = new InMemoryUserRepository();
    const svc = new UserService(repo);

    const data = {
      clerkUserId: "clerk_same",
      email: "same@example.com",
      name: "Same",
      profileImageUrl: null,
    };

    await svc.upsertFromClerk(data);
    const userAfterFirst = await svc.getByClerkId("clerk_same");

    await svc.upsertFromClerk(data);
    const userAfterSecond = await svc.getByClerkId("clerk_same");

    // Same user, same id — not duplicated
    expect(userAfterSecond!.id).toBe(userAfterFirst!.id);
    expect(userAfterSecond!.email).toBe("same@example.com");
  });

  it("upsert with different clerkUserIds creates separate users", async () => {
    const repo = new InMemoryUserRepository();
    const svc = new UserService(repo);

    await svc.upsertFromClerk({
      clerkUserId: "clerk_a",
      email: "a@example.com",
      name: "A",
      profileImageUrl: null,
    });
    await svc.upsertFromClerk({
      clerkUserId: "clerk_b",
      email: "b@example.com",
      name: "B",
      profileImageUrl: null,
    });

    const a = await svc.getByClerkId("clerk_a");
    const b = await svc.getByClerkId("clerk_b");
    expect(a!.id).not.toBe(b!.id);
    expect(a!.email).toBe("a@example.com");
    expect(b!.email).toBe("b@example.com");
  });
});
