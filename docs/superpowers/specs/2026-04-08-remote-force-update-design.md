# Remote Force-Update Check

**Date:** 2026-04-08
**Status:** Approved

## Problem

The mobile app checks `EXPO_PUBLIC_MIN_APP_VERSION` (a build-time env var) to decide if a force-update is needed. Since this value is baked into the JS bundle at build time, an old app version can never learn that a newer minimum version exists. The check is effectively useless.

## Solution

Replace the static env check with a runtime fetch to the existing `GET /v1/version` API endpoint, which returns `{ minMobileVersion }` from the server's `MIN_MOBILE_VERSION` env var.

## Changes

### 1. `apps/mobile/lib/version.ts`

- `shouldForceUpdate()` becomes **async**: fetches `GET {EXPO_PUBLIC_API_URL}/version` (no auth required)
- Compares response `minMobileVersion` against `Constants.expoConfig.version` using existing `isVersionLessThan`
- Timeout: 3 seconds
- On any failure (network error, timeout, non-200): returns `false` (do not block the user)

### 2. `apps/mobile/app/index.tsx`

- Calls async `shouldForceUpdate()` inside the existing `useEffect`
- New state: `needsUpdate: boolean | undefined` (undefined = loading)
- Redirect to `/(system)/force-update` when `needsUpdate === true`
- Loading state waits for both auth + version check before rendering redirects

### 3. `apps/mobile/app/(system)/force-update.tsx`

- Remove reading of `EXPO_PUBLIC_MIN_APP_VERSION`
- Show only the current version (from `Constants.expoConfig.version`)

### 4. Cleanup

- Remove `EXPO_PUBLIC_MIN_APP_VERSION` from any `.env` files in the mobile app
- Remove `EXPO_PUBLIC_MIN_APP_VERSION` references from EAS/build configs if present

## What stays the same

- `GET /v1/version` endpoint (already exists in `apps/api/src/router.ts`)
- `MIN_MOBILE_VERSION` server env var (source of truth)
- `isVersionLessThan()` comparison logic
- Force-update screen visual design
- Store URL env vars (`EXPO_PUBLIC_IOS_STORE_URL`, `EXPO_PUBLIC_ANDROID_STORE_URL`)

## Fallback behavior

API unreachable or error → app opens normally. Users are never blocked by a version check failure.
