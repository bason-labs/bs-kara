# Web image for bs-kara. Build from the repo root:
#   docker build -f apps/web/Dockerfile -t bs-kara-web .

# ---- base: Node + pnpm ------------------------------------------------------
FROM node:22-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate
WORKDIR /repo

# ---- deps: install only what @bs-kara/web needs ----------------------------
# Copy the manifests first so this layer is cached until dependencies change.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY patches ./patches
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --filter @bs-kara/web...

# ---- build: compile the Next.js standalone server ---------------------------
FROM deps AS build
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

# NEXT_PUBLIC_* values are inlined into the browser bundle at build time,
# so they must be passed as build args. They are public by design; server
# secrets are NOT passed here - they are read at runtime from the .env file.
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_DATABASE_URL
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_PUBLIC_ORIGIN
ARG NEXT_PUBLIC_ADMIN_TRIAL_DEFAULT_DAYS

RUN pnpm -C apps/web run build

# ---- runtime: small image with just the server ------------------------------
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app

# The standalone folder mirrors the monorepo layout (apps/web/server.js).
# Static assets are not included in it, so copy them next to the server.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public

# Run as the unprivileged "node" user that ships with the image, not root.
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
