# Profile Photo Upload — Design Spec

**Linear:** TAT-83
**Date:** 2026-04-20
**Status:** Draft

## Goal

Allow users (all roles) to change their profile photo from the profile screen. Clerk is the source of truth — the image is uploaded directly to Clerk via `user.setProfileImage()`, and the existing webhook sync updates the local database.

## Decisions

| Decision | Choice |
|---|---|
| Storage | Clerk (no R2 upload needed) |
| Upload method | `user.setProfileImage()` from `@clerk/clerk-expo` |
| Source of truth | Clerk — webhook sync updates `users.profileImageUrl` in DB |
| Academy logo | Out of scope (already implemented in settings.tsx) |
| New dependencies | None — `@clerk/clerk-expo` and `expo-image-picker` already installed |
| Backend changes | None |

## Flow

1. User taps avatar area on profile screen
2. `expo-image-picker` opens (launchImageLibraryAsync, aspect 1:1, quality 0.8, allowsEditing)
3. User selects and crops image
4. Call `user.setProfileImage({ file })` from Clerk SDK with base64 image
5. On success, invalidate `["user", "me"]` query to refresh local data
6. Avatar updates immediately with new image

## Changes to Profile Screen

**File:** `apps/mobile/app/(app)/profile.tsx`

### Avatar section (lines 141-147)

Current: static `Avatar` component displaying `user.profileImageUrl`.

New:
- Wrap `Avatar` in a `Pressable` that triggers image picker
- Add a small camera icon badge (overlay) on the bottom-right corner of the avatar
- Add "Alterar foto" text below the avatar
- Show loading state (ActivityIndicator overlay on avatar) during upload

### New imports needed

- `useUser` from `@clerk/clerk-expo` — access to `user.setProfileImage()`
- `launchImageLibraryAsync`, `MediaTypeOptions` from `expo-image-picker`
- `Camera` from `lucide-react-native` — camera badge icon
- `ActivityIndicator` from `react-native`

### Upload handler

```
async function handleChangePhoto():
  1. Launch image picker (aspect 1:1, quality 0.8, base64: true, allowsEditing: true)
  2. If cancelled, return
  3. Set uploading state to true
  4. Convert base64 to blob/file format required by Clerk
  5. Call user.setProfileImage({ file })
  6. Invalidate ["user", "me"] query
  7. Set uploading state to false
  8. Handle errors with user-friendly Alert
```

## Acceptance Criteria

- Tapping the avatar area on the profile screen opens the image picker
- Camera icon badge and "Alterar foto" text clearly indicate the avatar is editable
- Selected image is uploaded to Clerk and reflected in the avatar after upload
- Loading indicator is shown during upload
- Error is shown via Alert if upload fails
- Works for all roles (student, instructor, manager)
- No backend changes required
