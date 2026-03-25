# User Sync on Login — Design Spec

## Problem

The app currently relies on Clerk webhooks to create users in the database after signup. This flow has timing issues — users can reach the app before the webhook processes, resulting in "user not provisioned" errors. The webhook-based approach is unreliable and adds operational complexity.

## Solution

Replace the webhook flow with an explicit sync endpoint (`POST /v1/users/me/sync`) called by the mobile app immediately after login. This guarantees the user exists in the database before any authenticated navigation.

## API Changes

### New Endpoint: `POST /v1/users/me/sync`

**Middleware:** `requireSession`

**Request body (optional):**

```json
{
  "role": "manager" | "instructor" | "student"
}
```

**Internal flow:**

1. Extract `clerkUserId` from the Clerk session token via `getAuth(req)`
2. Call `clerkClient.users.getUser(clerkUserId)` to fetch `email`, `name`, `profileImageUrl`
3. Upsert user in database (reuses existing `userRepository.upsert()` with `ON CONFLICT (clerkUserId) DO UPDATE`)
4. If `role` is provided in body AND user has no active role → assign role (reuses `userService.assignInitialRole()`). If the user already has a role, the `role` field is silently ignored — the sync still succeeds with 200.
5. Return `UserMeResponse` (user + activeRole + activeAcademy)

**Responses:**

| Status | Condition |
|--------|-----------|
| 200 | User synced successfully (role may or may not have been assigned) |
| 400 | Invalid role in body |
| 401 | No Clerk session |

### Prerequisites

**Clerk Backend Client:** The API does not currently instantiate a `clerkClient`. Create a singleton using `createClerkClient` from `@clerk/backend` with `CLERK_SECRET_KEY` (already in env config). Place in `apps/api/src/lib/clerk.ts`.

### Concurrency Safety

The `assignInitialRole()` method does a check-then-insert that is not atomic. To prevent duplicate role rows from concurrent sync calls, wrap the check + insert in a database transaction with a `SELECT ... FOR UPDATE` lock on the user row. Alternatively, add a partial unique index on `userRoles(userId) WHERE isActive = true` to let the DB reject duplicates.

### Removals

- **`POST /v1/auth/webhooks/clerk`** — webhook handler (`clerk-webhook.handler.ts`) and its route registration in `app.ts`
- **`POST /v1/users/me/role`** — separate role assignment endpoint (unified into sync)
- **`userService.deleteByClerkId()`** and corresponding repository method — no longer needed without webhooks
- **`CLERK_WEBHOOK_SIGNING_SECRET` / `CLERK_WEBHOOK_SECRET`** — removed from env config
- **Validator schemas:** `setInitialRoleBodySchema`, `setInitialRoleResponseSchema` and their types (`SetInitialRoleBody`, `SetInitialRoleResponse`) from `packages/validators/src/user.schema.ts`
- **Stale JSDoc:** update `userMeResponseSchema` comment that references `POST /users/me/role`

**Trade-off acknowledged:** Removing the webhook means there is no automatic handler for `user.deleted` events from the Clerk dashboard. User deletion will be handled by a future admin API if needed. This is intentionally deferred.

### Adjustments

- **`GET /v1/users/me`** — change 404 message from "aguarde o sync do webhook" to "Faça login novamente" (if user doesn't exist, the sync failed and the user needs to re-authenticate)

## Mobile Changes

### Sync call after authentication

Call `POST /users/me/sync` immediately after `setActive({ session })` in every auth flow:

- `sign-in.tsx` — after email/password login
- `sign-in.tsx` — after OAuth (Google/Apple)
- `verify-email.tsx` — after email verification on signup
- `sign-up.tsx` — after OAuth (Google/Apple)

All paths send the `role` from AsyncStorage (`userType`) in the request body. This includes OAuth sign-up, where the user selected their type during onboarding.

### Implementation

1. Create a standalone `syncUser(token: string, role?: string)` function in `lib/api.ts` that calls `POST /users/me/sync`. This must be a plain function (not a hook) since it is called from event handlers. It uses the existing `request()` helper, receiving the token as a parameter (obtained via `getToken()` at the call site).
2. In each auth flow handler: after `setActive`, call `getToken()` then `syncUser(token, userType)`
3. Remove the dead `assignRole()` function in `verify-email.tsx` — replaced by `syncUser`
4. If sync fails → show error with a **retry button**. The user has a valid Clerk session but no DB record, so retrying the sync is the correct recovery. After 3 failed retries, show a generic error suggesting to try again later.

**Simplified flow:**

```
Login/Signup → setActive(session) → getToken() → syncUser(token, role) → navigate to /(app)
```

## Validator Changes

New Zod schema for the sync request body, reusing the existing `roleEnumSchema`:

```typescript
export const syncUserBodySchema = z.object({
  role: roleEnumSchema.optional(),
});

export type SyncUserBody = z.infer<typeof syncUserBodySchema>;
```

## What Stays Unchanged

- Database schema (`users`, `userRoles` tables)
- `userService.upsertFromClerk()` and `userRepository.upsert()` — reused by sync endpoint
- `userService.assignInitialRole()` — reused by sync endpoint (with concurrency fix)
- `requireSession` middleware
- `authorize` middleware
- `useCurrentUser` hook and `GET /users/me` response shape
