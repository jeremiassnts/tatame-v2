import { vi } from "vitest";

export const INTEGRATION_CLERK_USER_ID = "user_integration_clerk_v1";

const clerkHoisted = vi.hoisted(() => {
  const defaultClerkUserId = "user_integration_clerk_v1";
  return {
    getAuth: vi.fn(
      (_req?: unknown): { userId: string | null } => ({
        userId: defaultClerkUserId,
      }),
    ),
  };
});

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void) => {
      next();
    },
  getAuth: (req?: unknown) => clerkHoisted.getAuth(req),
}));

export function asClerkUser(clerkUserId: string): void {
  clerkHoisted.getAuth.mockImplementation(() => ({
    userId: clerkUserId,
  }));
}

/**
 * No session at all. `resetIntegrationClerkAuth` installs a default user id, so
 * without this there is no way to exercise a route that is meant to answer
 * without one — or to prove that its neighbours still refuse.
 */
export function asAnonymous(): void {
  clerkHoisted.getAuth.mockImplementation(() => ({ userId: null }));
}

export function resetIntegrationClerkAuth(): void {
  clerkHoisted.getAuth.mockImplementation(() => ({
    userId: "user_integration_clerk_v1",
  }));
}
