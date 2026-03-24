# Manager Core Screens — Design Spec

## Overview

Implement the first 3 manager screens (M-MGR-01, M-MGR-02, M-MGR-03) plus the foundational infrastructure for the manager mobile experience: API client, TanStack Query, react-hook-form, role-based routing, tab navigation, and a backend upload module for Cloudflare R2.

## Scope

| Screen | ID | Purpose |
|--------|----|---------|
| M-MGR-01 | Create Academy | Onboarding form for managers with no academy |
| M-MGR-02 | Manager Home | Dashboard with stats, quick actions, today's classes |
| M-MGR-03 | Academy Settings | Edit academy info |

**Backend additions:**
- `POST /v1/uploads/image` — image upload to Cloudflare R2
- `GET /v1/academies/:id/stats` — aggregated dashboard stats

## Stack (additions to existing)

- **@tanstack/react-query** — server state management, caching, refetch
- **react-hook-form** + **@hookform/resolvers** — form control with Zod validation
- **expo-image-picker** — select image from gallery/camera
- **@react-native-community/datetimepicker** — native date picker for founded date field
- **@aws-sdk/client-s3** — Cloudflare R2 upload (backend, S3-compatible API)
- **multer** — multipart/form-data parsing (backend)

## Navigation Structure

```
app/
├── (app)/
│   ├── _layout.tsx              # Fetches user role, redirects by role
│   ├── create-academy.tsx       # M-MGR-01 (outside tabs, one-time)
│   └── (manager)/
│       ├── _layout.tsx          # Tab navigator (Home, Members, Classes, More)
│       └── (home)/
│           ├── _layout.tsx      # Stack navigator
│           ├── index.tsx        # M-MGR-02 Dashboard
│           └── settings.tsx     # M-MGR-03 Academy Settings
```

### Role-based redirect — `(app)/_layout.tsx`

**Backend change required:** Extend `GET /v1/users/me` response to include academy context for managers. Add `activeAcademy: { id, name, logoUrl } | null` to the `userMeResponseSchema` in `packages/validators/src/user.schema.ts`. The API populates this by joining the user's active membership (where `role = 'manager'` and `status = 'active'`) with the `academies` table.

**Redirect flow:**
1. Fetch `GET /v1/users/me` → get `activeRole` and `activeAcademy`
2. If `manager`:
   - `activeAcademy` is null → redirect to `create-academy`
   - `activeAcademy` exists → set academy context, redirect to `(manager)/`
3. If `instructor` → redirect to `(instructor)/` (future)
4. If `student` → redirect to `(student)/` (future)

### Academy Context Provider

The `(app)/_layout.tsx` creates an `AcademyContext` with the shape:

```typescript
type AcademyContextValue = {
  academyId: string;
  academyName: string;
  academyLogoUrl: string | null;
};
```

Provided via `<AcademyContext.Provider>` wrapping all `(manager)/` child routes. All manager screens access the academy ID via `useAcademyContext()` hook instead of passing it through props or route params.

### Tab navigator — `(manager)/_layout.tsx`

4 tabs with pill-shaped tab bar (matches design.pen):
- **Home** — `(home)/index.tsx`
- **Members** — placeholder (future M-MGR-04–06)
- **Classes** — placeholder (future M-MGR-07–09)
- **More** — placeholder (future M-MGR-10–18)

Placeholder tabs show a centered "Coming soon" text on dark background.

## Setup Base

### API Client — `lib/api.ts`

Fetch wrapper that:
- Reads API base URL from `EXPO_PUBLIC_API_URL` environment variable (set in `.env` or `app.json` extra)
- Injects Clerk auth token via `getToken()` in `Authorization: Bearer` header
- Provides typed `get()`, `post()`, `patch()` methods
- Handles JSON serialization/deserialization
- Throws on non-2xx with parsed error body

