# ── Stage 1: Install dependencies ──
FROM node:24-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy dependency manifests only (for layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
COPY packages/validators/package.json packages/validators/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ──
FROM deps AS build

# Copy all source code
COPY apps/api/ apps/api/
COPY packages/ packages/
COPY turbo.json tsconfig.base.json ./

# Build all packages in dependency order, then the API
RUN pnpm turbo build --filter=@tatame/api

# Create isolated production bundle
RUN pnpm deploy --filter=@tatame/api --prod /app/deploy

# ── Stage 3: Production ──
FROM node:24-alpine AS production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy production bundle (dist + prod node_modules)
COPY --from=build /app/deploy/dist ./dist
COPY --from=build /app/deploy/node_modules ./node_modules

# Copy migration SQL files and meta
COPY --from=build /app/packages/db/drizzle ./drizzle

ENV NODE_ENV=production

USER appuser

CMD ["node", "dist/server.js"]
