---
name: nestjs-docker-deployment
description: Builds minimal, hardened, high-performance Docker images for NestJS services using Google Distroless, Rust-based SWC compilation, pnpm BuildKit caching, non-root execution, and native Node.js health checks. Use when modifying Dockerfile, container build pipelines, deployment configurations, or runtime performance.
---

# NestJS Docker & Container Deployment: Distroless & SWC Standard

This repository follows a strict **hardened, minimal multi-stage Docker architecture** using Google Distroless Node 22 (glibc runtime), SWC compilation, pnpm store cache mounts, and aggressive production artifact pruning.

---

## 1. Multi-Stage Build Architecture

Maintain the 4-stage pipeline defined in [Dockerfile](file:///home/anhnguyen/Workspace/projects/WebProjects/quiz/quiz_backend/Dockerfile):

```
┌────────────────────────────────────────────────────────┐
│ Stage 1: base (node:22-bookworm-slim)                  │
│ • UTC timezone                                         │
│ • corepack enable && corepack prepare pnpm --activate  │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│ Stage 2: prod-deps           │ │ Stage 3: builder             │
│ • pnpm install --prod        │ │ • pnpm install (all deps)    │
│ • --no-optional (no TS peer) │ │ • nest build -b swc (~260ms) │
│ • aggressive metadata prune  │ │ • strip sourcemaps (.map)    │
│ • BuildKit pnpm store cache  │ │ • BuildKit pnpm store cache  │
└──────────────┬───────────────┘ └──────────────┬───────────────┘
               │                                │
               └───────────────┬────────────────┘
                               ▼
┌────────────────────────────────────────────────────────┐
│ Stage 4: runner (gcr.io/distroless/nodejs22:nonroot)   │
│ • Zero shells (no bash/sh), zero package managers     │
│ • Debian 12 glibc runtime (native addon ABI safety)   │
│ • Least-privilege nonroot user (UID/GID 65532:65532)  │
│ • Native Node.js inline healthcheck                   │
│ • Final image: ~308 MB on disk / ~64 MB compressed    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Compilation Rules (SWC vs. tsc)

- **Compiler:** Always build using SWC (`@swc/cli`, `@swc/core`) configured in `package.json` (`"build": "nest build -b swc"`). SWC compiles ~1,350+ TypeScript files in ~260ms (a 40x speedup over standard `tsc`).
- **Entrypoint Path:** SWC respects the `sourceRoot: "src"` configuration and outputs directly into `dist/main.js`. Never use `CMD ["dist/src/main.js"]` (which was an artifact of `tsc` with `drizzle.config.ts` outside `src`). The entrypoint in [Dockerfile](file:///home/anhnguyen/Workspace/projects/WebProjects/quiz/quiz_backend/Dockerfile) is:
  ```dockerfile
  CMD ["dist/main.js"]
  ```
- **Build Scope ([tsconfig.build.json](file:///home/anhnguyen/Workspace/projects/WebProjects/quiz/quiz_backend/tsconfig.build.json)):** Exclude developer fixtures, scripts, and debugging tools from the production build:
  - Exclude `"src/commands/**"` (e.g. database seeders)
  - Exclude `"src/debug.ts"` and all `**/*.spec.ts`

---

## 3. Package Management & BuildKit Caching

- **Pnpm Cache Mount:** Pnpm stores package tarballs at `/root/.local/share/pnpm/store/v3` on Linux. Always attach a BuildKit cache mount to prevent redownloading packages across builds:
  ```dockerfile
  RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
      pnpm install --prod --no-optional --frozen-lockfile
  ```
- **Avoid Optional Peer Dependencies:** The `--no-optional` flag is required during `prod-deps` to prevent heavy optional peer dependencies (notably the `typescript` compiler pulled by `@nestjs/swagger` and `@nestjs/graphql`) from polluting production `node_modules`, saving ~24 MB.
- **Dockerignore:** Ensure [.dockerignore](file:///home/anhnguyen/Workspace/projects/WebProjects/quiz/quiz_backend/.dockerignore) excludes `.git`, `node_modules`, `dist`, `.agents`, `benchmarks`, `SEED_RECORD.md`, `.pnpm-store`, and local environment files (`.env*`).

---

## 4. Production Artifact Pruning

To keep disk footprint around ~300 MB and compressed download around ~64 MB, run aggressive cleanup inside `prod-deps`:
```bash
# Strip non-runtime TypeScript metadata and development headers
find node_modules -type f \( \
    -name "*.map" -o -name "*.d.ts" -o -name "*.d.ts.map" -o \
    -name "*.d.cts" -o -name "*.d.mts" -o -name "*.md" -o \
    -name "*.markdown" -o -name "*.tsbuildinfo" -o -name "*.flow" -o \
    -name "*.h" -o -name "*.cc" -o -name "*.c" \
\) -delete

# Remove vendor test and documentation directories
find node_modules -mindepth 2 -type d \( \
    -name "test" -o -name "tests" -o -name "__tests__" -o \
    -name "docs" -o -name "example" -o -name "examples" \
\) -exec rm -rf {} + 2>/dev/null || true

# Strip telemetry packages
rm -rf node_modules/.pnpm/@scarf* node_modules/@scarf
```

---

## 5. Distroless Hardening & Non-Root Execution

- **Base Image:** `gcr.io/distroless/nodejs22-debian12:nonroot`.
- **Attack Surface Elimination:** Distroless contains zero shells (`/bin/sh`, `/bin/bash`), zero package managers (`apt`, `dpkg`), and zero compiler toolchains. Attackers cannot spawn reverse shells or download binaries into the container.
- **glibc ABI Compatibility:** Uses Debian 12 glibc. Do not switch to Alpine (`musl`) because:
  1. Alpine creates Docker whiteout marker overhead when removing files, inflating image size.
  2. glibc guarantees 100% ABI compatibility with native Node.js addons (`bcrypt`, `@swc/core`, `sharp`).
- **User Ownership:** The Distroless `nonroot` user runs with UID `65532` and GID `65532`. Always copy artifacts with `--chown=nonroot:nonroot`:
  ```dockerfile
  COPY --from=prod-deps --chown=nonroot:nonroot /app/node_modules ./node_modules
  COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
  COPY --from=builder --chown=nonroot:nonroot /app/src/core/database/migrations ./migrations
  COPY --from=builder --chown=nonroot:nonroot /app/package.json ./package.json
  ```

---

## 6. Runtime Health Checks & Signal Handling

- **Health Check Implementation:** Because Distroless has no `curl` or `wget`, implement Docker healthchecks using the native Node.js inline HTTP client:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
      CMD ["/nodejs/bin/node", "-e", "require('http').get('http://localhost:8080/api/v1/health', (r) => { if (r.statusCode !== 200) process.exit(1); })"]
  ```
- **Graceful Shutdown:** Set `STOPSIGNAL SIGTERM`. NestJS must listen for `SIGTERM` via `app.enableShutdownHooks()` to safely close PostgreSQL connection pools, BullMQ queue workers, and Redis pub/sub sockets.
- **Database Migrations:** Never execute database migrations (`drizzle-kit migrate`) directly inside application worker replicas on container start. Migrations must run as a standalone release step or dedicated job before traffic is routed.

---

## 7. Verification Checklist

When building or updating Docker containers:
1. **Build the image:**
   ```bash
   docker build -t quiz-backend:latest ./quiz_backend
   ```
2. **Inspect image size and layer breakdown:**
   ```bash
   docker images quiz-backend:latest
   docker history quiz-backend:latest
   ```
   *Target: Disk size $\le$ 310 MB; compressed transfer size $\le$ 65 MB.*
3. **Verify non-root execution:**
   ```bash
   docker run --rm quiz-backend:latest /nodejs/bin/node -e "console.log('UID:', process.getuid(), 'GID:', process.getgid())"
   ```
   *Expected: `UID: 65532 GID: 65532`.*
4. **Verify application boot and healthcheck:**
   ```bash
   docker run -d --name test-backend -p 8080:8080 --env-file .env quiz-backend:latest
   docker inspect --format='{{json .State.Health.Status}}' test-backend
   ```
   *Expected: `"healthy"` within 30 seconds.*
