# Remove Email Auth, Keep Only Social Login — Design Spec

## Overview

Remove all email/password authentication flows and keep only social login (Google and Apple) as per TAT-126.

## Changes

### New Welcome Screen Layout (`apps/mobile/app/(auth)/index.tsx`)

Single-screen auth with two vertically-stacked groups, both centered on screen:

**Group 1 — Branding (top):**
- Logo (88x88, rounded-[22px], bg `#242424`)
- "TATAME" (Poppins Bold, 32px)
- "Sua academia na palma da mão" (Poppins 400, 15px, muted)

**Group 2 — Buttons (below, with generous gap ~gap-10):**
- "Entrar com Google" — full width, h-14, rounded-xl, bg surface, border, Google icon
- "Entrar com Apple" — full width, h-14, rounded-xl, bg surface, border, Apple icon
- gap-3 between buttons

Both groups centered vertically using flex justify-center.

### Files Removed

- `apps/mobile/app/(auth)/sign-in.tsx`
- `apps/mobile/app/(auth)/sign-up.tsx`
- `apps/mobile/app/(auth)/verify-email.tsx`

### Files Modified

- `apps/mobile/app/(auth)/index.tsx` — rewritten with social-only layout
- `apps/mobile/components/SocialButtons.tsx` — removed (no longer used; new buttons are inline with full-width "Entrar com..." text)

### Files Kept (used elsewhere)

- `FormInput`, `Divider`, `BackButton` — still used across 50+ screens

### Clerk Dashboard (manual)

- Disable email/password authentication strategy
- Ensure Google and Apple OAuth remain enabled

### Migration Notes

- Existing email-only users: Clerk auto-links accounts if the social provider email matches. Users with mismatched emails need manual linking in Clerk Dashboard.

## Acceptance Criteria

- Auth screen shows only "Entrar com Google" and "Entrar com Apple" buttons
- No email/password input fields visible on any auth screen
- No "forgot password" flow accessible
- Auth flow works end-to-end with both providers
