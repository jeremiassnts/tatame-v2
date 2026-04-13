# API Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rate limiting, helmet, CORS restrictions, and body size limits to protect the API from basic DDoS and brute-force attacks.

**Architecture:** All changes are middleware additions in `app.ts`. Rate limiting uses `express-rate-limit` with Redis store (falls back to in-memory). CORS uses an env-driven origin whitelist. Helmet adds standard HTTP security headers.

**Tech Stack:** express-rate-limit, rate-limit-redis, helmet, Redis (existing)

---

### Task 1: Install dependencies

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install packages**

```bash
cd apps/api && pnpm add helmet express-rate-limit rate-limit-redis
```

- [ ] **Step 2: Verify installation**

```bash
cd apps/api && node -e "require('helmet'); require('express-rate-limit'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): add helmet, express-rate-limit, rate-limit-redis"
```

---

### Task 2: Add CORS_ORIGINS env var

**Files:**
- Modify: `packages/config/src/env.ts`

- [ ] **Step 1: Add CORS_ORIGINS to env schema**

Add after the `ADMIN_JWT_SECRET` line in the `envSchema` object:

```typescript
/** Comma-separated allowed CORS origins (e.g. "https://app.tatame.com,https://admin.tatame.com") */
CORS_ORIGINS: z.string().optional(),
```

- [ ] **Step 2: Verify build**

```bash
cd packages/config && pnpm build
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/config/src/env.ts
git commit -m "feat(config): add CORS_ORIGINS env var"
```

---

### Task 3: Harden app.ts with helmet, CORS, body limit, and rate limiting

**Files:**
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Replace the entire `app.ts` with hardened version**

```typescript
import "./express-augment.js";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { clerkAuthorizedParties, loadEnv } from "@tatame/config";
import { apiRouter } from "./router.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createWebhookRouter } from "./modules/manager-subscription/manager-subscription.routes.js";

function buildRateLimitStore(redisUrl: string | undefined) {
  if (!redisUrl) return undefined;
  try {
    const { RedisStore } = require("rate-limit-redis");
    const { createClient } = require("redis");
    const client = createClient({ url: redisUrl });
    client.connect().catch(() => {});
    return new RedisStore({ sendCommand: (...args: string[]) => client.sendCommand(args) });
  } catch {
    return undefined;
  }
}

/** Express app without `listen` — used by `server.ts` and tests. */
export function createApp(): express.Express {
  const env = loadEnv();
  const app = express();

  // 1. Security headers
  app.use(helmet());

  // 2. CORS with origin whitelist
  const origins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(",").map((s) => s.trim())
    : undefined;
  app.use(cors({ origin: origins ?? true, credentials: true }));

  // 3. Webhook raw body (before JSON parser)
  app.use(
    "/v1/webhooks",
    express.raw({ type: "application/json" }),
    (req, _res, next) => {
      (req as any).rawBody = req.body;
      req.body = JSON.parse(req.body.toString());
      next();
    },
  );

  // 4. Clerk auth
  if (env.CLERK_SECRET_KEY) {
    app.use(
      clerkMiddleware({
        authorizedParties: clerkAuthorizedParties(env),
      }),
    );
  }

  // 5. JSON body parser with explicit size limit
  app.use(express.json({ limit: "100kb" }));

  // 6. Rate limiting
  const store = buildRateLimitStore(env.REDIS_URL);

  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    store,
    message: { error: "Too many requests, please try again later" },
  });

  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    store,
    message: { error: "Too many requests, please try again later" },
  });

  app.use("/v1", globalLimiter);
  app.use("/v1/admin/login", authLimiter);
  app.use("/v1/users/me/sync", authLimiter);

  // 7. Routes
  app.use("/v1/webhooks", createWebhookRouter());
  app.use("/v1", apiRouter);

  // 8. Error handler
  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 2: Run existing tests to verify nothing breaks**

```bash
cd apps/api && pnpm test:unit
```

Expected: all tests pass

- [ ] **Step 3: Run integration tests**

```bash
cd apps/api && pnpm test:integration
```

Expected: all tests pass (rate limiter won't trigger with test traffic)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/app.ts
git commit -m "feat(api): add helmet, CORS whitelist, body limit, and rate limiting"
```

---

### Task 4: Set CORS_ORIGINS in production

**Files:**
- No code changes — environment configuration

- [ ] **Step 1: Add to production environment in Coolify**

Set `CORS_ORIGINS` to the actual production origins:

```
CORS_ORIGINS=https://your-web-domain.com
```

This is a manual step in the Coolify dashboard.

---

### Verification Checklist

After all tasks:

- [ ] `pnpm test:unit` passes (all 175 tests)
- [ ] `pnpm test:integration` passes (all 46 tests)
- [ ] `curl -I http://localhost:3001/v1/health` shows `x-content-type-options: nosniff` (helmet working)
- [ ] `curl -I http://localhost:3001/v1/health` does NOT show `X-Powered-By` header
- [ ] Rapid requests to `/v1/health` eventually return 429
