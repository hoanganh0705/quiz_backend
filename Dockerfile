# syntax=docker/dockerfile:1.9
# ==============================================================================
# Quiz Backend - Production Dockerfile
# ==============================================================================
# Multi-stage layout:
#   base       — Debian Bookworm slim with Node.js 22 runtime + activated pnpm
#   prod-deps  — pure production dependencies (excludes optional dev peers like TS)
#   builder    — compiles NestJS TypeScript into JavaScript (dist)
#   runner     — minimal, hardened Google Distroless Node.js 22 runtime (non-root)
# ==============================================================================

ARG IMAGE_VERSION=untagged
ARG IMAGE_REVISION=local
ARG BUILD_DATE=

# ------------------------------------------------------------------------------
# Stage 1: Base Tooling Environment
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base

ENV TZ=UTC \
    PNPM_HOME="/root/.local/share/pnpm" \
    PATH="/root/.local/share/pnpm:$PATH"

# Prepare pnpm once in base stage so child stages inherit it without repetition
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# ------------------------------------------------------------------------------
# Stage 2: Production Dependencies (prod-deps)
# ------------------------------------------------------------------------------
# Installs strictly production dependencies. Using --no-optional prevents
# optional peer dependencies (notably TypeScript from @nestjs/swagger and
# @nestjs/graphql) from being pulled into production node_modules, saving 24 MB.
# Mounts pnpm's actual default store directory for persistent BuildKit caching.
FROM base AS prod-deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    pnpm install --prod --no-optional --frozen-lockfile && \
    find node_modules -type f \( -name "*.map" -o -name "*.d.ts" -o -name "*.d.ts.map" -o -name "*.d.cts" -o -name "*.d.mts" -o -name "*.md" -o -name "*.markdown" -o -name "*.tsbuildinfo" -o -name "*.flow" -o -name "*.h" -o -name "*.cc" -o -name "*.c" \) -delete && \
    find node_modules -mindepth 2 -type d \( -name "test" -o -name "tests" -o -name "__tests__" -o -name "docs" -o -name "example" -o -name "examples" \) -exec rm -rf {} + 2>/dev/null || true && \
    rm -rf node_modules/.pnpm/@scarf* node_modules/@scarf

# ------------------------------------------------------------------------------
# Stage 3: Builder
# ------------------------------------------------------------------------------
# Installs complete dependencies (including devDependencies for Nest CLI and tsc)
# and builds the production distribution bundle.
FROM base AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    pnpm install --frozen-lockfile

COPY . .

# Build application using high-speed Rust-based SWC compiler and strip debug sourcemaps
RUN pnpm run build && \
    find dist -type f -name "*.map" -delete

# ------------------------------------------------------------------------------
# Stage 4: Distroless Runner
# ------------------------------------------------------------------------------
# Production container based on Google Distroless Node.js 22 (Debian 12 glibc).
# Distroless contains ONLY Node.js and its shared runtime libraries (glibc, libssl, etc.)
# No shell, no package manager (apt/dpkg), no compiler toolchains.
# Built-in non-root user (uid 65532:gid 65532) for least-privilege security.
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner
WORKDIR /app

ARG IMAGE_VERSION
ARG IMAGE_REVISION
ARG BUILD_DATE

LABEL \
    org.opencontainers.image.authors="hoanganh0705" \
    org.opencontainers.image.description="Quiz Backend API" \
    org.opencontainers.image.licenses="UNLICENSED" \
    org.opencontainers.image.ref.name="quiz_backend" \
    org.opencontainers.image.source="https://github.com/hoanganh0705/quiz_backend" \
    org.opencontainers.image.title="quiz_backend" \
    org.opencontainers.image.version="${IMAGE_VERSION:-untagged}" \
    org.opencontainers.image.revision="${IMAGE_REVISION:-local}" \
    org.opencontainers.image.created="${BUILD_DATE}"

# Copy production artifacts with nonroot ownership
COPY --from=prod-deps --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /app/src/core/database/migrations ./migrations
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

STOPSIGNAL SIGTERM

# Native Node.js healthcheck (distroless has no curl/wget/bash)
HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
    CMD ["/nodejs/bin/node", "-e", "require('http').get('http://localhost:8080/api/v1/health', (r) => { if (r.statusCode !== 200) process.exit(1); })"]

CMD ["dist/main.js"]
