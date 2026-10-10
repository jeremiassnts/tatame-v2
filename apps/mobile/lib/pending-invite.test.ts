import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingInvite,
  getPendingInviteSnapshot,
  hydratePendingInvite,
  readPendingInvite,
  setPendingInvite,
  subscribeToPendingInvite,
} from "@/lib/pending-invite";

/**
 * AsyncStorage is a native module: its CommonJS entry imports `react-native`,
 * which cannot load in this suite's `environment: "node"`. The double is a
 * `Map` so a value written in one test can be read back by a *fresh* module
 * instance in another, which is the only way to exercise the process-restart
 * path without a device.
 */
const storage = vi.hoisted(() => {
  const items = new Map<string, string>();
  return {
    items,
    getItem: vi.fn(async (key: string) => items.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      items.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      items.delete(key);
    }),
  };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: storage,
}));

const KEY = "tatame.pending-invite";

const A = { academyId: "academy-a", role: "student" } as const;
const B = { academyId: "academy-b", role: null } as const;

/** A fresh module instance, which is what a cold start actually is. */
async function freshStore() {
  vi.resetModules();
  return import("@/lib/pending-invite");
}

beforeEach(async () => {
  storage.items.clear();
  storage.getItem.mockClear();
  storage.setItem.mockClear();
  storage.removeItem.mockClear();
  await clearPendingInvite();
});

describe("the pending-invite store", () => {
  it("holds nothing before an invite arrives", async () => {
    // A fresh module, not this file's instance: every other test in here has
    // already written to the shared one, so asserting its emptiness would only
    // prove `clearPendingInvite` ran.
    const fresh = await freshStore();
    expect(fresh.readPendingInvite()).toBeNull();
  });

  it("keeps the most recent invite", () => {
    // Last write wins, and it wins silently. A manager pasting two different
    // academies into the same chat is the case that produces this, and the
    // second tap is the one the person meant.
    setPendingInvite(A);
    setPendingInvite(B);
    expect(readPendingInvite()).toEqual(B);
    expect(readPendingInvite()).not.toEqual(A);
  });

  it("forgets the invite when cleared", async () => {
    setPendingInvite(A);
    await clearPendingInvite();
    expect(readPendingInvite()).toBeNull();
  });

  it("is readable before the write lands", async () => {
    // The whole reason module state is the source of truth. `redirectSystemPath`
    // returns a string and cannot await, and `(app)/index.tsx` reads on the very
    // next hop, so a store that only answered once AsyncStorage resolved would
    // send a person with an invite to `search-academy`.
    const fresh = await freshStore();
    storage.setItem.mockImplementationOnce(() => new Promise<void>(() => {}));

    fresh.setPendingInvite(A);

    expect(fresh.getPendingInviteSnapshot()).toEqual({
      invite: A,
      hydrated: true,
    });
  });

  it("mirrors the invite to one storage key", async () => {
    setPendingInvite({ academyId: "a1", role: "instructor" });

    await vi.waitFor(() => {
      expect(storage.setItem).toHaveBeenCalledWith(
        KEY,
        '{"academyId":"a1","role":"instructor"}',
      );
    });
  });

  it("recovers the invite after the process restarts", async () => {
    storage.items.set(KEY, '{"academyId":"a1","role":"instructor"}');

    const fresh = await freshStore();
    expect(fresh.getPendingInviteSnapshot().hydrated).toBe(false);

    await fresh.hydratePendingInvite();

    expect(fresh.getPendingInviteSnapshot()).toEqual({
      invite: { academyId: "a1", role: "instructor" },
      hydrated: true,
    });
  });

  it("forgets the invite in both places", async () => {
    setPendingInvite(A);
    await clearPendingInvite();

    expect(storage.removeItem).toHaveBeenCalledWith(KEY);
    expect(getPendingInviteSnapshot().invite).toBeNull();
    expect(storage.items.has(KEY)).toBe(false);
  });

  it("refuses every unusable persisted value", async () => {
    // Seven classes, each its own case. A value we did not write is a value we
    // do not understand, and half an invite is worse than none: it would send
    // someone into a join flow for an academy nobody named.
    const unusable: Array<[string, string | null]> = [
      ["absent", null],
      ["not json", "not json"],
      ["a json array", "[]"],
      ["a bare json string", '"a1"'],
      ["an empty academy id", '{"academyId":"","role":null}'],
      ["a non-string academy id", '{"academyId":7,"role":null}'],
      ["a role nobody can be invited as", '{"academyId":"a1","role":"gestor"}'],
    ];

    for (const [label, raw] of unusable) {
      storage.items.clear();
      if (raw !== null) storage.items.set(KEY, raw);

      const fresh = await freshStore();
      await fresh.hydratePendingInvite();

      expect(fresh.getPendingInviteSnapshot(), label).toEqual({
        invite: null,
        hydrated: true,
      });
    }
  });

  it("survives a storage read that fails", async () => {
    const fresh = await freshStore();
    storage.getItem.mockRejectedValueOnce(new Error("disk is gone"));

    await expect(fresh.hydratePendingInvite()).resolves.toBeUndefined();

    // Hydrated, not stuck: a store that stayed unhydrated would hold the
    // gatekeeper on a spinner for the rest of the session.
    expect(fresh.getPendingInviteSnapshot()).toEqual({
      invite: null,
      hydrated: true,
    });
  });

  it("survives a storage write that fails", async () => {
    const fresh = await freshStore();
    storage.setItem.mockRejectedValueOnce(new Error("disk is full"));

    expect(() => fresh.setPendingInvite(A)).not.toThrow();
    await vi.waitFor(() => expect(storage.setItem).toHaveBeenCalled());

    expect(fresh.readPendingInvite()).toEqual(A);
  });

  it("reads storage once", async () => {
    const fresh = await freshStore();
    storage.getItem.mockClear();

    await fresh.hydratePendingInvite();
    await fresh.hydratePendingInvite();

    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it("notifies the subscribers it still has", async () => {
    const kept = vi.fn();
    const dropped = vi.fn();

    const unsubscribe = subscribeToPendingInvite(dropped);
    unsubscribe();
    subscribeToPendingInvite(kept);

    setPendingInvite(A);
    await clearPendingInvite();

    expect(kept).toHaveBeenCalledTimes(2);
    expect(dropped).toHaveBeenCalledTimes(0);
  });

  it("returns a stable snapshot", async () => {
    const fresh = await freshStore();

    // Identity, not equality. `useSyncExternalStore` re-renders forever against
    // a getSnapshot that builds a new object on every call.
    const before = fresh.getPendingInviteSnapshot();
    expect(fresh.getPendingInviteSnapshot()).toBe(before);

    fresh.setPendingInvite(A);
    const afterWrite = fresh.getPendingInviteSnapshot();

    expect(afterWrite).toBe(fresh.getPendingInviteSnapshot());
    // And a write does change it, or stability would be indistinguishable from
    // a store that never updates.
    expect(afterWrite).not.toBe(before);
  });
});
