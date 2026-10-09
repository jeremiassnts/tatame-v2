import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingInvite,
  readPendingInvite,
  setPendingInvite,
} from "@/lib/pending-invite";

const A = { academyId: "academy-a", role: "student" } as const;
const B = { academyId: "academy-b", role: null } as const;

beforeEach(() => {
  clearPendingInvite();
});

describe("the pending-invite store", () => {
  it("holds nothing before an invite arrives", async () => {
    // A fresh module, not this file's instance: every other test in here has
    // already written to the shared one, so asserting its emptiness would only
    // prove `clearPendingInvite` ran.
    vi.resetModules();
    const fresh = await import("@/lib/pending-invite");
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

  it("forgets the invite when cleared", () => {
    setPendingInvite(A);
    clearPendingInvite();
    expect(readPendingInvite()).toBeNull();
  });
});
