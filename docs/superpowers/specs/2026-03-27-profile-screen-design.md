# Profile Screen Design

**Date:** 2026-03-27
**Screen ID:** M-SHARED-01 (Pencil Node: brYUm)
**Scope:** User profile screen accessible from all roles, plus API endpoints for profile update and account deletion.

---

## Navigation & Entry Point

- All 3 Home screens (manager, instructor, student) have a user avatar in the header
- The avatar becomes `Pressable` — tapping it pushes to the profile screen
- Route: `(app)/profile.tsx` — lives outside role groups so all roles can access it
- Stack navigation (slide from right), back button returns to Home

## Screen Layout

The screen follows the existing design in `design.pen` (Node `brYUm`) with one additional section.

### 1. Header

- Back button (chevron-left, 40x40, `#1A1A1A` bg, `#2A2A2A` border, cornerRadius 12)
- Title: "Meu perfil" (Sora 18 bold, white)
- Spacer for centering

### 2. Avatar Section

- Reuses existing `Avatar.tsx` component (80x80, gradient fallback with initial)
- User name below (Sora 20 bold, white)
- Role badge: pill with role text (Inter 13 semibold, accent color on `#A078E820` bg)

### 3. Editable Card — "Informacoes pessoais"

Card container: `#1A1A1A` bg, `#2A2A2A` border, cornerRadius 16, padding 16, gap 16.

Fields (all use existing `FormInput` pattern):
- **Nome** — text input, pre-filled from `user.name`
- **Telefone** — text input, pre-filled from `user.phone`
- **Instagram** — text input, pre-filled from `user.instagram`
- **Data de nascimento** — `DatePickerField`, pre-filled from `user.birthDate`

Field styling: label (Inter 12 medium, `#ABABAB`), input container (`#242424` bg, `#2A2A2A` border, cornerRadius 12, padding 12x16).

### 4. Read-only Card

Same card styling as above. Two rows separated by a `#2A2A2A` divider (1px):

- **Email row:** mail icon (`#525252`) + email value + lock icon (`#525252`). Email comes from Clerk, not editable.
- **Role row:** user-check icon (`#525252`) + role name + lock icon (`#525252`). Active role, not editable here.

Row padding: 14x16, gap 12, items vertically centered.

### 5. Account Card (new, not in .pen design)

Same card styling (`#1A1A1A` bg, `#2A2A2A` border, cornerRadius 16). Two rows separated by `#2A2A2A` divider:

- **"Sair da conta" row:** `log-out` icon (lucide, `#ABABAB`) + text "Sair da conta" (Inter 14 medium, `#ABABAB`) + `chevron-right` icon (`#525252`). Padding 14x16.
- **"Excluir minha conta" row:** `trash-2` icon (lucide, `#EF4444`) + text "Excluir minha conta" (Inter 14 medium, `#EF4444`) + `chevron-right` icon (`#525252`). Padding 14x16.

### 6. Save Button

- Full-width, height 52, cornerRadius 12
- Gradient fill: `#A078E8` → `#7C5CBF` (linear, 180deg)
- Label: "Salvar alteracoes" (Inter 15 semibold, white, centered)
- Disabled state (opacity 0.5) when no changes have been made
- Positioned above the account card, below the read-only card (same as design)

### 7. Layout Order (top to bottom)

1. Status bar
2. Nav row (back + title)
3. Avatar section
4. "Informacoes pessoais" title
5. Editable card (form fields)
6. Read-only card (email + role)
7. Save button
8. Account card (logout + delete)
9. Bottom safe area

The screen is scrollable (`ScrollView`) to accommodate all content.

## Behaviors

### Save Profile

- Form managed by React Hook Form + Zod schema
- `PATCH /users/me` with only changed fields
- On success: invalidate `["users", "me"]` query, show success feedback
- Button only enabled when form `isDirty`

### Logout

