import { vi } from "vitest";

export const INTEGRATION_CLERK_USER_ID = "user_integration_clerk_v1";

const clerkHoisted = vi.hoisted(() => {
  const defaultClerkUserId = "user_integration_clerk_v1";
  return {
    getAuth: vi.fn((_req?: unknown) => ({ userId: defaultClerkUserId })),
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

export function resetIntegrationClerkAuth(): void {
  clerkHoisted.getAuth.mockImplementation(() => ({
    userId: "user_integration_clerk_v1",
  }));
}