### Query Client — `lib/query-client.ts`

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes
      retry: 1,
    },
  },
});
```

### QueryClientProvider

Added in `(app)/_layout.tsx` wrapping the child routes, inside the existing ClerkProvider context.

### Hooks pattern

Each API domain gets a hooks file in `lib/hooks/`:
- `lib/hooks/use-academy.ts` — `useAcademy()`, `useCreateAcademy()`, `useUpdateAcademy()`, `useAcademyStats()`
- `lib/hooks/use-upload.ts` — `useUploadImage()`
- `lib/hooks/use-user.ts` — `useCurrentUser()`

Each hook wraps `useQuery` or `useMutation` from TanStack Query.

## Screen: M-MGR-01 — Create Academy

**Route:** `(app)/create-academy.tsx`

**When shown:** After role selection, if manager has no academy.

**Form fields:**

| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| Academy name | TextInput | Yes | 1–200 chars |
| Logo | ImagePicker + preview | No | jpg/png/webp, max 5MB |
| Address | TextInput | No | Max 500 chars |
| Contact email | TextInput (email keyboard) | No | Valid email |
| Contact phone | TextInput (phone keyboard) | No | Max 50 chars |
| Founded date | Date picker | No | YYYY-MM-DD format |

**Form control:**
- `react-hook-form` with `zodResolver(createAcademyBodySchema)` from `packages/validators`
- Each `FormInput` wrapped with react-hook-form `Controller` component for controlled integration
- Inline error messages below each field (red text, same pattern as auth screens)

**Submit flow:**
1. If logo selected → `POST /v1/uploads/image` (multipart) → get `{ url }`
2. `POST /v1/academies` with `{ name, logoUrl?, address?, contactEmail?, contactPhone?, foundedAt? }`
3. On success → `router.replace("/(app)/(manager)/(home)")`

**UI layout:**
- BackButton top-left (returns to role selection)
- Title: "Create Academy" — Poppins 700, 28px, white
- `KeyboardAvoidingView` wrapping `ScrollView` with form fields (gap-4, px-6) — `behavior="padding"` on iOS, `behavior="height"` on Android
- GradientButton "Create Academy" fixed at bottom with SafeArea padding
- Loading state: button disabled + ActivityIndicator during submit

## Screen: M-MGR-02 — Manager Home / Dashboard

**Route:** `(app)/(manager)/(home)/index.tsx`

**Data sources:**
- `useCurrentUser()` → manager name
- `useAcademy(academyId)` → academy name, logo
- `useAcademyStats(academyId)` → `{ activeMembers, pendingRequests, classesToday, activePlans }`

**Academy ID context:** Provided by `useAcademyContext()` from the `AcademyContext` set in `(app)/_layout.tsx`.

**UI layout:**

**Header section:**
- Academy logo (40x40, rounded) + academy name + "Manager Dashboard" subtitle
- Settings icon (gear) top-right → navigates to `settings`

**Stats grid (2x2):**
- 4 cards, each with: icon, count (large number), label
  - Active Members (users icon)
  - Pending Requests (clock icon)
  - Classes Today (calendar icon)
  - Active Plans (credit-card icon)
- Cards: `bg-surface`, `border-surface-border`, rounded-2xl, padding-4

**Quick actions (horizontal row):**
- "Pending Requests" button → navigates to `/(manager)/(members)/pending` (future, placeholder)
- "Today's Schedule" button → navigates to `/(manager)/(classes)/` (future, placeholder)
- Style: surface bg, border, rounded-xl, row with icon + text

**Today's Classes section:**
- Title "Today's Classes" with "See all →" link
- List of up to 3 class cards: class name, time, instructor
- Empty state: "No classes scheduled for today"
- Uses `GET /v1/classes?academyId={id}&dayOfWeek={n}` where `n` = JS `new Date().getDay()` (0=Sunday, matches DB convention)

**Tab bar at bottom.**

**Pull-to-refresh:** `ScrollView` with `RefreshControl`. On refresh, invalidates query keys `['academy-stats', academyId]` and `['classes', academyId, dayOfWeek]`.

## Screen: M-MGR-03 — Academy Settings

**Route:** `(app)/(manager)/(home)/settings.tsx`

**Navigation:** Push from Dashboard (gear icon).

**Data sources:**
- `useAcademy(academyId)` → pre-fill form with current data
- `useUpdateAcademy()` → mutation for `PATCH /v1/academies/:id`
- `useUploadImage()` → mutation for logo change

**Form:**
- Same fields as M-MGR-01
- `react-hook-form` with `zodResolver(updateAcademyBodySchema)` (partial schema)
- `defaultValues` populated from current academy data
- Uses `formState.dirtyFields` to send only changed fields in PATCH

**UI layout:**
- BackButton top-left → `router.back()`
- Title: "Academy Settings" — Poppins 700, 28px, white
- Current logo displayed as circle with "Change" overlay on tap
- ScrollView with form fields (same layout as M-MGR-01)
- GradientButton "Save Changes" fixed at bottom — disabled when `!isDirty`
- Loading state during save
- Success: brief inline success message (e.g., temporary "Saved!" text replacing the button for 1s), then navigate back to dashboard. No external toast library — keep it simple.

**Submit flow:**
1. If logo changed → `POST /v1/uploads/image` → get new URL
2. `PATCH /v1/academies/:id` with only dirty fields + new logoUrl if changed
3. On success → invalidate academy query cache → `router.back()`

## Backend: Upload Module

**New module:** `apps/api/src/modules/upload/`

### `POST /v1/uploads/image`

**Auth:** Required (any authenticated user)

**Request:** `multipart/form-data` with field `image` (single file)

**Validation:**
- File type: `image/jpeg`, `image/png`, `image/webp`
- Max size: 5MB
- Reject if no file attached

**Processing:**
1. Parse multipart with `multer` (memory storage, 5MB limit)
2. Generate unique filename: `{uuid}.{ext}`
3. Upload to R2 bucket via `@aws-sdk/client-s3` `PutObjectCommand`
4. Return `{ url: string }` — public URL of the uploaded image

**Response (201):**
```json
{ "url": "https://{R2_PUBLIC_DOMAIN}/{uuid}.{ext}" }
```

**Zod schema:** Add `uploadImageResponseSchema` to `packages/validators/src/upload.schema.ts` (new file):
```typescript
export const uploadImageResponseSchema = z.object({
  url: z.string().url(),
});
```

**Errors:**
- `400` — No file, invalid type, or exceeds size
- `401` — Not authenticated
- `500` — R2 upload failure

**Environment variables (new):**
- `R2_ACCOUNT_ID` — Cloudflare account ID
- `R2_ACCESS_KEY_ID` — R2 access key
- `R2_SECRET_ACCESS_KEY` — R2 secret key
- `R2_BUCKET_NAME` — bucket name
- `R2_PUBLIC_URL` — public URL prefix for the bucket

**Module structure (follows existing codebase pattern — no separate controller file, handlers inline in routes):**
```
modules/upload/
├── upload.routes.ts        # Route definitions with inline handlers
├── upload.service.ts       # Upload logic (R2 interaction)
└── upload.config.ts        # R2 S3 client setup
```

## Backend: Academy Stats Endpoint

### `GET /v1/academies/:academyId/stats`

**Auth:** Required + role `manager` + must own academy

**Response (200):**
```json
{
  "activeMembers": 24,
  "pendingRequests": 3,
  "classesToday": 5,
  "activePlans": 4
}
```

**Queries:**
- `activeMembers` — count from `academy_memberships` where `academy_id = :id AND status = 'active'`
- `pendingRequests` — count from `academy_memberships` where `academy_id = :id AND status = 'pending'`
- `classesToday` — count from `classes` where `academy_id = :id AND day_of_week = :currentDayOfWeek`
- `activePlans` — count from `subscription_plans` where `academy_id = :id AND is_active = true`

**Added to:** `apps/api/src/modules/academy/academy.routes.ts`

**Middleware chain:** `requireSession` → `authorize(Role.Manager)` → handler. Ownership verification done in the service layer (academy `owner_id` must match authenticated user ID), following the same pattern as `PATCH /v1/academies/:id`.

**Zod schema:** Add `academyStatsResponseSchema` to `packages/validators/src/academy.schema.ts`:
```typescript
export const academyStatsResponseSchema = z.object({
  activeMembers: z.number().int().min(0),
  pendingRequests: z.number().int().min(0),
  classesToday: z.number().int().min(0),
  activePlans: z.number().int().min(0),
});
```

## Shared Components (extracted as needed)

Components will be created as they emerge during screen implementation:

| Component | First used in | Purpose |
|-----------|---------------|---------|
| TabBar | M-MGR-02 | Custom pill-shaped bottom tab bar |
| StatCard | M-MGR-02 | Stat display with icon, count, label |
| ClassCard | M-MGR-02 | Class preview card (name, time, instructor) |
| ImagePickerField | M-MGR-01 | Image selection with preview + upload |
| DatePickerField | M-MGR-01 | Date input with native picker |

Existing components reused: `GradientButton`, `BackButton`, `FormInput`.

## Dependencies to Install

**Mobile (`apps/mobile`):**
- `@tanstack/react-query`
- `react-hook-form`
- `@hookform/resolvers`
- `expo-image-picker`
- `@react-native-community/datetimepicker`

**API (`apps/api`):**
- `multer` + `@types/multer`
- `@aws-sdk/client-s3`

## Backend Changes Summary

| Change | Location | Description |
|--------|----------|-------------|
| Extend `/me` response | `user` module + `packages/validators` | Add `activeAcademy` field for managers |
| New upload module | `modules/upload/` | Image upload to Cloudflare R2 |
| New stats endpoint | `modules/academy/` | `GET /v1/academies/:id/stats` |
| New Zod schemas | `packages/validators/` | `academyStatsResponseSchema`, `uploadImageResponseSchema`, extended `userMeResponseSchema` |
| New env vars | `packages/config/` | R2 credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`) |