- Tapping "Sair da conta" calls `signOut()` from `@clerk/clerk-expo`
- Clears local state (React Query cache, AsyncStorage)
- Redirects to auth flow (`(auth)/`)

### Delete Account

- Tapping "Excluir minha conta" shows an Alert:
  - Title: "Excluir conta"
  - Message: "Tem certeza? Esta acao e irreversivel. Todos os seus dados serao removidos."
  - Buttons: "Cancelar" (cancel style) | "Excluir" (destructive style)
- On confirm: calls `DELETE /users/me`
- API performs soft delete (`deletedAt = now()`) + deletes Clerk user
- Client signs out and redirects to auth flow

## API Changes

### `GET /users/me` — Update Response

Add fields to the response schema:
- `phone: string | null`
- `instagram: string | null`
- `birthDate: string | null` (ISO date format, e.g. "1995-03-15")

Filter out users where `deletedAt` is not null (return 404).

### `PATCH /users/me` — New Endpoint

**Request body** (all optional):
```json
{
  "name": "string",
  "phone": "string | null",
  "instagram": "string | null",
  "birthDate": "string | null"
}
```

**Validation (Zod):**
- `name`: min 2 chars, max 100
- `phone`: optional, validated format or null to clear
- `instagram`: optional, max 30 chars, stripped of @ prefix if present
- `birthDate`: optional, valid ISO date string or null to clear

**Response:** Updated user object (same shape as `GET /users/me`)

### `DELETE /users/me` — New Endpoint

**Behavior:**
1. Set `deletedAt = now()` on the user row (soft delete)
2. Delete the user from Clerk via `@clerk/backend` SDK: `clerkClient.users.deleteUser(clerkUserId)`
3. Return `204 No Content`

**Error handling:**
- If Clerk deletion fails, still proceed with soft delete (log the error)
- Return 404 if user already deleted

## Database Changes

### Migration: Add `deletedAt` column

Add to `users` table in `packages/db/src/schema/index.ts`:
```
deletedAt: timestamp("deleted_at", { withTimezone: true })
```

Generate and run Drizzle migration.

### Repository Changes

- `UserRepository.update(id, data)` — new method for partial updates
- `UserRepository.softDelete(id)` — sets `deletedAt`
- All existing queries should filter `WHERE deleted_at IS NULL`

## Mobile Hook

### `useUpdateProfile()`

New hook in `lib/hooks/use-user.ts`:
- Uses `useMutation` with `PATCH /users/me`
- On success: invalidates `["users", "me"]` query
- Returns `{ mutate, isPending }`

### `useDeleteAccount()`

New hook in `lib/hooks/use-user.ts`:
- Uses `useMutation` with `DELETE /users/me`
- On success: calls `signOut()`, clears cache
- Returns `{ mutate, isPending }`

## Files to Create/Modify

### New files:
- `apps/mobile/app/(app)/profile.tsx` — profile screen

### Modified files:
- `apps/mobile/app/(app)/(manager)/(home)/index.tsx` — avatar Pressable
- `apps/mobile/app/(app)/(instructor)/(home)/index.tsx` — avatar Pressable
- `apps/mobile/app/(app)/(student)/(home)/index.tsx` — avatar Pressable
- `apps/mobile/lib/hooks/use-user.ts` — add useUpdateProfile, useDeleteAccount hooks
- `apps/api/src/modules/user/user.routes.ts` — add PATCH and DELETE endpoints
- `apps/api/src/modules/user/user.repository.ts` — add update, softDelete interface
- `apps/api/src/modules/user/user.repository.postgres.ts` — implement update, softDelete
- `apps/api/src/modules/user/user.repository.in-memory.ts` — implement update, softDelete
- `apps/api/src/modules/user/user.service.ts` — add updateProfile, deleteAccount methods
- `packages/db/src/schema/index.ts` — add deletedAt column
- `packages/validators/src/user.schema.ts` — add update profile schema, update me response
