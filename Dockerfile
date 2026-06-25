# syntax=docker/dockerfile:1.9
# =============================================
# Quiz Backend - Production Dockerfile
# =============================================
#
# Build args (CI/CD sets these via --build-arg):
#   IMAGE_VERSION  — e.g. 1.2.3  (defaults to "untagged")
#   IMAGE_REVISION — git SHA      (defaults to "local")
#   BUILD_DATE     — ISO 8601     (defaults to empty)
#
# Multi-stage layout:
#   base     — OS layer + curl (for health checks)
#   prereqs  — all packages, BuildKit cache mount for pnpm store
#   builder  — TypeScript → dist/, then prune devDeps
#   runner   — minimal production image, non-root
# =============================================

ARG IMAGE_VERSION=untagged
ARG IMAGE_REVISION=local
ARG BUILD_DATE=

# ---------------------------------------------
# Stage 1: Base Image
# ---------------------------------------------
FROM node:22.12.0-bookworm-slim AS base

# OCI image metadata.
# NOTE: Docker emits "UndefinedVar" warnings for the $VAR references
# below when no --build-arg is supplied.  These are cosmetic diagnostics
# — the labels are correctly applied and readable via `docker inspect`.
# CI/CD pipelines should pass --build-arg values to populate them.
LABEL \
    org.opencontainers.image.authors="hoanganh0705" \
    org.opencontainers.image.description="Quiz Backend API" \
    org.opencontainers.image.licenses="UNLICENSED" \
    org.opencontainers.image.ref.name="quiz_backend" \
    org.opencontainers.image.source="https://github.com/hoanganh0705/quiz_backend" \
    org.opencontainers.image.title="quiz_backend"

# ca-certificates: TLS/HTTPS support.
# curl: used by the HEALTHCHECK CMD.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

ENV TZ=UTC

# ---------------------------------------------
# Stage 2: Prereqs
# ---------------------------------------------
#
# Installs ALL dependencies (prod + dev).  Dev deps are needed
# by the builder stage to run `nest build`.  They are pruned
# in the builder stage and never reach the runner image.
#
# BuildKit cache mount: the pnpm content-addressable store
# persists across builds.  Unchanged packages are hard-linked
# from the cache, eliminating repeated network fetches.
FROM base AS prereqs

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# FIX: pin pnpm version explicitly (consistent with builder stage)
# so the same binary is used across all stages.
RUN --mount=type=cache,target=/root/.pnpm-store \
    corepack enable && \
    corepack prepare pnpm@9.15.0 --activate && \
    pnpm install --frozen-lockfile

# ---------------------------------------------
# Stage 3: Builder
# ---------------------------------------------
#
# Native modules (bcrypt, pg) are compiled here against glibc.
# The compiled binaries are preserved in node_modules and copied
# directly to the runner — no reinstall, no --ignore-scripts risk.
FROM base AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY --from=prereqs /app/node_modules ./node_modules

COPY . .

# nest build uses tsc by default.  Fix type errors in source —
# do not suppress them here.
RUN pnpm run build

# Prune devDeps after the build.  The runner then receives a
# production-only node_modules — no network I/O, no reinstall,
# and native module binaries are intact.
# FIX: include cache mount so pnpm can resolve the store during prune.
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm prune --prod

# ---------------------------------------------
# Stage 4: Runner
# ---------------------------------------------
#
# Minimal production image.  node_modules is copied directly from
# the builder stage after pruning — prod deps only, with native
# modules already compiled against the correct glibc target.
# Migrations are bundled for explicit out-of-band execution via
# CI/CD or a dedicated Job (never auto-applied on startup).
FROM base AS runner

WORKDIR /app

RUN groupadd --gid 10001 nodeapp && \
    useradd --uid 10001 --gid nodeapp --shell /bin/false --create-home nodeapp

# --chown on COPY avoids a separate recursive chown layer.
COPY --from=builder --chown=nodeapp:nodeapp /app/node_modules ./node_modules
COPY --from=builder --chown=nodeapp:nodeapp /app/dist ./dist
COPY --from=builder --chown=nodeapp:nodeapp /app/src/core/database/migrations ./migrations

# FIX: copy package.json — some modules (NestJS, TypeORM) read
# name/version from it at runtime; omitting it can cause subtle errors.
COPY --from=builder --chown=nodeapp:nodeapp /app/package.json ./package.json

USER nodeapp

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

# Graceful shutdown: NestJS's app.enableShutdownHooks() (in main.ts)
# catches SIGTERM, drains in-flight requests, then exits.  STOPSIGNAL
# ensures Docker delivers SIGTERM directly to PID 1 (node), not to
# a shell wrapper.
STOPSIGNAL SIGTERM

# Fallback health check for `docker run` / Docker Compose.
# In Kubernetes, use a Pod readiness/liveness probe instead;
# the orchestrator's probe takes precedence.
HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:8080/api/v1/health || exit 1

# exec form ensures Node.js receives SIGTERM directly as PID 1,
# enabling NestJS shutdown hooks to drain in-flight requests cleanly.
CMD ["node", "dist/main.js"]