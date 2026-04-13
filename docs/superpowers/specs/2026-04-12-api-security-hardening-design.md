# API Security Hardening — Rate Limiting & DDoS Protection

**Date:** 2026-04-12
**Status:** Approved
**Scope:** Express middleware changes in `apps/api`

## Context

The API currently has zero rate limiting, permissive CORS, no HTTP security headers, and no explicit body size limits. All applications run in containers on a VPS with Coolify, with no CDN/WAF in front. Traffic is low (MVP stage).

## Goals

1. Prevent brute-force attacks on auth endpoints
2. Mitigate basic DDoS at the application layer
3. Harden HTTP headers
4. Restrict CORS to known origins
5. Enforce explicit body size limits

## Non-Goals (future work)

- Cloudflare / reverse proxy DDoS protection
- Per-user (authenticated) rate limiting
- AbacatePay webhook signature verification
- Request metrics/observability for blocked requests
- IP allow/block lists

## Design

### 1. Helmet — HTTP Security Headers

Add `helmet()` as the first middleware in `app.ts`. This adds:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)
- Removes `X-Powered-By`
- Content-Security-Policy defaults

No custom configuration needed — defaults are appropriate for an API.

### 2. CORS Origin Whitelist

Replace `cors()` (no args, allows all origins) with an explicit origin whitelist:

```typescript
const origins = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(",").map(s => s.trim())
  : ["http://localhost:3000"];

app.use(cors({ origin: origins, credentials: true }));
```

- New env var: `CORS_ORIGINS` (comma-separated list)
- In production: set to `https://app.tatame.com` (or actual domain)
- In development: defaults to `http://localhost:3000`

### 3. Body Size Limit

Add explicit `limit` to `express.json()`:

```typescript
app.use(express.json({ limit: "100kb" }));
```

This is already the Express default but making it explicit prevents surprises if defaults change and documents the intention.

### 4. Rate Limiting

Use `express-rate-limit` with `rate-limit-redis` store (Redis is already available in the stack):

**Global rate limiter:**
- 100 requests per minute per IP
- Applied to all `/v1/*` routes
- Returns `429 Too Many Requests` with `Retry-After` header
- Standard JSON error response: `{ "error": "Too many requests, please try again later" }`

**Auth rate limiter (stricter):**
- 10 requests per minute per IP
- Applied to: `/v1/admin/login`, `/v1/users/me/sync`
- Same 429 response format

**Redis store:**
- Uses the existing `REDIS_URL` env var
- Falls back to in-memory store if Redis is unavailable (still provides basic protection)

### 5. Files Changed

| File | Change |
|------|--------|
| `apps/api/package.json` | Add `helmet`, `express-rate-limit`, `rate-limit-redis` |
| `apps/api/src/app.ts` | Add helmet, adjust cors, body limit, mount rate limiters |
| `packages/config/src/env.ts` | Add `CORS_ORIGINS` env var |

### 6. Middleware Order in app.ts

```
1. helmet()
2. cors({ origin, credentials })
3. express.raw() (webhooks only)
4. clerkMiddleware()
5. express.json({ limit: "100kb" })
6. globalRateLimiter (on /v1)
7. authRateLimiter (on /v1/admin/login, /v1/users/me/sync)
8. routes
9. errorHandler
```

Rate limiters go AFTER auth middleware so Clerk can process the request identity, but BEFORE route handlers.

### 7. Testing

- Unit test: not needed (middleware config only)
- Integration test: add one test verifying 429 response after exceeding limit (optional, can be skipped for MVP)
- Manual verification: hit `/v1/health` rapidly and confirm 429 after 100 requests
